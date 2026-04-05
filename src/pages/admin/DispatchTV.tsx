import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import StagnancyBadge from "@/components/StagnancyBadge";

interface TVOrder {
  id: string;
  status: string;
  created_at: string | null;
  company?: { business_name: string } | null;
  items: { quantity: number; actual_packed_qty: number | null; production_status: string | null; product?: { name: string; sku: string | null } | null }[];
}

export default function DispatchTV() {
  const [orders, setOrders] = useState<TVOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, created_at, company:companies(business_name)")
      .in("status", ["in_production", "partial_ready", "packed_ready", "approved"])
      .order("created_at", { ascending: true });

    const result: TVOrder[] = [];
    for (const o of (data || [])) {
      const { data: items } = await supabase
        .from("order_items")
        .select("quantity, actual_packed_qty, production_status, product:products(name, sku)")
        .eq("order_id", o.id);
      result.push({ ...o, items: (items as any[]) || [] } as TVOrder);
    }
    setOrders(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const getZone = (order: TVOrder) => {
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
    const packedQty = order.items.reduce((s, i) => s + (i.actual_packed_qty || 0), 0);
    const pct = totalQty > 0 ? (packedQty / totalQty) * 100 : 0;

    // Stagnancy check
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowIST = Date.now() + IST_OFFSET;
    const createdIST = order.created_at ? new Date(order.created_at).getTime() + IST_OFFSET : nowIST;
    const hours = (nowIST - createdIST) / 3600000;

    if (pct >= 100) return "packed";
    if (hours >= 6) return "panic";
    if (hours >= 4 || pct < 30) return "urgent";
    return "normal";
  };

  const zones = {
    panic: orders.filter(o => getZone(o) === "panic"),
    urgent: orders.filter(o => getZone(o) === "urgent"),
    normal: orders.filter(o => getZone(o) === "normal"),
    packed: orders.filter(o => getZone(o) === "packed"),
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-950"><Loader2 className="animate-spin text-white" size={40} /></div>;

  const renderCard = (order: TVOrder, zone: string) => {
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
    const readyQty = order.items.reduce((s, i) => s + (i.actual_packed_qty || 0), 0);
    const pct = totalQty > 0 ? Math.round((readyQty / totalQty) * 100) : 0;

    return (
      <div key={order.id} className={`rounded-xl p-4 border ${zone === "panic" ? "bg-red-950 border-red-700 animate-pulse" : zone === "urgent" ? "bg-amber-950 border-amber-700" : zone === "packed" ? "bg-emerald-950 border-emerald-600 animate-pulse" : "bg-slate-900 border-slate-700"}`}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-lg font-black text-white">SO#{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm text-slate-400">{order.company?.business_name || "N/A"}</p>
          </div>
          <StagnancyBadge createdAt={order.created_at} />
        </div>
        <Progress value={pct} className="h-3 mb-2" />
        <div className="flex justify-between text-xs text-slate-400">
          <span>Ready: {readyQty}/{totalQty}</span>
          <span className="font-bold text-white">{pct}%</span>
        </div>
        <div className="mt-2 space-y-1">
          {order.items.slice(0, 4).map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs">
              <span className="text-slate-300 truncate max-w-[60%]">{item.product?.name || "?"}</span>
              <span className="text-slate-400 font-mono">{item.actual_packed_qty || 0}/{item.quantity}</span>
            </div>
          ))}
          {order.items.length > 4 && <p className="text-[10px] text-slate-500">+{order.items.length - 4} more items</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-white tracking-tight">📦 DISPATCH TV</h1>
        <Badge className="bg-slate-800 text-slate-300 text-sm">{orders.length} Active</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* PANIC */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-red-500" size={18} />
            <h2 className="text-lg font-black text-red-500">🔴 PANIC ({zones.panic.length})</h2>
          </div>
          <div className="space-y-3">{zones.panic.map(o => renderCard(o, "panic"))}</div>
        </div>

        {/* URGENT */}
        <div>
          <h2 className="text-lg font-black text-amber-500 mb-2">🟡 URGENT ({zones.urgent.length})</h2>
          <div className="space-y-3">{zones.urgent.map(o => renderCard(o, "urgent"))}</div>
        </div>

        {/* NORMAL */}
        <div>
          <h2 className="text-lg font-black text-slate-300 mb-2">🟢 NORMAL ({zones.normal.length})</h2>
          <div className="space-y-3">{zones.normal.map(o => renderCard(o, "normal"))}</div>
        </div>

        {/* FULLY PACKED */}
        <div>
          <h2 className="text-lg font-black text-emerald-400 mb-2">✅ FULLY PACKED ({zones.packed.length})</h2>
          <div className="space-y-3">{zones.packed.map(o => renderCard(o, "packed"))}</div>
        </div>
      </div>
    </div>
  );
}
