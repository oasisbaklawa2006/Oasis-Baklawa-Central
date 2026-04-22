import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, RefreshCw, Tag } from "lucide-react";
import { toast } from "sonner";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ShadowClientSection from "@/components/warroom/ShadowClientSection";
import WarRoomOrderCard from "@/components/warroom/WarRoomOrderCard";
import RawIntelligenceTab from "@/components/warroom/RawIntelligenceTab";
import AliasDrawer from "@/components/warroom/AliasDrawer";

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
  const [shadowCompanies, setShadowCompanies] = useState<ShadowCompany[]>([]);
  const [activeCompanies, setActiveCompanies] = useState<{ id: string; business_name: string }[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [todayOnly, setTodayOnly] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [aliasDrawerOpen, setAliasDrawerOpen] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

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
    let companyMap: Record<string, { name: string; status: string | null }> = {};
    if (companyIds.length) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, business_name, status")
        .in("id", companyIds);
      companies?.forEach((c: any) => {
        companyMap[c.id] = { name: c.business_name, status: c.status };
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
      .select("order_id, quantity, weight_kg, product_id, notes, products(name, aliases)")
      .in("order_id", orderIds);

    const itemsByOrder: Record<string, OrderItem[]> = {};
    items?.forEach((item: any) => {
      const oid = item.order_id;
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];

      // Soft parse confidence + matched alias from notes (parser may stash JSON tag)
      let conf: number | null = null;
      let alias: string | null = null;
      if (item.notes && typeof item.notes === "string") {
        const cMatch = item.notes.match(/conf(?:idence)?[=:]\s*([0-9.]+)/i);
        if (cMatch) conf = Math.min(1, Math.max(0, parseFloat(cMatch[1])));
        const aMatch = item.notes.match(/alias[=:]\s*([^|;,\n]+)/i);
        if (aMatch) alias = aMatch[1].trim();
      }
      // Fallback: first alias from product if no explicit match
      if (!alias && item.products?.aliases?.length) {
        alias = item.products.aliases[0];
      }

      itemsByOrder[oid].push({
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
          has_complaint: complainedOrders.has(o.id),
          items: list,
          attachment_urls: attByOrder[o.id] || [],
          min_confidence: minConf,
        };
      })
    );
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchShadowCompanies();
    fetchActiveCompanies();

    const ordersChannel = "warroom-orders-live";
    const companiesChannel = "warroom-companies-live";
    const itemsChannel = "warroom-items-live";
    removeDuplicateRealtimeChannel(ordersChannel);
    removeDuplicateRealtimeChannel(companiesChannel);
    removeDuplicateRealtimeChannel(itemsChannel);

    const ch1 = supabase
      .channel(ordersChannel)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
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
  }, [fetchOrders, fetchShadowCompanies, fetchActiveCompanies]);

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
    // Final action: promote draft to submitted (preserves total_weight_kg + SO logic untouched).
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
    <div className="p-4 space-y-4 min-h-screen bg-background">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          ⚔️ CMD War Room — Live Order Battlefield v3
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAliasDrawerOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 transition-colors px-3 py-1.5 rounded-md border border-primary/30"
          >
            <Tag size={14} /> Edit Aliases
          </button>
          <button
            onClick={() => setTodayOnly(!todayOnly)}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-md border ${
              todayOnly
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:text-foreground border-border"
            }`}
          >
            {todayOnly ? "Today Only" : "All Active"}
          </button>
          <button
            onClick={() => { fetchOrders(); fetchShadowCompanies(); fetchActiveCompanies(); }}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border"
          >
            {showHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            {showHidden ? "Hide Minimized" : `Show Minimized (${hidden.size})`}
          </button>
        </div>
      </div>

      {/* Shadow Client Verification Section */}
      <ShadowClientSection companies={shadowCompanies} onRefresh={() => { fetchShadowCompanies(); fetchOrders(); }} />

      <Tabs defaultValue="battlefield" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="battlefield" className="flex-1">Live Battlefield</TabsTrigger>
          <TabsTrigger value="raw" className="flex-1">Raw Intelligence</TabsTrigger>
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

          {visibleOrders.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-12">No active orders in the pipeline.</p>
          )}
          <div className="space-y-3">
            {visibleOrders.map((order) => (
              <WarRoomOrderCard
                key={order.id}
                order={order}
                isMinimized={hidden.has(order.id)}
                onToggleMinimize={() => toggleHide(order.id)}
                onValidateAsUnique={() => validateAsUnique(order.id)}
                companies={activeCompanies}
                onAssignClient={assignClientToOrder}
                onBuildSO={buildSO}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="raw">
          <RawIntelligenceTab />
        </TabsContent>
      </Tabs>

      <AliasDrawer
        open={aliasDrawerOpen}
        onOpenChange={setAliasDrawerOpen}
        pendingToken={null}
      />
    </div>
  );
};

export default CMDWarRoom;
