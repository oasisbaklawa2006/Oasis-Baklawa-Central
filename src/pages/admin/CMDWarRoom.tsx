import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ShadowClientSection from "@/components/warroom/ShadowClientSection";
import WarRoomOrderCard from "@/components/warroom/WarRoomOrderCard";
import RawIntelligenceTab from "@/components/warroom/RawIntelligenceTab";

interface Order {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  dispatch_urgency: string | null;
  company_id: string | null;
  company_name?: string;
  has_complaint?: boolean;
  items?: { quantity: number; product_name?: string }[];
  total_weight_kg?: number | null;
  needs_clarification?: boolean | null;
  is_waste?: boolean | null;
  is_duplicate?: boolean | null;
  duplicate_of_order_id?: string | null;
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

const CMDWarRoom = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shadowCompanies, setShadowCompanies] = useState<ShadowCompany[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [todayOnly, setTodayOnly] = useState(true);

  const fetchShadowCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, business_name, gst_number, phone, fssai_number, registered_address, created_at")
      .eq("status", "shadow")
      .order("created_at", { ascending: false });
    setShadowCompanies((data as ShadowCompany[]) ?? []);
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
    let companyMap: Record<string, string> = {};
    if (companyIds.length) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, business_name")
        .in("id", companyIds);
      companies?.forEach((c) => { companyMap[c.id] = c.business_name; });
    }

    const orderIds = data.map((o) => o.id);
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("order_id")
      .in("order_id", orderIds);
    const complainedOrders = new Set(tickets?.map((t: any) => t.order_id) ?? []);

    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, quantity, product_id, products(name)")
      .in("order_id", orderIds);

    const itemsByOrder: Record<string, { quantity: number; product_name?: string }[]> = {};
    items?.forEach((item: any) => {
      const oid = item.order_id;
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
      itemsByOrder[oid].push({
        quantity: item.quantity,
        product_name: item.products?.name,
      });
    });

    setOrders(
      data.map((o) => ({
        ...o,
        company_name: o.company_id ? companyMap[o.company_id] ?? "Unknown" : "Unknown",
        has_complaint: complainedOrders.has(o.id),
        items: itemsByOrder[o.id] || [],
      }))
    );
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchShadowCompanies();

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
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, () => fetchShadowCompanies())
      .subscribe();

    // Listen to order_items changes so SKU chips refresh instantly
    const ch3 = supabase
      .channel(itemsChannel)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  }, [fetchOrders, fetchShadowCompanies]);

  const sortedOrders = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const filtered = todayOnly
      ? orders.filter((o) => o.created_at && new Date(o.created_at) >= startOfToday)
      : orders;
    return [...filtered].sort((a, b) => {
      if (a.has_complaint && !b.has_complaint) return -1;
      if (!a.has_complaint && b.has_complaint) return 1;
      if (a.dispatch_urgency === "panic" && b.dispatch_urgency !== "panic") return -1;
      if (a.dispatch_urgency !== "panic" && b.dispatch_urgency === "panic") return 1;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [orders, todayOnly]);

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

  return (
    <div className="p-4 space-y-4 min-h-screen bg-background">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          ⚔️ CMD War Room — Live Order Battlefield v3
        </h1>
        <div className="flex items-center gap-2">
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
            onClick={() => { fetchOrders(); fetchShadowCompanies(); }}
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
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="raw">
          <RawIntelligenceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CMDWarRoom;
