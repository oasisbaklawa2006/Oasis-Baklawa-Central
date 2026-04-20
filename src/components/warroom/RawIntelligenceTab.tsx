import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { AlertCircle, RefreshCw, MessageSquare, Send, FileText, Mic, Image as ImageIcon, Package, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { parseBanyanMessage } from "@/lib/banyan-parser";

interface RawMessage {
  id: string;
  phone_number: string | null;
  raw_payload: any;
  created_at: string;
  error_message: string | null;
  processed: boolean | null;
}

interface AliasMatch {
  alias_text: string;
  canonical_name: string;
}

export default function RawIntelligenceTab() {
  const [messages, setMessages] = useState<RawMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [aliases, setAliases] = useState<AliasMatch[]>([]);
  const [creatingDraft, setCreatingDraft] = useState<string | null>(null);
  const [markingWaste, setMarkingWaste] = useState<string | null>(null);

  const fetchAliases = useCallback(async () => {
    const { data } = await supabase
      .from("product_aliases")
      .select("alias_text, canonical_name");
    setAliases((data as AliasMatch[]) ?? []);
  }, []);

  const fetchRaw = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("debug_webhooks")
      .select("id, phone_number, raw_payload, created_at, error_message, processed")
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(80);

    // Hard metadata filter — hide wamid-only acks, OAuthExceptions, and empty payloads.
    const filtered = ((data as RawMessage[]) ?? []).filter((m) => {
      const str = JSON.stringify(m.raw_payload || "");
      const hasMessage = !!m.raw_payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!hasMessage) return false;                          // status pings, no actual content
      if (str.includes("OAuthException")) return false;       // auth errors
      if (str.includes("statuses") && !str.includes('"text"') && !str.includes('"image"')) return false;
      return true;
    });

    setMessages(filtered);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRaw();
    fetchAliases();
    const channelName = "warroom-raw-intel";
    removeDuplicateRealtimeChannel(channelName);
    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "debug_webhooks" }, () => {
        // Immediate refresh, then a 1s follow-up to catch the storage upload patching `_oasis_attachment_url`.
        fetchRaw();
        setTimeout(() => fetchRaw(), 1000);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "debug_webhooks" }, () => fetchRaw())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchRaw, fetchAliases]);

  const extractText = (payload: any): string => {
    if (!payload) return "";
    const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg?.text?.body) return msg.text.body;
    if (typeof payload === "string") return payload.slice(0, 500);
    const str = JSON.stringify(payload);
    const textMatch = str.match(/"body"\s*:\s*"([^"]+)"/);
    if (textMatch) return textMatch[1];
    return str.slice(0, 300);
  };

  const extractMessageType = (payload: any): string => {
    const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return "text";
    return msg?.type || "text";
  };

  const extractSender = (payload: any, phone: string | null): { name: string; phone: string } => {
    const contact = payload?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
    const senderName = contact?.profile?.name || "Unknown";
    const senderPhone = phone || contact?.wa_id || "Unknown";
    return { name: senderName, phone: senderPhone };
  };

  const parseMessage = (text: string, phone: string | null) => {
    return parseBanyanMessage(text, aliases, phone);
  };

  const relativeTimeIST = (dateStr: string): string => {
    const now = new Date();
    const created = new Date(dateStr);
    const diffMs = now.getTime() - created.getTime();
    if (diffMs < 60000) return "Just now";
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleMarkWaste = async (msg: RawMessage) => {
    setMarkingWaste(msg.id);
    try {
      const { error } = await supabase
        .from("debug_webhooks")
        .update({ processed: true, error_message: "Non-Order Message" } as any)
        .eq("id", msg.id);

      if (error) {
        toast.error("Failed to mark as waste");
      } else {
        toast.success("Marked as non-order waste");
        fetchRaw();
      }
    } catch {
      toast.error("Error marking waste");
    }
    setMarkingWaste(null);
  };

  const handleCreateDraftSO = async (msg: RawMessage) => {
    setCreatingDraft(msg.id);
    try {
      const sender = extractSender(msg.raw_payload, msg.phone_number);
      const text = extractText(msg.raw_payload);
      const parsed = parseMessage(text, sender.phone);
      const phone = sender.phone.replace(/\D/g, "");

      if (parsed.missingQty) {
        toast.info("The quantity was not detected. Please specify the required amount in Kg or Boxes to proceed.");
      }
      if (parsed.missingPhone) {
        toast.info("The Customer Mobile number is required to generate the Portal Link. Please provide it to proceed.");
      }
      if (parsed.needsClarification) {
        toast.warning("Low confidence SKU match — order will be flagged ORANGE for clarification.");
      }

      const wamid =
        msg.raw_payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || null;

      const { data, error } = await supabase.functions.invoke("admin-create-draft", {
        body: {
          phone,
          sku_items: parsed.matchedSKUs.map((m) => ({
            name: m.name,
            confidence: m.confidence,
            quantity: m.quantity ?? undefined,
            unit: m.unit ?? undefined,
          })),
          candidate_company_name: parsed.candidateCompanyName,
          webhook_id: msg.id,
          wamid,
        },
      });

      if (error || !data?.ok) {
        toast.error(data?.error || "Failed to create draft order");
        setCreatingDraft(null);
        return;
      }

      if (data.needs_clarification) {
        toast.warning(`Order #${data.order_id.slice(0, 8).toUpperCase()} created — AWAITING CLARIFICATION`);
      } else {
        toast.success(`Draft SO created! Order #${data.order_id.slice(0, 8).toUpperCase()}`);
      }
      fetchRaw();
    } catch (err) {
      toast.error("Error creating draft SO");
    }
    setCreatingDraft(null);
  };

  const msgTypeIcon = (type: string) => {
    switch (type) {
      case "image": return <ImageIcon size={12} className="text-blue-400" />;
      case "audio": return <Mic size={12} className="text-purple-400" />;
      case "document": return <FileText size={12} className="text-amber-400" />;
      default: return <MessageSquare size={12} className="text-muted-foreground" />;
    }
  };

  const failed = messages.filter((m) => !m.processed || m.error_message);
  const processed = messages.filter((m) => m.processed && !m.error_message);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {failed.length} inbound message{failed.length !== 1 ? "s" : ""} need attention.
        </p>
        <button onClick={fetchRaw} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

      {!loading && failed.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">✅ All inbound messages successfully processed.</p>
      )}

      {failed.map((msg) => {
        const sender = extractSender(msg.raw_payload, msg.phone_number);
        const text = extractText(msg.raw_payload);
        const msgType = extractMessageType(msg.raw_payload);
        const parsed = parseMessage(text, sender.phone);

        return (
          <div key={msg.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
            {/* Header: Sender + Time */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{sender.name}</p>
                  <p className="text-[10px] text-muted-foreground">{sender.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {msgTypeIcon(msgType)}
                <span>{relativeTimeIST(msg.created_at)}</span>
              </div>
            </div>

            {/* Message Content */}
            <div className="bg-background rounded-md p-2.5 border border-border">
              {msgType === "image" && (
                <div className="mb-2">
                  <p className="text-xs text-blue-400 mb-1 flex items-center gap-1"><ImageIcon size={12} /> Image Attachment</p>
                  {msg.raw_payload?._oasis_attachment_url ? (
                    <a href={msg.raw_payload._oasis_attachment_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={msg.raw_payload._oasis_attachment_url}
                        alt="WhatsApp attachment"
                        className="max-h-48 w-auto rounded border border-border object-cover hover:opacity-90 transition-opacity"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">Image stored — preview not yet available.</p>
                  )}
                </div>
              )}
              {msgType === "audio" && (
                <p className="text-xs text-purple-400 mb-1 flex items-center gap-1"><Mic size={12} /> Audio Message</p>
              )}
              {msgType === "document" && (
                <p className="text-xs text-amber-400 mb-1 flex items-center gap-1"><FileText size={12} /> Document Attached</p>
              )}
              <p className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed">
                {text || <span className="italic text-muted-foreground">No text content decoded</span>}
              </p>
            </div>

            {/* AI Detected SKUs (with per-line quantity) */}
            {parsed.matchedSKUs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-primary">AI Detected SKUs:</span>
                {parsed.matchedSKUs.map((sku, i) => (
                  <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {sku.name}
                    {sku.quantity ? ` × ${sku.quantity}${sku.unit ? sku.unit : ""}` : ""}
                  </span>
                ))}
              </div>
            )}

            {/* Invoice / Voucher References */}
            {parsed.invoiceRefs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-amber-600">Repeat Order Ref:</span>
                {parsed.invoiceRefs.map((ref, i) => (
                  <span key={i} className="text-[10px] bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full font-medium border border-amber-500/20">
                    {ref}
                  </span>
                ))}
              </div>
            )}

            {/* Validation warnings */}
            {parsed.missingQty && (
              <p className="text-[10px] text-amber-600 flex items-center gap-1">
                <AlertTriangle size={10} /> Quantity not detected. Request the client to specify the required amount in Kg or Boxes.
              </p>
            )}

            {parsed.detectedSKUs.length === 0 && text && (
              <p className="text-[10px] text-muted-foreground italic">⚠ No SKU matches found — manual review needed</p>
            )}

            {/* Error */}
            {msg.error_message && (
              <p className="text-[10px] text-red-500 flex items-center gap-1">
                <AlertCircle size={10} /> {msg.error_message}
              </p>
            )}

            {/* Actions: Create Draft SO + Mark as Waste */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => handleMarkWaste(msg)}
                disabled={markingWaste === msg.id}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-md border border-border hover:border-destructive/30 hover:bg-destructive/5 disabled:opacity-50"
              >
                {markingWaste === msg.id ? (
                  <>Marking…</>
                ) : (
                  <><Trash2 size={12} /> Mark as Waste</>
                )}
              </button>
              <button
                onClick={() => handleCreateDraftSO(msg)}
                disabled={creatingDraft === msg.id}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-md border border-primary/20 hover:bg-primary/5 disabled:opacity-50"
              >
                {creatingDraft === msg.id ? (
                  <>Creating…</>
                ) : (
                  <><Package size={12} /> Create Draft SO</>
                )}
              </button>
            </div>
          </div>
        );
      })}

      {processed.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            <Send size={12} className="inline mr-1" />
            {processed.length} successfully processed messages
          </summary>
          <div className="space-y-2 mt-2">
            {processed.map((msg) => {
              const sender = extractSender(msg.raw_payload, msg.phone_number);
              const text = extractText(msg.raw_payload);
              return (
                <div key={msg.id} className="rounded-lg border border-border bg-card p-2.5 opacity-60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-foreground">{sender.name} ({sender.phone})</span>
                    <span className="text-[10px] text-muted-foreground">{relativeTimeIST(msg.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{text}</p>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
