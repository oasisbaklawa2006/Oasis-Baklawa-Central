import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, RefreshCw, MessageSquare, Send, FileText, Mic, Image as ImageIcon, Package, Trash2, AlertTriangle, Tag } from "lucide-react";
import { toast } from "sonner";
import { parseBanyanMessage } from "@/lib/banyan-parser";
import { useScopedRealtimeSubscription } from "@/hooks/useScopedRealtimeSubscription";
import { DEBUG_WEBHOOKS_INSERT_UPDATE_CHANGES, type RealtimeDeltaPayload } from "@/lib/realtime";
import AliasDrawer from "./AliasDrawer";

interface RawMessage {
  id: string;
  phone_number: string | null;
  raw_payload: any;
  created_at: string;
  error_message: string | null;
  processed: boolean | null;
  message_intent: string | null;
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
  const [merging, setMerging] = useState<string | null>(null);
  // sender phone (10-digit) → recent shadow/unknown order id available for merge
  const [orphanByPhone, setOrphanByPhone] = useState<Record<string, { orderId: string; createdAt: string }>>({});
  // Alias drawer state — opens with optional pre-filled token from an UNRECOGNIZED SKU.
  const [aliasDrawerOpen, setAliasDrawerOpen] = useState(false);
  const [pendingAliasToken, setPendingAliasToken] = useState<string | null>(null);
  const [intentFilter, setIntentFilter] = useState<string>("");

  // Pull aliases from BOTH sources: (1) product_aliases lookup table,
  // (2) products.aliases[] array column. The merged list is fed to the parser
  // so anything an admin adds via the AliasDrawer is recognized on the next message.
  const fetchAliases = useCallback(async () => {
    const [{ data: lookup }, { data: prodAliasRows }] = await Promise.all([
      supabase.from("product_aliases").select("alias_text, canonical_name"),
      supabase.from("products").select("name, aliases").not("aliases", "is", null),
    ]);
    const merged: AliasMatch[] = [...((lookup as AliasMatch[]) ?? [])];
    (prodAliasRows ?? []).forEach((p: any) => {
      (p.aliases ?? []).forEach((a: string) => {
        if (a && typeof a === "string") {
          merged.push({ alias_text: a, canonical_name: p.name });
        }
      });
    });
    setAliases(merged);
  }, []);

  const openAliasDrawer = useCallback((token?: string | null) => {
    setPendingAliasToken(token ?? null);
    setAliasDrawerOpen(true);
  }, []);

  const fetchOrphans = useCallback(async () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("orders")
      .select("id, created_at, company_id, companies(business_name, phone, status)")
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(40);
    const map: Record<string, { orderId: string; createdAt: string }> = {};
    (data ?? []).forEach((o: any) => {
      const phone = (o.companies?.phone || "").replace(/\D/g, "").slice(-10);
      if (!phone) return;
      const isShadow = !o.companies || o.companies.status === "shadow" || /unknown/i.test(o.companies.business_name || "");
      if (!isShadow) return;
      if (!map[phone] || map[phone].createdAt < o.created_at) {
        map[phone] = { orderId: o.id, createdAt: o.created_at };
      }
    });
    setOrphanByPhone(map);
  }, []);

  const fetchRaw = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("debug_webhooks")
      .select("id, phone_number, raw_payload, created_at, error_message, processed, message_intent")
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(80);

    // Hard metadata filter — hide wamid-only acks, OAuthExceptions, and empty payloads.
    // `message_intent` may exist at runtime; generated `debug_webhooks` Row omits it until types are regenerated.
    const rows = (data ?? []) as unknown as RawMessage[];
    const filtered = rows.filter((m) => {
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

  const handleWebhookDelta = useCallback(
    (payload: RealtimeDeltaPayload) => {
      if (payload.changeEvent === "INSERT") {
        void fetchRaw();
        window.setTimeout(() => void fetchRaw(), 1000);
        void fetchOrphans();
        return;
      }
      void fetchRaw();
    },
    [fetchRaw, fetchOrphans],
  );

  useScopedRealtimeSubscription({
    domain: "debug_webhooks",
    scope: { type: "global_staff" },
    changes: DEBUG_WEBHOOKS_INSERT_UPDATE_CHANGES,
    mode: "invalidate",
    snapshot: async () => {
      await fetchRaw();
      await fetchAliases();
      await fetchOrphans();
    },
    onAcceptedDelta: handleWebhookDelta,
    pollingFallbackMs: 30_000,
  });

  useEffect(() => {
    void fetchRaw();
    void fetchAliases();
    void fetchOrphans();
  }, [fetchRaw, fetchAliases, fetchOrphans]);

  const handleMergeIntoOrphan = async (msg: RawMessage, orphanOrderId: string, candidateName: string) => {
    setMerging(msg.id);
    try {
      const trimmed = candidateName.trim();
      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .ilike("business_name", trimmed)
        .maybeSingle();

      let companyId = (existing as any)?.id as string | undefined;
      if (!companyId) {
        const { data: created, error: insErr } = await supabase
          .from("companies")
          .insert({ business_name: trimmed, status: "shadow" } as any)
          .select("id")
          .single();
        if (insErr || !created) {
          toast.error("Could not create company for merge");
          setMerging(null);
          return;
        }
        companyId = (created as any).id;
      }

      const { error: updErr } = await supabase
        .from("orders")
        .update({ company_id: companyId } as any)
        .eq("id", orphanOrderId);
      if (updErr) {
        toast.error("Failed to merge into prior order");
      } else {
        await supabase
          .from("debug_webhooks")
          .update({ processed: true, error_message: `Merged into order ${orphanOrderId.slice(0, 8)}` } as any)
          .eq("id", msg.id);
        toast.success(`Merged "${trimmed}" into order #${orphanOrderId.slice(0, 8).toUpperCase()}`);
        fetchRaw();
        fetchOrphans();
      }
    } catch {
      toast.error("Merge failed");
    }
    setMerging(null);
  };

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
        const endpointError = data?.error || error?.message || "Failed to create draft order";
        if (String(endpointError).includes("Proxy employee order requires explicit client resolution")) {
          toast.error("Client resolution required for proxy/staff order. Include the client business name before creating Draft SO.");
        } else {
          toast.error(endpointError);
        }
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

  const ALL_INTENTS = [
    "ORDER", "ORDER_MODIFICATION", "ORDER_CANCELLATION", "COMPLAINT",
    "PAYMENT_PROOF", "PURCHASE_ORDER_DOCUMENT", "CLIENT_KYC_DOCUMENT",
    "SO_REFERENCE", "DISPATCH_FOLLOWUP", "PACKAGING_MATERIAL_REQUEST",
    "GENERAL_INQUIRY", "INTERNAL_NOTE", "OTHER",
  ];

  const INTENT_COLORS: Record<string, string> = {
    ORDER:                       "bg-emerald-500/15 text-emerald-700",
    ORDER_MODIFICATION:          "bg-sky-500/15 text-sky-700",
    ORDER_CANCELLATION:          "bg-red-500/15 text-red-700",
    COMPLAINT:                   "bg-red-600/20 text-red-800",
    PAYMENT_PROOF:               "bg-violet-500/15 text-violet-700",
    PURCHASE_ORDER_DOCUMENT:     "bg-amber-500/15 text-amber-700",
    CLIENT_KYC_DOCUMENT:         "bg-amber-400/15 text-amber-600",
    SO_REFERENCE:                "bg-sky-400/15 text-sky-600",
    DISPATCH_FOLLOWUP:           "bg-teal-500/15 text-teal-700",
    PACKAGING_MATERIAL_REQUEST:  "bg-orange-400/15 text-orange-700",
    GENERAL_INQUIRY:             "bg-muted text-muted-foreground",
    INTERNAL_NOTE:               "bg-muted text-muted-foreground",
    OTHER:                       "bg-muted text-muted-foreground",
  };

  const intentLabel = (intent: string | null): string =>
    intent ? intent.replace(/_/g, " ") : "—";

  const unprocessedMessages = messages.filter((m) => !m.processed || m.error_message);
  const failed = intentFilter
    ? unprocessedMessages.filter((m) => (m.message_intent ?? "OTHER") === intentFilter)
    : unprocessedMessages;
  const processed = messages.filter((m) => m.processed && !m.error_message);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {failed.length} inbound message{failed.length !== 1 ? "s" : ""} need attention
          {intentFilter ? ` · filtered: ${intentLabel(intentFilter)}` : ""}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Intent filter */}
          <select
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            className="h-7 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
          >
            <option value="">All intents</option>
            {ALL_INTENTS.map((i) => (
              <option key={i} value={i}>{intentLabel(i)}</option>
            ))}
          </select>
          {intentFilter && (
            <button
              onClick={() => setIntentFilter("")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => openAliasDrawer(null)}
            className="flex items-center gap-1 text-xs text-primary hover:opacity-80 px-2 py-1 rounded border border-primary/30"
            title="Approve / add SKU aliases on the fly"
          >
            <Tag size={12} /> Edit Aliases
          </button>
          <button onClick={fetchRaw} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
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
                  {parsed.candidateCompanyName ? (
                    <>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <span>🏢 {parsed.candidateCompanyName}</span>
                        <span className="text-[9px] font-normal text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">CLIENT</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">via {sender.name} · {sender.phone}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-foreground">{sender.name}</p>
                      <p className="text-[10px] text-muted-foreground">{sender.phone}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap justify-end">
                {msg.message_intent && (
                  <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wide text-[9px] ${INTENT_COLORS[msg.message_intent] ?? INTENT_COLORS.OTHER}`}>
                    {intentLabel(msg.message_intent)}
                  </span>
                )}
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground italic">⚠ No SKU matches found — manual review needed</p>
                <button
                  onClick={() => {
                    // Pre-fill drawer with the first non-trivial word from the message
                    const firstToken = (text.match(/\b[A-Za-z]{3,}\b/) || [])[0] || null;
                    openAliasDrawer(firstToken);
                  }}
                  className="flex items-center gap-1 text-[10px] text-primary hover:opacity-80 px-2 py-0.5 rounded border border-primary/30 flex-shrink-0"
                >
                  <Tag size={10} /> Teach SKU
                </button>
              </div>
            )}

            {/* Error */}
            {msg.error_message && (
              <p className="text-[10px] text-red-500 flex items-center gap-1">
                <AlertCircle size={10} /> {msg.error_message}
              </p>
            )}

            {/* Actions: Merge (if orphan exists for this sender) + Create Draft SO + Mark as Waste */}
            {(() => {
              const phoneKey = (sender.phone || "").replace(/\D/g, "").slice(-10);
              const orphan = phoneKey ? orphanByPhone[phoneKey] : null;
              const canMerge = !!orphan && !!parsed.candidateCompanyName && parsed.matchedSKUs.length === 0;
              return (
                <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                  {canMerge && (
                    <button
                      onClick={() => handleMergeIntoOrphan(msg, orphan!.orderId, parsed.candidateCompanyName!)}
                      disabled={merging === msg.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors px-3 py-1.5 rounded-md border border-amber-500/30 hover:bg-amber-500/10 disabled:opacity-50"
                      title={`Attach "${parsed.candidateCompanyName}" to recent unknown order #${orphan!.orderId.slice(0, 8).toUpperCase()}`}
                    >
                      {merging === msg.id ? <>Merging…</> : <>🔗 Merge into #{orphan!.orderId.slice(0, 8).toUpperCase()}</>}
                    </button>
                  )}
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
              );
            })()}
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

      <AliasDrawer
        open={aliasDrawerOpen}
        onOpenChange={setAliasDrawerOpen}
        pendingToken={pendingAliasToken}
        onAliasesChanged={fetchAliases}
      />
    </div>
  );
}
