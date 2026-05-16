import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Package, Truck, CreditCard, Factory, Box, Hammer, FileText, HeartHandshake, Eye, EyeOff, Image as ImageIcon, X, UserPlus, Pencil, Save, Tag, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeOrderStatus } from "@/utils/orderStatus";

const IST_OFFSET = 5.5 * 3600000;

function relativeTimeIST(dateStr: string | null): string {
  if (!dateStr) return "ΓÇö";
  const nowUtc = Date.now();
  const createdUtc = new Date(dateStr).getTime();
  const diffMs = nowUtc - createdUtc;
  if (diffMs < 0) return "Just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

const STEPS = [
  { key: "draft", label: "Cart / Draft", statuses: ["draft", "cart"], icon: Package },
  { key: "finance", label: "Finance", statuses: ["submitted", "confirmed", "approved"], icon: CreditCard },
  { key: "production", label: "Production", statuses: ["manufacturing", "in_production"], icon: Factory },
  { key: "assembly", label: "Assembly", statuses: ["assembly"], icon: Hammer },
  { key: "packing", label: "Packing", statuses: ["packing", "packed_ready"], icon: Box },
  { key: "billing", label: "Billing", statuses: ["invoice_generated", "awaiting_payment", "payment_cleared"], icon: FileText },
  { key: "security", label: "Dispatch", statuses: ["dispatched", "in_transit"], icon: Truck },
  { key: "support", label: "Delivered", statuses: ["delivered"], icon: HeartHandshake },
];

function getActiveStep(status: string) {
  const s = normalizeOrderStatus(status).replace(/[\s-]/g, "_");
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].statuses.includes(s)) return i;
  }
  return 0;
}

interface OrderItem {
  id?: string;
  quantity: number;
  product_name?: string;
  weight_kg?: number | null;
  matched_alias?: string | null;
  confidence?: number | null;
}

interface CompanyOption {
  id: string;
  business_name: string;
}

interface Order {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  dispatch_urgency: string | null;
  company_id: string | null;
  company_name?: string;
  company_status?: string | null;
  company_phone?: string | null;
  company_gst?: string | null;
  company_address?: string | null;
  has_complaint?: boolean;
  items?: OrderItem[];
  total_weight_kg?: number | null;
  needs_clarification?: boolean | null;
  is_duplicate?: boolean | null;
  duplicate_of_order_id?: string | null;
  attachment_urls?: string[];
  min_confidence?: number | null;
}

interface Props {
  order: Order;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onValidateAsUnique?: () => void;
  /** Companies available for "Assign to Client" dropdown (shadow/unknown only). */
  companies?: CompanyOption[];
  /** Called when admin assigns a client to a shadow/unknown order. */
  onAssignClient?: (orderId: string, companyId: string) => Promise<void> | void;
  /** Called when admin clicks "Build SO" ΓÇö only enabled once client is mapped. */
  onBuildSO?: (orderId: string) => Promise<void> | void;
  /** Open Teach-SKU side drawer with optional pre-fill token (instant). */
  onTeachSku?: (token?: string) => void;
  /** Open Edit-Aliases side drawer (instant). */
  onEditAliases?: () => void;
  /** Refresh callback after inline edits / profile completion. */
  onRefresh?: () => void;
  /** When true, render this card in "rejected" mode ΓÇö show Restore action only. */
  isRejected?: boolean;
}

export default function WarRoomOrderCard({
  order,
  isMinimized,
  onToggleMinimize,
  onValidateAsUnique,
  companies = [],
  onAssignClient,
  onBuildSO,
  onTeachSku,
  onEditAliases,
  onRefresh,
  isRejected = false,
}: Props) {
  const activeStep = getActiveStep(order.status);
  const isPanic = order.dispatch_urgency === "panic";
  const isComplaint = order.has_complaint;
  const isAmbiguous = !!order.needs_clarification;
  const isDuplicate = !!order.is_duplicate || order.status === "potential_duplicate";
  const timeAgo = relativeTimeIST(order.created_at);

  // Shadow / Unknown client detection ΓÇö same trigger used in Central Pool merger.
  const isUnmappedClient =
    !order.company_id ||
    order.company_status === "shadow" ||
    !order.company_name ||
    /unknown/i.test(order.company_name || "");

  const [assignId, setAssignId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [showAiLogic, setShowAiLogic] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [buildingSO, setBuildingSO] = useState(false);

  // Inline qty edit state ΓÇö keyed by order_item id.
  const [editQty, setEditQty] = useState<Record<string, string>>({});
  const [savingQtyId, setSavingQtyId] = useState<string | null>(null);

  // Complete-Profile mini-form state (for Draft / Shadow clients).
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePhone, setProfilePhone] = useState(order.company_phone || "");
  const [profileGst, setProfileGst] = useState(order.company_gst || "");
  const [profileAddr, setProfileAddr] = useState(order.company_address || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Banyan 0.98 ΓÇö anything below this is "Needs Review" (orange) and Build SO is disabled.
  const CONFIDENCE_GATE = 0.98;
  const lowConfidence =
    typeof order.min_confidence === "number" && order.min_confidence < CONFIDENCE_GATE;
  const needsReview = lowConfidence || isAmbiguous;

  // Auto-Pilot detection: high confidence + recognized client + no duplicates/clarification.
  const isAutoPilot =
    !isUnmappedClient &&
    !needsReview &&
    !isDuplicate &&
    typeof order.min_confidence === "number" &&
    order.min_confidence >= CONFIDENCE_GATE;

  // Draft / new-lead detection ΓÇö company exists but is a Draft/Shadow placeholder.
  const isDraftClient =
    !!order.company_id &&
    (order.company_status === "shadow" || order.company_status === "draft");

  // Global per-card action lock ΓÇö prevents double-processing.
  const cardBusy = assigning || buildingSO || savingProfile || !!savingQtyId;

  const tierColor = useMemo(() => {
    if (!order.created_at) return "bg-muted text-muted-foreground";
    const hours = (Date.now() - new Date(order.created_at).getTime()) / 3600000;
    if (hours >= 6) return "bg-red-600 text-white animate-pulse";
    if (hours >= 4) return "bg-amber-500/20 text-amber-600 border border-amber-400/40";
    return "bg-muted text-muted-foreground";
  }, [order.created_at]);

  const handleAssign = async () => {
    if (!assignId || !onAssignClient || cardBusy) return;
    setAssigning(true);
    try {
      await onAssignClient(order.id, assignId);
    } finally {
      setAssigning(false);
    }
  };

  const handleBuild = async () => {
    if (!onBuildSO || isUnmappedClient || cardBusy) return;
    setBuildingSO(true);
    try {
      await onBuildSO(order.id);
    } finally {
      setBuildingSO(false);
    }
  };

  const handleSaveQty = async (itemId: string) => {
    const raw = editQty[itemId];
    const n = Number(raw);
    if (!itemId || !raw || !Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    setSavingQtyId(itemId);
    try {
      const { error } = await supabase
        .from("order_items")
        .update({ quantity: n } as any)
        .eq("id", itemId);
      if (error) throw error;
      toast.success("Quantity updated");
      setEditQty((p) => { const x = { ...p }; delete x[itemId]; return x; });
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update quantity");
    } finally {
      setSavingQtyId(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!order.company_id || cardBusy) return;
    setSavingProfile(true);
    try {
      const payload: any = {};
      if (profilePhone.trim()) payload.phone = profilePhone.trim();
      if (profileGst.trim()) payload.gst_number = profileGst.trim();
      if (profileAddr.trim()) payload.registered_address = profileAddr.trim();
      // Route through governance queue ΓÇö do not promote directly to active.
      payload.status = "pending_approval";
      const { error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", order.company_id);
      if (error) throw error;

      // Create a formal pending application so this client appears in the
      // Client Governance approval queue for slab assignment and activation.
      await supabase.from("b2b_applications").insert({
        business_name: order.company_name || "Unknown",
        gst_number: profileGst.trim() || order.company_gst || null,
        contact_phone: profilePhone.trim() || order.company_phone || null,
        registered_address: profileAddr.trim() || order.company_address || null,
        status: "pending",
        admin_notes: "War Room order card profile ΓÇö pending governance approval",
      } as Parameters<ReturnType<typeof supabase.from>["insert"]>[0]);

      toast.success("Profile saved. Client queued for governance approval in Client Governance.");
      setProfileOpen(false);
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  /** One-click triage: Shadow/Draft ΓåÆ pending_approval, creates governance application. */
  const handleConfirmClient = async () => {
    if (!order.company_id || cardBusy) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ status: "pending_approval" } as any)
        .eq("id", order.company_id);
      if (error) throw error;

      // Create a formal pending application so this client appears in the
      // Client Governance approval queue for slab assignment and activation.
      await supabase.from("b2b_applications").insert({
        business_name: order.company_name || "Unknown",
        gst_number: order.company_gst || null,
        contact_phone: order.company_phone || null,
        registered_address: order.company_address || null,
        status: "pending",
        admin_notes: "War Room order card ΓÇö pending governance approval",
      } as Parameters<ReturnType<typeof supabase.from>["insert"]>[0]);

      toast.success("Client queued for governance approval. Complete activation in Client Governance.");
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to queue client for approval");
    } finally {
      setSavingProfile(false);
    }
  };
  const [rejecting, setRejecting] = useState(false);

  /** Soft-hide an order: flag is_waste=true (kept in DB; filtered from main queue). */
  const handleReject = async () => {
    if (cardBusy || rejecting) return;
    if (!confirm("Reject this message? It will be moved to the Rejected tab (not deleted).")) return;
    setRejecting(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ is_waste: true } as any)
        .eq("id", order.id);
      if (error) throw error;
      toast.success("Moved to Rejected");
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to reject");
    } finally {
      setRejecting(false);
    }
  };

  /** Restore a previously rejected order back to the active queue. */
  const handleRestore = async () => {
    if (rejecting) return;
    setRejecting(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ is_waste: false } as any)
        .eq("id", order.id);
      if (error) throw error;
      toast.success("Order restored to queue");
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to restore");
    } finally {
      setRejecting(false);
    }
  };


  return (
    <>
      <div
        className={`rounded-xl border p-4 transition-all
          ${isDuplicate ? "bg-red-500/5 border-red-600 ring-2 ring-red-500/60 shadow-[0_0_14px_rgba(220,38,38,0.35)]"
            : isComplaint ? "bg-red-500/5 border-red-500/40"
            : isAmbiguous ? "bg-orange-500/5 border-orange-500/50 ring-1 ring-orange-400/40"
            : isPanic ? "border-violet-500/60 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
            : isAutoPilot ? "bg-emerald-500/5 border-emerald-500/40"
            : "bg-card border-border"}
          ${isPanic ? "animate-pulse" : ""}
        `}
        style={isPanic ? { animationDuration: "2s" } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`inline-flex items-center justify-center min-w-[3.5rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${tierColor}`}>
              {timeAgo}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-bold text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
              <span className="ml-2 text-xs text-muted-foreground truncate">{order.company_name}</span>
            </div>
            {isPanic && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} /> PANIC
              </span>
            )}
            {isComplaint && (
              <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">≡ƒÜ¿ COMPLAINT</span>
            )}
            {isDuplicate && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse">
                <AlertTriangle size={10} /> POTENTIAL DUPLICATE
              </span>
            )}
            {isAmbiguous && !isDuplicate && (
              <span className="text-[10px] font-bold text-orange-600 bg-orange-500/10 border border-orange-400/40 px-2 py-0.5 rounded-full">
                ΓÜá AWAITING CLARIFICATION
              </span>
            )}
            {isUnmappedClient && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                UNMAPPED CLIENT
              </span>
            )}
            {isDraftClient && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full">
                <UserPlus size={10} /> NEW CLIENT
              </span>
            )}
            {isAutoPilot && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                Γ£ô AUTO-PILOT READY
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {order.total_weight_kg && order.total_weight_kg > 0 ? (
              <span className="text-sm font-bold text-foreground">
                {order.total_weight_kg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg
              </span>
            ) : (
              <span className="text-sm font-semibold text-foreground">Γé╣{(order.sales_order_value ?? 0).toLocaleString("en-IN")}</span>
            )}
            {isRejected ? (
              <button
                onClick={handleRestore}
                disabled={rejecting}
                title="Restore to active queue"
                className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 border border-emerald-500/30 hover:border-emerald-500/60 rounded px-1.5 py-0.5 disabled:opacity-40"
              >
                <RotateCcw size={11} /> Restore
              </button>
            ) : (
              <button
                onClick={handleReject}
                disabled={cardBusy || rejecting}
                title="Reject (soft-hide; record kept)"
                aria-label="Reject message"
                className="text-muted-foreground hover:text-destructive border border-transparent hover:border-destructive/30 rounded p-1 transition-colors disabled:opacity-40"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button onClick={onToggleMinimize} className="text-muted-foreground hover:text-foreground transition-colors">
              {isMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Duplicate banner + Validate as Unique override */}
            {isDuplicate && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
                <div className="text-[11px] text-red-700 dark:text-red-300">
                  Same SKU + Qty + Client detected within 4 hours
                  {order.duplicate_of_order_id && (
                    <span className="ml-1 font-mono opacity-70">
                      (orig #{order.duplicate_of_order_id.slice(0, 8).toUpperCase()})
                    </span>
                  )}
                  . No SO generated.
                </div>
                {onValidateAsUnique && (
                  <button
                    onClick={onValidateAsUnique}
                    className="text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white px-2.5 py-1 rounded-md hover:bg-red-700 transition-colors whitespace-nowrap"
                  >
                    Validate as Unique
                  </button>
                )}
              </div>
            )}

            {/* Image attachments ΓÇö clickable lightbox */}
            {order.attachment_urls && order.attachment_urls.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {order.attachment_urls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxUrl(url)}
                    className="group relative rounded-md border border-border overflow-hidden hover:ring-2 hover:ring-primary/40 transition-all"
                    title="Click to view full size"
                  >
                    <img
                      src={url}
                      alt={`Attachment ${i + 1}`}
                      className="h-16 w-16 object-cover group-hover:opacity-90 transition-opacity"
                      loading="lazy"
                    />
                    <span className="absolute bottom-0 right-0 bg-black/60 text-white p-0.5 rounded-tl">
                      <ImageIcon size={10} />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Order items ΓÇö inline-editable rows */}
            {order.items && order.items.length > 0 && (
              <div className="mb-2 space-y-1">
                <div className="space-y-1">
                  {order.items.map((item, i) => {
                    const itemId = item.id || "";
                    const isEditing = !!itemId && Object.prototype.hasOwnProperty.call(editQty, itemId);
                    const isSavingThis = savingQtyId === itemId;
                    return (
                      <div key={itemId || i} className="flex items-center justify-between gap-2 text-[11px] bg-muted/40 px-2 py-1 rounded">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                          <span className="text-foreground truncate">{item.product_name || "SKU"}</span>
                          {item.matched_alias && (
                            <span
                              title={`Matched on alias: "${item.matched_alias}"`}
                              className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary/80 bg-primary/5 border border-primary/20 px-1.5 py-0.5 rounded"
                            >
                              <Tag size={8} /> {item.matched_alias}
                            </span>
                          )}
                          {typeof item.confidence === "number" && item.confidence < CONFIDENCE_GATE && (
                            <button
                              onClick={() => onTeachSku?.(item.product_name || item.matched_alias || undefined)}
                              disabled={cardBusy}
                              className="text-[9px] font-bold text-orange-700 bg-orange-500/10 border border-orange-400/40 px-1.5 py-0.5 rounded hover:bg-orange-500/20 disabled:opacity-40"
                              title="Confidence below 98% ΓÇö teach this SKU"
                            >
                              UNRECOGNIZED ┬╖ Teach
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isEditing && itemId ? (
                            <>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                autoFocus
                                value={editQty[itemId]}
                                onChange={(e) => setEditQty((p) => ({ ...p, [itemId]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveQty(itemId);
                                  if (e.key === "Escape") setEditQty((p) => { const x = { ...p }; delete x[itemId]; return x; });
                                }}
                                disabled={cardBusy && !isSavingThis}
                                className="w-16 px-1.5 py-0.5 text-[11px] rounded border border-border bg-background text-right"
                              />
                              <button
                                onClick={() => handleSaveQty(itemId)}
                                disabled={cardBusy && !isSavingThis}
                                className="text-emerald-700 hover:text-emerald-800 disabled:opacity-40"
                                title="Save"
                              >
                                <Save size={12} />
                              </button>
                              <button
                                onClick={() => setEditQty((p) => { const x = { ...p }; delete x[itemId]; return x; })}
                                disabled={isSavingThis}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="font-semibold text-foreground">├ù {item.quantity}</span>
                              {item.weight_kg ? (
                                <span className="text-muted-foreground">┬╖ {Number(item.weight_kg).toLocaleString("en-IN", { maximumFractionDigits: 2 })}kg</span>
                              ) : null}
                              {itemId && (
                                <button
                                  onClick={() => setEditQty((p) => ({ ...p, [itemId]: String(item.quantity) }))}
                                  disabled={cardBusy}
                                  title="Edit quantity"
                                  className="text-muted-foreground hover:text-primary disabled:opacity-40"
                                >
                                  <Pencil size={11} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI Logic Toggle + Teach SKU */}
                <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAiLogic((v) => !v)}
                      className="flex items-center gap-1 text-[10px] text-primary hover:opacity-80"
                    >
                      {showAiLogic ? <EyeOff size={10} /> : <Eye size={10} />}
                      {showAiLogic ? "Hide AI Logic" : "View AI Logic"}
                    </button>
                    {onTeachSku && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const lowItem = order.items?.find((it) => (it.confidence ?? 1) < CONFIDENCE_GATE);
                          const token = lowItem?.product_name || lowItem?.matched_alias || order.items?.[0]?.product_name || undefined;
                          onTeachSku(token);
                        }}
                        disabled={cardBusy}
                        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:opacity-80 disabled:opacity-40 border border-primary/30 hover:border-primary/60 px-1.5 py-0.5 rounded"
                        title="Open the SKU/Alias drawer to teach this term"
                      >
                        <Tag size={10} /> Teach SKU
                      </button>
                    )}
                    {onEditAliases && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditAliases(); }}
                        disabled={cardBusy}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40 border border-border hover:border-foreground/30 px-1.5 py-0.5 rounded"
                      >
                        Edit Aliases
                      </button>
                    )}
                  </div>
                  {typeof order.min_confidence === "number" && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        order.min_confidence >= CONFIDENCE_GATE
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-orange-500/10 text-orange-700"
                      }`}
                    >
                      {Math.round(order.min_confidence * 100)}% conf
                    </span>
                  )}
                </div>

                {showAiLogic && (
                  <div className="rounded-md border border-border bg-background/60 p-2 space-y-1">
                    {order.items.map((item, i) => {
                      const conf = typeof item.confidence === "number" ? item.confidence : null;
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-foreground truncate">{item.product_name || "SKU"}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-muted-foreground italic">
                              alias: {item.matched_alias || "ΓÇö"}
                            </span>
                            <span
                              className={`font-bold px-1.5 py-0.5 rounded ${
                                conf == null
                                  ? "bg-muted text-muted-foreground"
                                  : conf >= 0.9
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : "bg-orange-500/10 text-orange-700"
                              }`}
                            >
                              {conf == null ? "ΓÇö" : `${Math.round(conf * 100)}%`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Complete Profile mini-form (Draft / Shadow / mapped-but-incomplete) */}
            {isDraftClient && order.company_id && (
              <div className="mb-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-sky-700 flex items-center gap-1">
                    <UserPlus size={10} /> NEW LEAD ΓÇö confirm or finish profile to activate
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleConfirmClient}
                      disabled={cardBusy}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                      title="One-click promote Shadow ΓåÆ Active client"
                    >
                      Γ£ô Queue for Approval
                    </button>
                    <button
                      onClick={() => setProfileOpen((v) => !v)}
                      disabled={cardBusy}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40"
                    >
                      {profileOpen ? "Close" : "Complete Profile"}
                    </button>
                  </div>
                </div>
                {profileOpen && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-border bg-background"
                    />
                    <input
                      type="text"
                      placeholder="GST Number"
                      value={profileGst}
                      onChange={(e) => setProfileGst(e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-border bg-background"
                    />
                    <input
                      type="text"
                      placeholder="Address"
                      value={profileAddr}
                      onChange={(e) => setProfileAddr(e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-border bg-background"
                    />
                    <div className="sm:col-span-3 flex justify-end">
                      <button
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="text-[10px] font-semibold px-3 py-1 rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40"
                      >
                        {savingProfile ? "SavingΓÇª" : "Save & Queue for Approval"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assign-to-Client (Central Pool merger) */}
            {isUnmappedClient && onAssignClient && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                <span className="text-[10px] font-bold text-amber-700">Map this order ΓåÆ</span>
                <select
                  value={assignId}
                  onChange={(e) => setAssignId(e.target.value)}
                  disabled={cardBusy}
                  className="text-xs px-2 py-1 rounded border border-border bg-background flex-1 min-w-[160px] disabled:opacity-50"
                >
                  <option value="">ΓÇö Assign to client ΓÇö</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={!assignId || cardBusy}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {assigning ? "AssigningΓÇª" : "Assign"}
                </button>
              </div>
            )}

            {/* Lifecycle: full timeline on ΓëÑsm, single status badge on mobile */}
            <div className="hidden sm:flex items-center gap-0 overflow-x-auto pb-1">
              {STEPS.map((step, i) => {
                const isActive = i === activeStep;
                const isCompleted = i < activeStep;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-center">
                    <div
                      className={`flex flex-col items-center min-w-[72px] px-1.5 py-2 rounded-lg text-center transition-all
                        ${isActive ? "bg-primary/10 ring-1 ring-primary/30" : isCompleted ? "opacity-50" : "opacity-30"}
                      `}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center mb-1
                          ${isActive ? "bg-primary text-primary-foreground animate-pulse" : isCompleted ? "bg-muted-foreground/30 text-background" : "bg-[hsl(30,30%,60%)] text-white/70"}
                        `}
                      >
                        {isCompleted ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                      </div>
                      <span className={`text-[9px] font-medium leading-tight ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="mt-0.5 text-[8px] font-semibold text-primary bg-primary/5 px-1 py-0.5 rounded">CURRENT</span>
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-3 h-[2px] ${i < activeStep ? "bg-muted-foreground/30" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {/* Mobile: single current-status pill */}
            <div className="sm:hidden flex items-center justify-between gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const ActiveIcon = STEPS[activeStep]?.icon || Package;
                  return <ActiveIcon size={14} className="text-primary flex-shrink-0" />;
                })()}
                <span className="text-[11px] font-semibold text-primary truncate">
                  Status: {STEPS[activeStep]?.label || "ΓÇö"}
                </span>
              </div>
              <span className="text-[9px] font-bold text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded flex-shrink-0">
                {activeStep + 1}/{STEPS.length}
              </span>
            </div>

            {/* Build SO ΓÇö final action, gated on client mapping AND Banyan 0.98 confidence. */}
            {onBuildSO && (
              <div className="flex items-center justify-end pt-2 gap-2 flex-wrap">
                {needsReview && (
                  <span className="text-[10px] font-bold text-orange-700 bg-orange-500/10 border border-orange-400/40 px-2 py-1 rounded">
                    ΓÜá NEEDS REVIEW ┬╖ confidence &lt; 98% ΓÇö correct SKUs to enable Build SO
                  </span>
                )}
                <button
                  onClick={handleBuild}
                  disabled={isUnmappedClient || needsReview || cardBusy}
                  title={
                    isUnmappedClient
                      ? "Map a client first to enable Build SO"
                      : needsReview
                      ? "Resolve low-confidence SKUs (Teach SKU) to enable Build SO"
                      : "Generate Sales Order"
                  }
                  className="text-xs font-semibold px-3 py-2.5 sm:py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <FileText size={12} /> {buildingSO ? "BuildingΓÇª" : "Build SO"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-[250] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="Attachment full view"
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
