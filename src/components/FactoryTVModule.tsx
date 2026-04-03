import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Clock, Package, AlertTriangle } from "lucide-react";
import { getPackDescription, getPrimaryPackWeightKg } from "@/utils/pricing";

interface TVOrderItem {
  id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  production_status: string | null;
  product: {
    name: string;
    department: string | null;
    uom: string | null;
    net_weight_grams: number | null;
    avg_weight_per_pack: number | null;
    category: string | null;
    sub_category: string | null;
    packs_per_master_carton: number | null;
    pcs_per_master_carton: number | null;
    moq: number | null;
  } | null;
}

interface TVOrder {
  id: string;
  status: string;
  created_at: string | null;
  company: { business_name: string } | null;
  order_items: TVOrderItem[];
}

interface FactoryTVModuleProps {
  category: string;
  departmentFilter: string;
  title: string;
}

const REFRESH_INTERVAL = 30_000;

const FactoryTVModule = ({ category, departmentFilter, title }: FactoryTVModuleProps) => {
  const [orders, setOrders] = useState<TVOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, created_at, company:companies(business_name), order_items(id, quantity, pack_size, carton_type, production_status, product_id)"
      )
      .in("status", ["in_production", "assembly", "approved"])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("TV fetch error:", error);
      setLoading(false);
      return;
    }

    // Now fetch product details for items and filter by department
    const allOrders = (data as unknown as TVOrder[]) ?? [];

    // For each order, fetch its items' product details and filter
    const enrichedOrders: TVOrder[] = [];

    for (const order of allOrders) {
      const itemIds = order.order_items?.map((i: any) => i.product_id).filter(Boolean) ?? [];
      if (itemIds.length === 0) continue;

      const { data: products } = await supabase
        .from("products")
        .select("id, name, department")
        .in("id", itemIds);

      const productMap = new Map((products ?? []).map((p: any) => [p.id, p]));

      const filteredItems = order.order_items
        .map((item: any) => ({
          ...item,
          product: productMap.get(item.product_id) ?? null,
        }))
        .filter(
          (item: TVOrderItem) =>
            item.product?.department?.toLowerCase().includes(departmentFilter.toLowerCase())
        );

      if (filteredItems.length > 0) {
        enrichedOrders.push({ ...order, order_items: filteredItems });
      }
    }

    setOrders(enrichedOrders);
    setLastRefresh(new Date());
    setLoading(false);
  }, [departmentFilter]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const totalPacks = orders.reduce(
    (s, o) => s + o.order_items.reduce((a, i) => a + (i.quantity ?? 0), 0),
    0
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-[100]">
        <Loader2 size={64} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 text-white z-[100] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-gray-800 border-b-2 border-emerald-500 shrink-0">
        <div className="flex items-center gap-4">
          <Package size={36} className="text-emerald-400" />
          <h1 className="text-4xl font-black tracking-wide uppercase">{title}</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm text-gray-400">Active Orders</p>
            <p className="text-5xl font-black text-emerald-400">{orders.length}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Packs</p>
            <p className="text-5xl font-black text-amber-400">{totalPacks}</p>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm ml-4">
            <RefreshCw size={14} className="animate-spin" style={{ animationDuration: "4s" }} />
            <span>
              {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </header>

      {/* Order Grid */}
      <main className="flex-1 overflow-auto p-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Package size={80} className="mb-4 opacity-30" />
            <p className="text-3xl font-bold">No Active Orders</p>
            <p className="text-xl mt-2">All caught up for {title}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {orders.map((order) => {
              const daysSince = order.created_at
                ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000)
                : 0;
              const hoursSince = order.created_at
                ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 3600000)
                : 0;
              const isUrgent = hoursSince > 4;
              const orderPacks = order.order_items.reduce((s, i) => s + (i.quantity ?? 0), 0);

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl p-6 flex flex-col gap-4 transition-all ${
                    isUrgent
                      ? "bg-red-900/40 border-2 border-red-500 animate-pulse"
                      : "bg-gray-800 border border-gray-700"
                  }`}
                  style={isUrgent ? { animationDuration: "3s" } : undefined}
                >
                  {/* Order Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-3xl font-black text-white tracking-wide">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-lg text-gray-400 mt-1">
                        {order.company?.business_name ?? "Walk-in"}
                      </p>
                    </div>
                    <div className="text-right">
                      {isUrgent && (
                        <div className="flex items-center gap-1 text-red-400 mb-1">
                          <AlertTriangle size={18} />
                          <span className="text-sm font-bold">URGENT</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock size={14} />
                        <span className="text-sm">{daysSince > 0 ? `${daysSince}d ago` : `${hoursSince}h ago`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Packs KPI */}
                  <div className="bg-gray-900/60 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-lg text-gray-400">Total Packs</span>
                    <span className="text-4xl font-black text-emerald-400">{orderPacks}</span>
                  </div>

                  {/* Item List */}
                  <div className="flex-1 space-y-2 overflow-auto max-h-60">
                    {order.order_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center bg-gray-900/40 rounded-lg px-4 py-3"
                      >
                        <div className="flex-1">
                          <p className="text-xl font-bold text-white truncate">
                            {item.product?.name ?? "Unknown Item"}
                          </p>
                          {item.pack_size && (
                            <p className="text-sm text-gray-500">{item.pack_size}</p>
                          )}
                        </div>
                        <span className="text-3xl font-black text-amber-400 ml-4">
                          ×{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Status */}
                  <div className="pt-2 border-t border-gray-700">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${
                        order.status === "in_production"
                          ? "bg-blue-900/50 text-blue-300"
                          : order.status === "assembly"
                          ? "bg-purple-900/50 text-purple-300"
                          : "bg-emerald-900/50 text-emerald-300"
                      }`}
                    >
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer Ticker */}
      <footer className="bg-gray-800 border-t border-gray-700 px-8 py-3 flex items-center justify-between shrink-0">
        <p className="text-sm text-gray-500">
          {title} • Factory TV Module • Auto-refreshes every 30s
        </p>
        <p className="text-sm text-gray-500">
          Oasis Baklawa B2B Platform
        </p>
      </footer>
    </div>
  );
};

export default FactoryTVModule;
