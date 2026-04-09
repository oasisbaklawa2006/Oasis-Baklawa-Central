import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import StagnancyBadge from "@/components/StagnancyBadge";

interface TVTask {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  product?: { name: string; sku: string | null } | null;
  order?: { created_at: string | null } | null;
}

export default function AssemblyTV() {
  const [tasks, setTasks] = useState<TVTask[]>([]);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("order_items")
      .select("id, order_id, product_id, quantity, actual_packed_qty, production_status, product:products(name, sku), order:orders(created_at)")
      .in("department", ["Packing & Assembly", "Assembly", "Hampers", "Gifts"])
      .neq("department", "3PCS")
      .in("production_status", ["pending", "in_progress", "partial_ready", "completed"])
      .order("production_status", { ascending: true });
    setTasks((data as any[]) || []);
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const panic = tasks.filter(t => {
    if (!t.order?.created_at) return false;
    const hrs = (Date.now() - new Date(t.order.created_at).getTime()) / 3600000;
    return hrs >= 6 && t.production_status !== "completed";
  });
  const pending = tasks.filter(t => t.production_status === "pending");
  const inProcess = tasks.filter(t => t.production_status === "in_progress" || t.production_status === "partial_ready");
  const ready = tasks.filter(t => t.production_status === "completed");

  const renderRow = (t: TVTask, blink = false) => (
    <div key={t.id} className={`flex items-center justify-between px-4 py-3 border-b border-border/30 overflow-hidden ${blink ? "animate-pulse" : ""}`}>
      <div className="flex-1">
        <p className="text-lg font-bold text-foreground truncate">{t.product?.name || "—"}</p>
        <p className="text-sm font-mono text-muted-foreground">SKU: {t.product?.sku || "N/A"} · SO#{t.order_id?.slice(0, 8).toUpperCase()}</p>
      </div>
      <div className="text-right flex items-center gap-4">
        <span className="text-2xl font-black text-foreground">{t.quantity}</span>
        <StagnancyBadge createdAt={t.order?.created_at || null} className="text-sm px-2 py-1" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-4 space-y-4">
      <h1 className="text-3xl font-black tracking-tight text-center text-primary">ASSEMBLY FLOOR — LIVE</h1>
      <p className="text-center text-sm text-muted-foreground">Auto-refreshes every 30 seconds · View Only</p>

      {/* PANIC ZONE */}
      {panic.length > 0 && (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-3">
          <div className="flex items-center gap-2 mb-2 animate-pulse">
            <AlertTriangle className="text-destructive" size={24} />
            <h2 className="text-xl font-black text-destructive">🚨 PANIC — STAGNANT 6h+</h2>
          </div>
          {panic.map(t => renderRow(t, true))}
        </div>
      )}

      {/* PENDING */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
        <h2 className="text-lg font-bold text-amber-600 mb-1">⏳ PENDING ({pending.length})</h2>
        {pending.length === 0 ? <p className="text-sm text-muted-foreground py-2">Clear</p> : pending.map(t => renderRow(t))}
      </div>

      {/* IN PROCESS */}
      <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-3">
        <h2 className="text-lg font-bold text-blue-600 mb-1">🔧 IN PROCESS ({inProcess.length})</h2>
        {inProcess.length === 0 ? <p className="text-sm text-muted-foreground py-2">Clear</p> : inProcess.map(t => renderRow(t))}
      </div>

      {/* READY */}
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
        <h2 className="text-lg font-bold text-emerald-600 mb-1 animate-pulse">✅ READY FOR DISPATCH ({ready.length})</h2>
        {ready.length === 0 ? <p className="text-sm text-muted-foreground py-2">Clear</p> : ready.map(t => renderRow(t, true))}
      </div>
    </div>
  );
}
