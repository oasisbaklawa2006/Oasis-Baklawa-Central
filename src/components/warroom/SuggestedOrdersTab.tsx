import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendWhatsAppMessage } from "@/utils/whatsapp";
import { useAuth } from "@/hooks/useAuth";
import {
  CheckCircle2, XCircle, MessageSquare, Loader2, Building2,
  AlertTriangle, Image as ImageIcon, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ─── types ─── */

interface ExtractedItem {
  product_name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  raw_source?: string;
}

interface SuggestedOrder {
  id: string;
  created_at: string;
  sender_phone: string;
  sender_name: string | null;
  extracted_business_name: string | null;
  extracted_items: unknown;
  extracted_delivery_date: string | null;
  extracted_notes: string | null;
  ai_confidence: number | null;
  ai_model: string | null;
  source_image_url: string | null;
  source_text: string | null;
  matched_company_id: string | null;
  shadow_client_id: string | null;
  promoted_order_id: string | null;
  rejection_reason: string | null;
  status: string;
}

interface ActiveCompany {
  id: string;
  business_name: string;
}

interface Props {
  activeCompanies: ActiveCompany[];
}

/* ─── helpers ─── */

function parseItems(raw: unknown): ExtractedItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((it) => ({
    product_name: String(it?.product_name ?? "Unknown item"),
    quantity: typeof it?.quantity === "number" ? it.quantity : null,
    unit: typeof it?.unit === "string" ? it.unit : null,
    notes: typeof it?.notes === "string" ? it.notes : null,
    raw_source: typeof it?.raw_source === "string" ? it.raw_source : undefined,
  }));
}

function confidenceColor(c: number | null): string {
  if (c == null) return "bg-muted text-muted-foreground";
  if (c >= 0.85) return "bg-emerald-500/15 text-emerald-700";
  if (c >= 0.5) return "bg-amber-500/15 text-amber-700";
  return "bg-red-500/15 text-red-700";
}

function relTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function buildClarificationTemplate(row: SuggestedOrder, items: ExtractedItem[]): string {
  const ambiguous = items.filter((i) => i.quantity == null || (i.notes && i.notes.includes("ambiguous")));
  const date = new Date(row.created_at).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const itemLines = ambiguous.length > 0
    ? ambiguous.map((i) => `• ${i.product_name}${i.raw_source ? ` (received as: "${i.raw_source}")` : ""}`)
    : items.map((i) => `• ${i.product_name} × ${i.quantity ?? "?"} ${i.unit ?? ""}`.trim());

  return [
    `Oasis Operations has received your order request dated ${date}.`,
    ``,
    `To proceed, please confirm the following details:`,
    ``,
    ...itemLines,
    ``,
    `Please reply with corrected product names and quantities so we can prepare your draft sales order.`,
    ``,
    `— Oasis Operations`,
  ].join("\n");
}

/* ─── component ─── */

export default function SuggestedOrdersTab({ activeCompanies }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<SuggestedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Promote state
  const [promoting, setPromoting] = useState<string | null>(null);

  // Reject state
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);

  // Clarification dialog state
  const [clarifyTarget, setClarifyTarget] = useState<SuggestedOrder | null>(null);
  const [clarifyMessage, setClarifyMessage] = useState("");
  const [clarifying, setClarifying] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("suggested_orders")
      .select("*")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Failed to load suggested orders");
    } else {
      setRows((data as SuggestedOrder[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  /* ─── Promote to Draft SO ─── */
  const handlePromote = async (row: SuggestedOrder) => {
    if (!row.matched_company_id) {
      toast.error("No matched client. Triage this sender in Shadow Leads first.");
      return;
    }

    // Governance gate: company must be active
    // Governance gate: matched_company_id must appear in the activeCompanies list
    // (CMDWarRoom only fetches companies with status='active'). If not found, the
    // company is not yet active — it may be pending_approval or shadow.
    const company = activeCompanies.find((c) => c.id === row.matched_company_id);
    if (!company) {
      toast.error(
        "Cannot create Draft SO. The matched client is not active. Complete approval in Client Governance first.",
      );
      return;
    }

    setPromoting(row.id);
    try {
      const items = parseItems(row.extracted_items);
      if (items.length === 0) {
        toast.error("Clarification required: no complete order lines were extracted.");
        return;
      }
      const unresolved = items.filter((item) => item.quantity == null || item.quantity <= 0 || !item.unit);
      if (unresolved.length > 0) {
        toast.error("Clarification required: confirm quantity and unit for every item before creating a draft.");
        return;
      }
      const skuItems = items.map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        unit: i.unit,
        confidence: row.ai_confidence ?? 0.5,
      }));

      const { data, error } = await supabase.functions.invoke("admin-create-draft", {
        body: {
          company_id: row.matched_company_id,
          sku_items: skuItems,
          activate_company: false,
        },
      });

      if (error || !data?.ok) {
        toast.error("Draft SO failed: " + (data?.error || error?.message || "Unknown error"));
        return;
      }

      const { error: updateError } = await supabase
        .from("suggested_orders")
        .update({
          status: "confirmed",
          promoted_order_id: data.order_id,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        } as Parameters<ReturnType<typeof supabase.from>["update"]>[0])
        .eq("id", row.id);

      if (updateError) {
        toast.error("Draft SO was created but updating the suggestion failed: " + updateError.message);
        return;
      }

      toast.success(
        `Draft SO #${data.order_id.slice(0, 8).toUpperCase()} created. Review in Live Battlefield.`,
      );
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) ?? "Promote failed");
    } finally {
      setPromoting(null);
    }
  };

  /* ─── Reject ─── */
  const handleReject = async (row: SuggestedOrder) => {
    setRejecting(row.id);
    try {
      const { error: updateError } = await supabase
        .from("suggested_orders")
        .update({
          status: "rejected",
          rejection_reason: rejectReason[row.id]?.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        } as Parameters<ReturnType<typeof supabase.from>["update"]>[0])
        .eq("id", row.id);

      if (updateError) {
        toast.error("Failed to reject suggestion: " + updateError.message);
        return;
      }

      toast.success("Suggestion rejected.");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setRejectTarget(null);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) ?? "Reject failed");
    } finally {
      setRejecting(null);
    }
  };

  /* ─── Open clarification dialog ─── */
  const openClarify = (row: SuggestedOrder) => {
    const items = parseItems(row.extracted_items);
    setClarifyTarget(row);
    setClarifyMessage(buildClarificationTemplate(row, items));
  };

  /* ─── Send clarification (operator-confirmed) ─── */
  const handleSendClarification = async () => {
    if (!clarifyTarget) return;
    setClarifying(true);
    try {
      const result = await sendWhatsAppMessage({
        to: clarifyTarget.sender_phone,
        message: clarifyMessage,
        companyId: clarifyTarget.matched_company_id ?? undefined,
      });

      if (!result.success) {
        toast.error("WhatsApp send failed: " + result.error);
        return;
      }

      const { error: updateError } = await supabase
        .from("suggested_orders")
        .update({
          status: "needs_clarification",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        } as Parameters<ReturnType<typeof supabase.from>["update"]>[0])
        .eq("id", clarifyTarget.id);

      if (updateError) {
        toast.error(
          "Message was sent but updating the suggestion failed: " + updateError.message,
        );
        return;
      }

      toast.success("Clarification message sent via WhatsApp.");
      setRows((prev) => prev.filter((r) => r.id !== clarifyTarget.id));
      setClarifyTarget(null);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) ?? "Send failed");
    } finally {
      setClarifying(false);
    }
  };

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={22} className="animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center space-y-2">
        <CheckCircle2 size={32} className="mx-auto text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No suggested orders pending review.</p>
        <p className="text-xs text-muted-foreground/60">
          The Banyan Parser will surface new suggestions here after processing inbound WhatsApp bundles.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{rows.length}</span> suggestion{rows.length !== 1 ? "s" : ""} awaiting review
          </p>
          <button
            onClick={fetchRows}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 transition-colors"
          >
            Refresh
          </button>
        </div>

        {rows.map((row) => {
          const items = parseItems(row.extracted_items);
          const isExpanded = expanded.has(row.id);
          const matchedCompany = activeCompanies.find((c) => c.id === row.matched_company_id);
          const isRejectOpen = rejectTarget === row.id;
          const conf = row.ai_confidence;

          return (
            <div
              key={row.id}
              className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-start gap-3 p-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Top row: confidence + time */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${confidenceColor(conf)}`}>
                      {conf != null ? `${Math.round(conf * 100)}% confidence` : "No score"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{relTime(row.created_at)}</span>
                    {row.ai_model && (
                      <span className="text-[9px] text-muted-foreground/60 font-mono">{row.ai_model}</span>
                    )}
                  </div>

                  {/* Sender + company */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {row.extracted_business_name || row.sender_name || "Unknown Sender"}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{row.sender_phone}</span>
                  </div>

                  {/* Matched company badge */}
                  {matchedCompany ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
                      <Building2 size={9} />
                      {matchedCompany.business_name}
                    </span>
                  ) : row.matched_company_id ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">
                      <Building2 size={9} /> Matched (not active)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      <AlertTriangle size={9} /> Unresolved client
                    </span>
                  )}

                  {/* Delivery date */}
                  {row.extracted_delivery_date && (
                    <p className="text-[10px] text-muted-foreground">
                      Delivery: <span className="font-medium text-foreground">{row.extracted_delivery_date}</span>
                    </p>
                  )}
                </div>

                {/* Image thumbnail */}
                {row.source_image_url && (
                  <a
                    href={row.source_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <div className="relative w-14 h-14 rounded-lg border border-border overflow-hidden bg-muted hover:ring-2 hover:ring-primary/40 transition-all">
                      <img
                        src={row.source_image_url}
                        alt="Attachment"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute bottom-0 right-0 bg-black/60 text-white p-0.5 rounded-tl">
                        <ImageIcon size={9} />
                      </span>
                    </div>
                  </a>
                )}

                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(row.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 flex-shrink-0"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3 space-y-3">
                  {/* Extracted items */}
                  {items.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Extracted Items
                      </p>
                      <div className="space-y-1">
                        {items.map((item, i) => (
                          <div
                            key={i}
                            className={`flex items-start justify-between gap-2 text-xs rounded-md px-2 py-1.5 ${
                              item.quantity == null
                                ? "bg-red-500/5 border border-red-400/30"
                                : "bg-background border border-border"
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="font-medium text-foreground">{item.product_name}</span>
                              {item.raw_source && (
                                <span className="ml-1.5 text-[10px] text-muted-foreground italic">
                                  ("{item.raw_source}")
                                </span>
                              )}
                              {item.notes && (
                                <span className="ml-1.5 text-[10px] text-amber-600 font-medium">
                                  [{item.notes}]
                                </span>
                              )}
                            </div>
                            <span className="flex-shrink-0 font-semibold text-foreground tabular-nums">
                              {item.quantity != null ? `× ${item.quantity}` : <span className="text-red-600">qty?</span>}
                              {item.unit && <span className="text-muted-foreground ml-0.5">{item.unit}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No items extracted.</p>
                  )}

                  {/* Source text */}
                  {row.source_text && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Source Text
                      </p>
                      <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-md px-3 py-2 whitespace-pre-wrap max-h-24 overflow-y-auto">
                        {row.source_text.slice(0, 600)}{row.source_text.length > 600 ? "…" : ""}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {row.extracted_notes && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Note: {row.extracted_notes}
                    </p>
                  )}
                </div>
              )}

              {/* Action bar */}
              <div className="border-t border-border px-4 py-3 bg-card flex flex-col gap-2">
                {/* Reject inline form */}
                {isRejectOpen && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rejectReason[row.id] ?? ""}
                      onChange={(e) =>
                        setRejectReason((p) => ({ ...p, [row.id]: e.target.value }))
                      }
                      placeholder="Rejection reason (optional)"
                      className="flex-1 text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => handleReject(row)}
                      disabled={rejecting === row.id}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                    >
                      {rejecting === row.id ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => setRejectTarget(null)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Primary buttons */}
                {!isRejectOpen && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Promote */}
                    <button
                      onClick={() => handlePromote(row)}
                      disabled={promoting === row.id}
                      title={
                        !row.matched_company_id
                          ? "No matched client — triage in Shadow Leads first"
                          : !matchedCompany
                          ? "Client not yet active — approve in Client Governance first"
                          : "Create Draft SO in Live Battlefield"
                      }
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {promoting === row.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={11} />
                      )}
                      Promote to Draft SO
                    </button>

                    {/* Request Clarification */}
                    <button
                      onClick={() => openClarify(row)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors"
                    >
                      <MessageSquare size={11} /> Request Clarification
                    </button>

                    {/* Reject */}
                    <button
                      onClick={() => setRejectTarget(row.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors ml-auto"
                    >
                      <XCircle size={11} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Request Clarification Dialog ─── */}
      <Dialog open={!!clarifyTarget} onOpenChange={(open) => { if (!open) setClarifyTarget(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare size={16} className="text-primary" />
              Request Clarification via WhatsApp
            </DialogTitle>
          </DialogHeader>

          {clarifyTarget && (
            <div className="space-y-4 mt-2">
              {/* Recipient info */}
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sending to</p>
                <p className="text-sm font-semibold text-foreground font-mono">{clarifyTarget.sender_phone}</p>
                {clarifyTarget.sender_name && (
                  <p className="text-xs text-muted-foreground">{clarifyTarget.sender_name}</p>
                )}
              </div>

              {/* Editable message */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Message — review and edit before sending
                </p>
                <textarea
                  rows={10}
                  value={clarifyMessage}
                  onChange={(e) => setClarifyMessage(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <p className="text-[10px] text-muted-foreground">
                This message will be sent via WhatsApp and logged to the client interaction timeline.
                The suggestion will be marked <span className="font-semibold">Needs Clarification</span> and removed from this queue.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={() => setClarifyTarget(null)}
              disabled={clarifying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendClarification}
              disabled={clarifying || !clarifyMessage.trim()}
              className="gap-1.5"
            >
              {clarifying ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <MessageSquare size={14} />
              )}
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
