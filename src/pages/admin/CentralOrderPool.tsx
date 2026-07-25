import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Inbox,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ImageIcon,
  Building2,
  Calendar,
  Phone,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";

interface SuggestedItem {
  product_name: string;
  quantity: number;
  unit?: string | null;
  notes?: string | null;
}

interface SuggestedOrder {
  id: string;
  sender_phone: string;
  sender_name: string | null;
  matched_company_id: string | null;
  shadow_client_id: string | null;
  extracted_business_name: string | null;
  extracted_items: SuggestedItem[];
  extracted_delivery_date: string | null;
  extracted_notes: string | null;
  source_image_url: string | null;
  source_text: string | null;
  ai_confidence: number;
  ai_model: string | null;
  status: string;
  created_at: string;
}

interface Company {
  id: string;
  business_name: string;
}

const STATUS_TABS = [
  { key: "pending_review", label: "Pending Review" },
  { key: "needs_clarification", label: "Needs Clarification" },
  { key: "confirmed", label: "Confirmed" },
  { key: "rejected", label: "Rejected" },
];

export default function CentralOrderPool() {
  const [orders, setOrders] = useState<SuggestedOrder[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending_review");
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [ordersRes, companiesRes] = await Promise.all([
      supabase
        .from("suggested_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("companies").select("id, business_name").order("business_name"),
    ]);
    const rawOrders = (ordersRes.data ?? []) as unknown as Array<Omit<SuggestedOrder, "extracted_items"> & { extracted_items: unknown }>;
    const normalized: SuggestedOrder[] = rawOrders.map((o) => ({
      ...o,
      extracted_items: Array.isArray(o.extracted_items) ? (o.extracted_items as SuggestedItem[]) : [],
    }));
    setOrders(normalized);
    setCompanies((companiesRes.data as Company[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const ch = "central-order-pool";
    removeDuplicateRealtimeChannel(ch);
    const channel = supabase
      .channel(ch)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suggested_orders" },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const filtered = orders.filter((o) => o.status === tab);
  const counts: Record<string, number> = {};
  STATUS_TABS.forEach((s) => (counts[s.key] = orders.filter((o) => o.status === s.key).length));

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const companyName = (id: string | null) =>
    id ? companies.find((c) => c.id === id)?.business_name || "—" : null;

  const handleConfirm = async (order: SuggestedOrder, assignCompanyId: string | null) => {
    void order;
    void assignCompanyId;
    toast.error("Central Pool promotion is retired. Review this intake in Operator Inbox.");
  };

  const handleReject = async (order: SuggestedOrder) => {
    setActingId(order.id);
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("suggested_orders")
      .update({
        status: "rejected",
        reviewed_by: u.user?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    toast.info("Suggestion rejected.");
    setActingId(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-ui-h2 text-foreground flex items-center gap-2">
            <Inbox size={22} className="text-primary" /> Central Order Pool
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            AI-parsed WhatsApp order intents awaiting Operations confirmation.
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {STATUS_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === s.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
            <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
              {counts[s.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No suggestions in this view.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((o) => (
            <SuggestionCard
              key={o.id}
              order={o}
              companies={companies}
              acting={actingId === o.id}
              relativeTime={relativeTime}
              companyName={companyName}
              onConfirm={handleConfirm}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  order,
  companies,
  acting,
  relativeTime,
  companyName,
  onConfirm,
  onReject,
}: {
  order: SuggestedOrder;
  companies: Company[];
  acting: boolean;
  relativeTime: (s: string) => string;
  companyName: (id: string | null) => string | null;
  onConfirm: (o: SuggestedOrder, companyId: string | null) => void;
  onReject: (o: SuggestedOrder) => void;
}) {
  const [assignId, setAssignId] = useState<string>(order.matched_company_id || "");
  const isReviewable = order.status === "pending_review" || order.status === "needs_clarification";
  const confidencePct = Math.round((order.ai_confidence || 0) * 100);
  const confidenceColor =
    confidencePct >= 70 ? "text-emerald-600" : confidencePct >= 40 ? "text-amber-600" : "text-destructive";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {order.extracted_business_name || "Unknown business"}
            </span>
            {!order.matched_company_id && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
                Shadow Client
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone size={10} /> +{order.sender_phone}
            </span>
            {order.sender_name && <span>{order.sender_name}</span>}
            <span>{relativeTime(order.created_at)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-bold ${confidenceColor} flex items-center gap-1 justify-end`}>
            <Sparkles size={10} /> {confidencePct}%
          </div>
          <div className="text-[10px] text-muted-foreground">{order.ai_model || ""}</div>
        </div>
      </div>

      {/* Items */}
      {order.extracted_items.length > 0 ? (
        <div className="bg-background rounded-md border border-border p-2.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Items</p>
          <ul className="space-y-1">
            {order.extracted_items.map((it, i) => (
              <li key={i} className="text-xs text-foreground flex items-center justify-between">
                <span>{it.product_name}</span>
                <span className="font-medium tabular-nums">
                  {it.quantity} {it.unit || ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-[11px] text-amber-600 flex items-center gap-1">
          <AlertTriangle size={11} /> No items extracted
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {order.extracted_delivery_date && (
          <span className="flex items-center gap-1">
            <Calendar size={11} /> Delivery: {order.extracted_delivery_date}
          </span>
        )}
        {order.source_image_url && (
          <a
            href={order.source_image_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <ImageIcon size={11} /> View image
          </a>
        )}
      </div>

      {order.source_text && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Original message
          </summary>
          <pre className="mt-1 whitespace-pre-wrap bg-muted/40 p-2 rounded text-foreground/80">
            {order.source_text}
          </pre>
        </details>
      )}

      {/* Actions */}
      {isReviewable ? (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
          <select
            value={assignId}
            onChange={(e) => setAssignId(e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background flex-1 min-w-[180px]"
          >
            <option value="">— Assign to client —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name}
              </option>
            ))}
          </select>
          <button
            onClick={() => onReject(order)}
            disabled={acting}
            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 disabled:opacity-50"
          >
            <XCircle size={12} /> Reject
          </button>
          <button
            onClick={() => onConfirm(order, assignId || null)}
            disabled={acting || !assignId}
            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {acting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Confirm Order
          </button>
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
          {order.status === "confirmed" && order.matched_company_id && (
            <>Promoted to order for <strong>{companyName(order.matched_company_id)}</strong></>
          )}
          {order.status === "rejected" && <>Rejected</>}
        </div>
      )}
    </div>
  );
}
