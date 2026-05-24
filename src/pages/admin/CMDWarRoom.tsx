import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, RefreshCw, Tag } from "lucide-react";
import { toast } from "sonner";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ShadowClientSection from "@/components/warroom/ShadowClientSection";
import WarRoomOrderCard from "@/components/warroom/WarRoomOrderCard";
import RawIntelligenceTab from "@/components/warroom/RawIntelligenceTab";
import SuggestedOrdersTab from "@/components/warroom/SuggestedOrdersTab";
import AliasDrawer from "@/components/warroom/AliasDrawer";
import { FinanceBoardCard } from "@/components/FinanceBoardCard";
import { CmdOperationalCommPulse } from "@/components/admin/CmdOperationalCommPulse";
import { packetAgeBucket } from "@/components/whatsapp/operatorInboxUtils";

interface OrderItem {
  id?: string;
  quantity: number;
  product_name?: string;
  weight_kg?: number | null;
  matched_alias?: string | null;
  confidence?: number | null;
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
  is_waste?: boolean | null;
  is_duplicate?: boolean | null;
  duplicate_of_order_id?: string | null;
  attachment_urls?: string[];
  min_confidence?: number | null;
}

interface ShadowCompany {
  id: string;
  business_name: string;
  gst_number: string | null;
  phone: string | null;
  fssai_number: string | null;
  registered_address: string | null;
  created_at: string | null;
}

type FilterMode = "all" | "needs_review" | "clear";

const CMDWarRoom = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [rejectedOrders, setRejectedOrders] = useState<Order[]>([]);
  const [shadowCompanies, setShadowCompanies] = useState<ShadowCompany[]>([]);
  const [activeCompanies, setActiveCompanies] = useState<{ id: string; business_name: string }[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [todayOnly, setTodayOnly] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [aliasDrawerOpen, setAliasDrawerOpen] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [triageOrderId, setTriageOrderId] = useState<string | null>(null);
  const [waPulse, setWaPulse] = useState<{ open: number; stale: number } | null>(null);
  const [waPulseError, setWaPulseError] = useState<string | null>(null);

  // Open the alias drawer instantly (single global state, zero-lag).
  const openAliasDrawer = useCallback((token?: string) => {
    setPendingToken(token ? token.trim() : null);
    setAliasDrawerOpen(true);
  }, []);

  const fetchShadowCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, business_name, gst_number, phone, fssai_number, registered_address, created_at")
      .eq("status", "shadow")
      .order("created_at", { ascending: false });
    setShadowCompanies((data as ShadowCompany[]) ?? []);
  }, []);

  const fetchActiveCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, business_name")
      .eq("status", "active")
      .order("business_name");
    setActiveCompanies((data as any) ?? []);
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, created_at, sales_order_value, dispatch_urgency, company_id, total_weight_kg, needs_clarification, is_waste, is_duplicate, duplicate_of_order_id")
      .not("status", "in", '("closed","cancelled")')
      .eq("is_waste", false)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!data) return;

    const companyIds = [...new Set(data.map((o) => o.company_id).filter(Boolean))] as string[];
    let companyMap: Record<string, { name: string; status: string | null; phone: string | null; gst: string | null; address: string | null }> = {};
    if (companyIds.length) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, business_name, status, phone, gst_number, registered_address")
        .in("id", companyIds);
      companies?.forEach((c: any) => {
        companyMap[c.id] = {
          name: c.business_name,
          status: c.status,
          phone: c.phone ?? null,
          gst: c.gst_number ?? null,
          address: c.registered_address ?? null,
        };
      });
    }

    const orderIds = data.map((o) => o.id);
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("order_id")
      .in("order_id", orderIds);
    const complainedOrders = new Set(tickets?.map((t: any) => t.order_id) ?? []);

    const { data: items } = await supabase
      .from("order_items")
      .select("id, order_id, quantity, weight_kg, product_id, notes, products(name, aliases)")
      .in("order_id", orderIds);

    const itemsByOrder: Record<string, OrderItem[]> = {};
    items?.forEach((item: any) => {
      const oid = item.order_id;
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];

      let conf: number | null = null;
      let alias: string | null = null;
      if (item.notes && typeof item.notes === "string") {
        const cMatch = item.notes.match(/conf(?:idence)?[=:]\s*([0-9.]+)/i);
        if (cMatch) conf = Math.min(1, Math.max(0, parseFloat(cMatch[1])));
        const aMatch = item.notes.match(/alias[=:]\s*([^|;,\n]+)/i);
        if (aMatch) alias = aMatch[1].trim();
      }
      if (!alias && item.products?.aliases?.length) {
        alias = item.products.aliases[0];
      }

      itemsByOrder[oid].push({
        id: item.id,
        quantity: item.quantity,
        product_name: item.products?.name,
        weight_kg: item.weight_kg,
        confidence: conf,
        matched_alias: alias,
      });
    });

    // Pull WhatsApp attachments per order from order_attachments (image URLs)
    const { data: attachments } = await supabase
      .from("order_attachments")
      .select("order_id, file_url, attachment_type")
      .in("order_id", orderIds);
    const attByOrder: Record<string, string[]> = {};
    attachments?.forEach((a: any) => {
      const t = (a.attachment_type || "").toLowerCase();
      const url = (a.file_url || "").toLowerCase();
      const looksImage = t.includes("image") || /\.(png|jpe?g|gif|webp)$/i.test(url);
      if (!looksImage) return;
      if (!attByOrder[a.order_id]) attByOrder[a.order_id] = [];
      attByOrder[a.order_id].push(a.file_url);
    });

    setOrders(
      data.map((o) => {
        const list = itemsByOrder[o.id] || [];
        const confidences = list.map((i) => i.confidence).filter((c): c is number => typeof c === "number");
        const minConf = confidences.length ? Math.min(...confidences) : null;
        const cInfo = o.company_id ? companyMap[o.company_id] : null;
        return {
          ...o,
          company_name: cInfo?.name ?? "Unknown",
          company_status: cInfo?.status ?? null,
          company_phone: cInfo?.phone ?? null,
          company_gst: cInfo?.gst ?? null,
          company_address: cInfo?.address ?? null,
          has_complaint: complainedOrders.has(o.id),
          items: list,
          attachment_urls: attByOrder[o.id] || [],
          min_confidence: minConf,
        };
      })
    );
  }, []);

  const fetchWaPulse = useCallback(async () => {
    try {
      setWaPulseError(null);
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_message_packets" as any)
        .select("id, last_message_at")
        .eq("status", "open")
        .limit(800);
      if (error) throw error;
      const rows = (data ?? []) as unknown as { id: string; last_message_at: string }[];
      const now = Date.now();
      let stale = 0;
      for (const r of rows) {
        if (r.last_message_at && packetAgeBucket(r.last_message_at, now) === "stale") stale += 1;
      }
      setWaPulse({ open: rows.length, stale });
    } catch (e: unknown) {
      setWaPulse(null);
      setWaPulseError(e instanceof Error ? e.message : "WhatsApp pulse failed");
    }
  }, []);

  /** Fetch soft-rejected orders (is_waste=true) for the Rejected tab. Lightweight — last 100. */
  const fetchRejectedOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, created_at, sales_order_value, dispatch_urgency, company_id, total_weight_kg, needs_clarification, is_waste, is_duplicate, duplicate_of_order_id")
      .eq("is_waste", true)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data) { setRejectedOrders([]); return; }
    const companyIds = [...new Set(data.map((o) => o.company_id).filter(Boolean))] as string[];
    let companyMap: Record<string, { name: string; status: string | null }> = {};
    if (companyIds.length) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, business_name, status")
        .in("id", companyIds);
      companies?.forEach((c: any) => { companyMap[c.id] = { name: c.business_name, status: c.status }; });
    }
    setRejectedOrders(
      data.map((o) => ({
        ...o,
        company_name: o.company_id ? companyMap[o.company_id]?.name ?? "Unknown" : "Unknown",
        company_status: o.company_id ? companyMap[o.company_id]?.status ?? null : null,
        items: [],
        attachment_urls: [],
        min_confidence: null,
      }))
    );
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchRejectedOrders();
    fetchShadowCompanies();
    fetchActiveCompanies();
    void fetchWaPulse();

    const ordersChannel = "warroom-orders-live";
    const companiesChannel = "warroom-companies-live";
    const itemsChannel = "warroom-items-live";
    removeDuplicateRealtimeChannel(ordersChannel);
    removeDuplicateRealtimeChannel(companiesChannel);
    removeDuplicateRealtimeChannel(itemsChannel);

    const ch1 = supabase
      .channel(ordersChannel)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { fetchOrders(); fetchRejectedOrders(); })
      .subscribe();

    const ch2 = supabase
      .channel(companiesChannel)
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, () => {
        fetchShadowCompanies();
        fetchActiveCompanies();
      })
      .subscribe();

    const ch3 = supabase
      .channel(itemsChannel)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  }, [fetchOrders, fetchRejectedOrders, fetchShadowCompanies, fetchActiveCompanies, fetchWaPulse]);

  const sortedOrders = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    let filtered = todayOnly
      ? orders.filter((o) => o.created_at && new Date(o.created_at) >= startOfToday)
      : orders;

    // Confidence Filter Bar
    if (filterMode !== "all") {
      filtered = filtered.filter((o) => {
        const lowConf = typeof o.min_confidence === "number" && o.min_confidence < 0.9;
        const unmapped =
          !o.company_id ||
          o.company_status === "shadow" ||
          !o.company_name ||
          /unknown/i.test(o.company_name || "");
        const needsReview = lowConf || unmapped || !!o.needs_clarification || !!o.is_duplicate;
        return filterMode === "needs_review" ? needsReview : !needsReview;
      });
    }

    return [...filtered].sort((a, b) => {
      if (a.has_complaint && !b.has_complaint) return -1;
      if (!a.has_complaint && b.has_complaint) return 1;
      if (a.dispatch_urgency === "panic" && b.dispatch_urgency !== "panic") return -1;
      if (a.dispatch_urgency !== "panic" && b.dispatch_urgency === "panic") return 1;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [orders, todayOnly, filterMode]);

  const visibleOrders = sortedOrders.filter((o) => showHidden || !hidden.has(o.id));

  const toggleHide = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const validateAsUnique = useCallback(async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ is_duplicate: false, duplicate_of_order_id: null, status: "draft" })
      .eq("id", orderId);
    if (error) {
      console.error("[War Room] validateAsUnique failed:", error);
      return;
    }
    fetchOrders();
  }, [fetchOrders]);

  const assignClientToOrder = useCallback(async (orderId: string, companyId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ company_id: companyId } as any)
      .eq("id", orderId);
    if (error) {
      toast.error("Failed to assign client");
      return;
    }
    toast.success("Client mapped to order");
    fetchOrders();
  }, [fetchOrders]);

  const buildSO = useCallback(async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "submitted" } as any)
      .eq("id", orderId);
    if (error) {
      toast.error("Failed to build SO");
      return;
    }
    toast.success(`SO #${orderId.slice(0, 8).toUpperCase()} submitted`);
    fetchOrders();
  }, [fetchOrders]);

  // Auto-Pilot: orders ready for one-click bulk submission.
  const autoPilotOrders = useMemo(() => {
    return orders.filter((o) => {
      const mapped = !!o.company_id && o.company_status !== "shadow" && o.company_status !== "draft" && !!o.company_name && !/unknown/i.test(o.company_name || "");
      const highConf = typeof o.min_confidence === "number" && o.min_confidence >= 0.95;
      const clean = !o.needs_clarification && !o.is_duplicate;
      const isDraftStatus = (o.status || "").toLowerCase() === "draft";
      return mapped && highConf && clean && isDraftStatus;
    });
  }, [orders]);

  const processAllClear = useCallback(async () => {
    if (!autoPilotOrders.length || bulkProcessing) return;
    setBulkProcessing(true);
    const ids = autoPilotOrders.map((o) => o.id);
    const { error } = await supabase
      .from("orders")
      .update({ status: "submitted" } as any)
      .in("id", ids);
    setBulkProcessing(false);
    if (error) {
      toast.error("Bulk processing failed");
      return;
    }
    toast.success(`✓ ${ids.length} SOs submitted`);
    fetchOrders();
  }, [autoPilotOrders, bulkProcessing, fetchOrders]);

  const warCommSignals = useMemo(() => {
    const financePressure = orders.filter((o) =>
      ["awaiting_advance", "awaiting_payment", "awaiting_final_payment"].includes((o.status || "").toLowerCase()),
    ).length;
    const dispatchPanic = orders.filter((o) => o.dispatch_urgency === "panic").length;
    return { financePressure, dispatchPanic };
  }, [orders]);

  const counts = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const base = todayOnly
      ? orders.filter((o) => o.created_at && new Date(o.created_at) >= startOfToday)
      : orders;
    let review = 0;
    base.forEach((o) => {
      const lowConf = typeof o.min_confidence === "number" && o.min_confidence < 0.9;
      const unmapped =
        !o.company_id ||
        o.company_status === "shadow" ||
        !o.company_name ||
        /unknown/i.test(o.company_name || "");
      if (lowConf || unmapped || o.needs_clarification || o.is_duplicate) review++;
    });
    return { all: base.length, review, clear: base.length - review };
  }, [orders, todayOnly]);

  return (
    <div className="p-3 sm:p-4 space-y-4 bg-background max-w-full overflow-x-hidden">
      <CmdOperationalCommPulse
        openWhatsappPackets={waPulse?.open ?? 0}
        staleWhatsappPackets={waPulse?.stale ?? 0}
        financePressureOrders={warCommSignals.financePressure}
        dispatchPanicOrders={warCommSignals.dispatchPanic}
        loadError={waPulseError}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base sm:text-xl font-bold text-foreground tracking-tight">
          ⚔️ CMD War Room <span className="hidden sm:inline">— Live Order Battlefield v3</span>
        </h1>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => openAliasDrawer()}
            className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium text-primary hover:opacity-80 transition-colors px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border border-primary/30"
          >
            <Tag size={12} className="sm:hidden" /><Tag size={14} className="hidden sm:inline" />
            <span className="hidden xs:inline sm:inline">Edit Aliases</span>
            <span className="inline xs:hidden sm:hidden">Aliases</span>
          </button>
          {autoPilotOrders.length > 0 && (
            <button
              onClick={processAllClear}
              disabled={bulkProcessing}
              className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold transition-colors px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {bulkProcessing ? "…" : `⚡ ${autoPilotOrders.length}`}
              <span className="hidden sm:inline">{bulkProcessing ? "" : " Clear"}</span>
            </button>
          )}
          <button
            onClick={() => setTodayOnly(!todayOnly)}
            className={`flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium transition-colors px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border ${
              todayOnly
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:text-foreground border-border"
            }`}
          >
            {todayOnly ? "Today" : "All"}
          </button>
          <button
            onClick={() => { fetchOrders(); fetchShadowCompanies(); fetchActiveCompanies(); void fetchWaPulse(); }}
            className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border border-border"
            aria-label="Refresh"
          >
            <RefreshCw size={12} className="sm:hidden" /><RefreshCw size={14} className="hidden sm:inline" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border"
          >
            {showHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            {showHidden ? "Hide Minimized" : `Show Minimized (${hidden.size})`}
          </button>
        </div>
      </div>

      {/* Shadow Client Verification Section — collapsible on mobile */}
      {shadowCompanies.length > 0 && (
        <details className="md:hidden rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden" open={false}>
          <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-amber-700 flex items-center justify-between list-none">
            <span>📩 WhatsApp Lead Verification ({shadowCompanies.length} pending)</span>
            <span className="text-[10px] opacity-70">Tap to expand</span>
          </summary>
          <div className="p-2">
            <ShadowClientSection companies={shadowCompanies} onRefresh={() => { fetchShadowCompanies(); fetchOrders(); }} />
          </div>
        </details>
      )}
      <div className="hidden md:block">
        <ShadowClientSection companies={shadowCompanies} onRefresh={() => { fetchShadowCompanies(); fetchOrders(); }} />
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <FinanceBoardCard />
      </div>

      <Tabs defaultValue="battlefield" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="battlefield" className="flex-1">Live Battlefield</TabsTrigger>
          <TabsTrigger value="raw" className="flex-1">Raw Intelligence</TabsTrigger>
          <TabsTrigger value="rejected" className="flex-1">
            Rejected{rejectedOrders.length > 0 && <span className="ml-1 text-[10px] opacity-70">({rejectedOrders.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="suggested" className="flex-1">Suggested Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="battlefield">
          {/* Confidence Filter Bar */}
          <div className="flex items-center gap-2 mb-3">
            {([
              { key: "all", label: "ALL", count: counts.all },
              { key: "needs_review", label: "NEEDS REVIEW", count: counts.review },
              { key: "clear", label: "CLEAR ORDERS", count: counts.clear },
            ] as { key: FilterMode; label: string; count: number }[]).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterMode(f.key)}
                className={`text-xs font-bold px-3 py-1.5 rounded-md border transition-colors ${
                  filterMode === f.key
                    ? f.key === "needs_review"
                      ? "bg-orange-500 text-white border-orange-500"
                      : f.key === "clear"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {f.label} <span className="opacity-70 ml-1">({f.count})</span>
              </button>
            ))}
          </div>

          {/* AUTO-PILOT — Ready for Approval (green glow) */}
          {autoPilotOrders.length > 0 && (
            <div className="mb-4 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/5 p-3 shadow-[0_0_20px_rgba(16,185,129,0.18)]">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-2">
                  ⚡ Ready for Approval
                  <span className="text-[10px] font-semibold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                    {autoPilotOrders.length}
                  </span>
                </h2>
                <button
                  onClick={processAllClear}
                  disabled={bulkProcessing}
                  className="text-[11px] font-bold px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {bulkProcessing ? "Processing…" : `Approve & Build All (${autoPilotOrders.length})`}
                </button>
              </div>
              <div className="space-y-2">
                {autoPilotOrders.map((order) => (
                  <button
                    key={`ap-${order.id}`}
                    onClick={() => setTriageOrderId(order.id)}
                    className="w-full text-left"
                  >
                    <WarRoomOrderCard
                      order={order}
                      isMinimized={true}
                      onToggleMinimize={() => setTriageOrderId(order.id)}
                      companies={activeCompanies}
                      onRefresh={fetchOrders}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {visibleOrders.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-12">No active orders in the pipeline.</p>
          )}
          <div className="space-y-2">
            {visibleOrders
              .filter((o) => !autoPilotOrders.some((ap) => ap.id === o.id))
              .map((order) => (
                <button
                  key={order.id}
                  onClick={() => setTriageOrderId(order.id)}
                  className="w-full text-left"
                >
                  <WarRoomOrderCard
                    order={order}
                    isMinimized={true}
                    onToggleMinimize={() => setTriageOrderId(order.id)}
                    companies={activeCompanies}
                    onRefresh={fetchOrders}
                  />
                </button>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="raw">
          <RawIntelligenceTab />
        </TabsContent>

        <TabsContent value="rejected">
          {rejectedOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">No rejected messages.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                These messages were soft-rejected and hidden from the active queue. Records remain in the database for audit. Click <span className="font-semibold">Restore</span> to send back to the battlefield.
              </p>
              {rejectedOrders.map((order) => (
                <WarRoomOrderCard
                  key={`rj-${order.id}`}
                  order={order}
                  isMinimized={false}
                  onToggleMinimize={() => {}}
                  isRejected
                  onRefresh={() => { fetchRejectedOrders(); fetchOrders(); }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="suggested">
          <SuggestedOrdersTab activeCompanies={activeCompanies} />
        </TabsContent>
      </Tabs>

      <AliasDrawer
        open={aliasDrawerOpen}
        onOpenChange={(v) => { setAliasDrawerOpen(v); if (!v) setPendingToken(null); }}
        pendingToken={pendingToken}
        onAliasesChanged={fetchOrders}
      />

      {/* Floating triage modal — replaces inline expansion so list stays stable */}
      <Dialog open={!!triageOrderId} onOpenChange={(v) => !v && setTriageOrderId(null)}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Order Triage</DialogTitle>
          </DialogHeader>
          {(() => {
            const o = [...orders, ...rejectedOrders].find((x) => x.id === triageOrderId);
            if (!o) return null;
            return (
              <WarRoomOrderCard
                order={o}
                isMinimized={false}
                onToggleMinimize={() => setTriageOrderId(null)}
                onValidateAsUnique={() => { validateAsUnique(o.id); setTriageOrderId(null); }}
                companies={activeCompanies}
                onAssignClient={assignClientToOrder}
                onBuildSO={async (id) => { await buildSO(id); setTriageOrderId(null); }}
                onTeachSku={(token) => openAliasDrawer(token)}
                onEditAliases={() => openAliasDrawer()}
                onRefresh={fetchOrders}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CMDWarRoom;
