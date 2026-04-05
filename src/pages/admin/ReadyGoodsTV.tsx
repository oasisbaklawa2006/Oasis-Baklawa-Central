import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

export default function ReadyGoodsTV() {
  const [items, setItems] = useState<TVItem[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id, order_id, quantity, actual_packed_qty, production_status, product:products(name, sku)")
      .in("department", ["Ready Goods", "Packing & Assembly", "3rd Party"])
      .in("production_status", ["pending", "in_progress", "partial_ready", "completed"])
      .order("production_status", { ascending: true });
    setItems((orderItems as any[]) || []);

    // Low stock: products with factory_inventory < 10
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

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-emerald-400" size={48} /></div>;

  const Column = ({ title, icon: Icon, items: colItems, color, blink }: { title: string; icon: any; items: TVItem[]; color: string; blink?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className={`px-4 py-3 ${color} flex items-center gap-2 rounded-t-xl`}>
        <Icon size={24} />
        <span className="text-xl font-black uppercase tracking-wider">{title}</span>
        <Badge className="ml-auto bg-white/20 text-white text-lg px-3">{colItems.length}</Badge>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-black/40 rounded-b-xl">
        {colItems.length === 0 && <p className="text-center text-white/30 text-lg py-8">Empty</p>}
        {colItems.map(item => (
          <div key={item.id} className={`bg-white/10 rounded-xl p-3 border border-white/10 ${blink ? "animate-pulse" : ""}`}>
            <p className="text-white text-lg font-bold truncate">{item.product?.name || "Unknown"}</p>
            <div className="flex justify-between mt-1">
              <span className="text-white/60 text-sm font-mono">SKU: {item.product?.sku || "N/A"}</span>
              <span className="text-white text-lg font-black">{item.actual_packed_qty ?? 0}/{item.quantity}</span>
            </div>
            <p className="text-white/40 text-xs font-mono mt-1">SO#{item.order_id?.slice(0, 8).toUpperCase()}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-black tracking-tight">📦 RGS LIVE BOARD</h1>
        <span className="text-white/50 text-lg font-mono">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
      </div>

      <div className="grid grid-cols-4 gap-3 h-[calc(100vh-100px)]">
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
    </div>
  );
}
