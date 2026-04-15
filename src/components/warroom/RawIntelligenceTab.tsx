import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { AlertCircle, RefreshCw, MessageSquare, Send, FileText, Mic, Image as ImageIcon, Package } from "lucide-react";
import { toast } from "sonner";

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
      .limit(50);
    setMessages((data as RawMessage[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRaw();
    fetchAliases();
    const channelName = "warroom-raw-intel";
    removeDuplicateRealtimeChannel(channelName);
    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "debug_webhooks" }, () => fetchRaw())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchRaw, fetchAliases]);

  const extractText = (payload: any): string => {
    if (!payload) return "";
    const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg?.text?.body) return msg.text.body;
    if (typeof payload === "string") return payload.slice(0, 500);
    // Try to find any text-like content in the payload
    const str = JSON.stringify(payload);
    // Extract text from known patterns
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

  const detectSKUs = (text: string): string[] => {
    if (!text || aliases.length === 0) return [];
    const lower = text.toLowerCase();
    const matched = new Set<string>();
    for (const alias of aliases) {
      if (lower.includes(alias.alias_text.toLowerCase())) {
        matched.add(alias.canonical_name);
      }
    }
    return Array.from(matched);
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

  const handleCreateDraftSO = async (msg: RawMessage) => {
    setCreatingDraft(msg.id);
    try {
      const sender = extractSender(msg.raw_payload, msg.phone_number);
      const phone = sender.phone.replace(/\D/g, "");

      // Try to find matching company by phone
      const { data: companies } = await supabase
        .from("companies")
        .select("id, business_name")
        .or(`phone.ilike.%${phone.slice(-10)}%,gst_number.ilike.%${phone}%`)
        .limit(1);

      let companyId: string;

      if (companies && companies.length > 0) {
        companyId = companies[0].id;
      } else {
        // Create shadow company
        const { data: newCompany, error: companyErr } = await supabase
          .from("companies")
          .insert({
            business_name: `${sender.name} (WhatsApp)`,
            phone: `+${phone}`,
            gst_number: `WA:${phone}`,
            status: "shadow",
          } as any)
          .select("id")
          .single();

        if (companyErr || !newCompany) {
          toast.error("Failed to create shadow client");
          setCreatingDraft(null);
          return;
        }
        companyId = newCompany.id;
      }

      // Create draft order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          company_id: companyId,
          status: "draft",
          dispatch_urgency: "standard",
        } as any)
        .select("id")
        .single();

      if (orderErr || !order) {
        toast.error("Failed to create draft order");
        setCreatingDraft(null);
        return;
      }

      // Try to match SKUs and insert order items
      const text = extractText(msg.raw_payload);
      const skuMatches = detectSKUs(text);

      if (skuMatches.length > 0) {
        // Find product IDs for matched SKUs
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .in("name", skuMatches);

        if (products && products.length > 0) {
          const items = products.map((p) => ({
            order_id: order.id,
            product_id: p.id,
            quantity: 1, // Default quantity — admin will adjust
          }));
          await supabase.from("order_items").insert(items);
        }
      }

      // Mark webhook as processed
      await supabase
        .from("debug_webhooks")
        .update({ processed: true } as any)
        .eq("id", msg.id);

      toast.success(`Draft SO created! Order #${order.id.slice(0, 8).toUpperCase()}`);
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
        const detectedSKUs = detectSKUs(text);

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
                <p className="text-xs text-blue-400 mb-1 flex items-center gap-1"><ImageIcon size={12} /> Image Attachment</p>
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

            {/* AI Detected SKUs */}
            {detectedSKUs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-primary">AI Detected SKUs:</span>
                {detectedSKUs.map((sku, i) => (
                  <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {sku}
                  </span>
                ))}
              </div>
            )}

            {detectedSKUs.length === 0 && text && (
              <p className="text-[10px] text-muted-foreground italic">⚠ No SKU matches found — manual review needed</p>
            )}

            {/* Error */}
            {msg.error_message && (
              <p className="text-[10px] text-red-500 flex items-center gap-1">
                <AlertCircle size={10} /> {msg.error_message}
              </p>
            )}

            {/* Action: Create Draft SO */}
            <div className="flex items-center justify-end pt-1">
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
