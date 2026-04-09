import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";

interface TVItem {
  id: string;
  order_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  product?: { name: string; sku: string | null } | null;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string | null;
  computed_stock: number;
}

interface SkuDemand {
  name: string;
  sku: string | null;
  totalNeeded: number;
  totalReady: number;
  orderCount: number;
}

export default function ReadyGoodsTV() {
  const [items, setItems] = useState<TVItem[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id, order_id, quantity, actual_packed_qty, production_status, product:products(name, sku)")
      .in("department", ["Ready Goods", "Packing & Assembly", "Baklava", "Sweets", "Nuts", "Arabic", "Chocolate", "Bakery"])
      .neq("department", "3PCS")
      .in("production_status", ["pending", "in_progress", "partial_ready", "completed"])
      .order("production_status", { ascending: true });
    setItems((orderItems as any[]) || []);

    const { data: invData } = await supabase
      .from("factory_inventory")
      .select("product_id, quantity, product:products(name, sku)")
      .lt("quantity", 10);
    setLowStock((invData || []).map((i: any) => ({
      id: i.product_id,
      name: i.product?.name || "?",
      sku: i.product?.sku || null,
      computed_stock: i.quantity || 0,
    })));

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(() => { fetchData(); setNow(new Date()); }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const readyItems = items.filter(i => i.production_status === "completed");
  const partialItems = items.filter(i => i.production_status === "partial_ready");
  const pendingItems = items.filter(i => i.production_status === "pending" || i.production_status === "in_progress");

  // SKU-wise demand summary across all active (non-completed) items
  const skuDemandMap: Record<string, SkuDemand> = {};
  items.forEach(item => {
    const key = item.product?.sku || item.product?.name || item.id;
    if (!skuDemandMap[key]) {
      skuDemandMap[key] = { name: item.product?.name || "Unknown", sku: item.product?.sku || null, totalNeeded: 0, totalReady: 0, orderCount: 0 };
    }
    skuDemandMap[key].totalNeeded += item.quantity;
    skuDemandMap[key].totalReady += item.actual_packed_qty || 0;
    skuDemandMap[key].orderCount += 1;
  });
  const skuDemand = Object.values(skuDemandMap).sort((a, b) => (b.totalNeeded - b.totalReady) - (a.totalNeeded - a.totalReady));

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-emerald-400" size={48} /></div>;

  const Column = ({ title, icon: Icon, items: colItems, color, blink }: { title: string; icon: any; items: TVItem[]; color: string; blink?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className={`px-4 py-3 ${color} flex items-center gap-2 rounded-t-xl`}>
        <Icon size={24} />
        <span className="text-xl font-black uppercase tracking-wider">{title}</span>
        <Badge className="ml-auto bg-white/20 text-white text-lg px-3">{colItems.length}</Badge>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 p-2 bg-black/40 rounded-b-xl">
        {colItems.length === 0 && <p className="text-center text-white/30 text-lg py-8">Empty</p>}
        {colItems.map(item => {
          const pct = item.quantity > 0 ? Math.round(((item.actual_packed_qty || 0) / item.quantity) * 100) : 0;
          return (
            <div key={item.id} className={`bg-white/10 rounded-xl p-3 border border-white/10 ${blink ? "animate-pulse" : ""}`}>
              <p className="text-white text-lg font-bold truncate overflow-hidden">{item.product?.name || "Unknown"}</p>
              <div className="flex justify-between mt-1">
                <span className="text-white/60 text-sm font-mono">SKU: {item.product?.sku || "N/A"}</span>
                <span className="text-white text-lg font-black">{item.actual_packed_qty ?? 0}/{item.quantity}</span>
              </div>
              <Progress value={pct} className="h-2 mt-2" />
              <p className="text-white/40 text-xs font-mono mt-1">SO#{item.order_id?.slice(0, 8).toUpperCase()}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-black tracking-tight">📦 RGS LIVE BOARD</h1>
        <span className="text-white/50 text-lg font-mono">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
      </div>

      {/* TOP: 3+1 Column Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 h-auto xl:h-[45vh] overflow-hidden">
        <Column title="Ready for Dispatch" icon={CheckCircle2} items={readyItems} color="bg-emerald-600" blink />
        <Column title="Partial Orders" icon={Package} items={partialItems} color="bg-purple-600" />
        <Column title="Pending Production" icon={Clock} items={pendingItems} color="bg-amber-600" />

        {/* LOW STOCK ALERTS */}
        <div className="flex flex-col h-full">
          <div className="px-4 py-3 bg-red-700 flex items-center gap-2 rounded-t-xl">
            <AlertTriangle size={24} />
            <span className="text-xl font-black uppercase tracking-wider">Low Stock</span>
            <Badge className="ml-auto bg-white/20 text-white text-lg px-3">{lowStock.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-black/40 rounded-b-xl">
            {lowStock.length === 0 && <p className="text-center text-white/30 text-lg py-8">All OK</p>}
            {lowStock.map(item => (
              <div key={item.id} className="bg-red-900/40 rounded-xl p-3 border border-red-500/30 animate-pulse">
                <p className="text-white text-lg font-bold truncate">{item.name}</p>
                <div className="flex justify-between mt-1">
                  <span className="text-white/60 text-sm font-mono">SKU: {item.sku || "N/A"}</span>
                  <span className="text-red-300 text-xl font-black">{item.computed_stock} left</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM: SKU-wise Demand Summary Table */}
      <div className="mt-4 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 bg-blue-900/60 flex items-center gap-2">
          <Package size={20} />
          <span className="text-lg font-black uppercase tracking-wider">SKU-Wise Demand Summary</span>
          <Badge className="ml-auto bg-white/20 text-white px-3">{skuDemand.length} SKUs</Badge>
        </div>
        <div className="max-h-[30vh] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-black/80">
              <tr className="border-b border-white/10">
                <th className="px-4 py-2 text-sm font-bold text-white/60">Product</th>
                <th className="px-4 py-2 text-sm font-bold text-white/60">SKU</th>
                <th className="px-4 py-2 text-sm font-bold text-white/60 text-right">Total Needed</th>
                <th className="px-4 py-2 text-sm font-bold text-white/60 text-right">Ready</th>
                <th className="px-4 py-2 text-sm font-bold text-white/60 text-right">Gap</th>
                <th className="px-4 py-2 text-sm font-bold text-white/60 text-right">Orders</th>
              </tr>
            </thead>
            <tbody>
              {skuDemand.map(s => {
                const gap = s.totalNeeded - s.totalReady;
                return (
                  <tr key={s.sku || s.name} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2 text-white text-base font-bold">{s.name}</td>
                    <td className="px-4 py-2 text-white/50 text-sm font-mono">{s.sku || "N/A"}</td>
                    <td className="px-4 py-2 text-white text-base font-bold text-right">{s.totalNeeded}</td>
                    <td className="px-4 py-2 text-emerald-400 text-base font-bold text-right">{s.totalReady}</td>
                    <td className={`px-4 py-2 text-base font-black text-right ${gap > 0 ? "text-red-400" : "text-emerald-400"}`}>{gap}</td>
                    <td className="px-4 py-2 text-white/50 text-sm text-right">{s.orderCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
