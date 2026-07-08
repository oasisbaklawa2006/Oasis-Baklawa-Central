import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Clock, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { resolveOrderItemFlow } from "@/lib/triad-order-items";
import { withTimeout, isQueryTimeoutError } from "@/lib/query-timeout";

interface AssemblyTVItem {
  id: string;
  order_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  task_type: string | null;
  product?: { name: string; sku: string | null; production_department: string | null } | null;
  order?: { id: string } | null;
}

const REFRESH_MS = 30000;

export default function AssemblyTV() {
  const [items, setItems] = useState<AssemblyTVItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const { data, error: queryError } = await withTimeout(
        supabase
          .from("order_items")
          .select(
            "id, order_id, quantity, actual_packed_qty, production_status, department, task_type, product:products(name, sku, production_department), order:orders(id)",
          )
          .in("production_status", ["pending", "in_progress", "partial_ready", "completed"]),
      );
      if (queryError) throw queryError;
      // No row cap before classification — capping first (e.g. limit(200)) can silently truncate assembly
      // rows out of an unrelated slice of the active queue. Same valid-order join rule as
      // AssemblyManagement.tsx: drop orphan order_items with no matching order row instead of rendering them.
      const assemblyOnly = ((data as any[]) || []).filter((item) => {
        if (!item.order) return false;
        return resolveOrderItemFlow(item) === "FLOW_ASSEMBLY";
      }) as AssemblyTVItem[];
      setItems(assemblyOnly);
      setError(null);
    } catch (err) {
      setError(
        isQueryTimeoutError(err)
          ? "Query timed out"
          : err instanceof Error
            ? err.message
            : "Failed to load assembly queue",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
      setNow(new Date());
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const readyItems = items.filter((i) => i.production_status === "completed");
  const partialItems = items.filter((i) => i.production_status === "partial_ready");
  const pendingItems = items.filter((i) => i.production_status === "pending" || i.production_status === "in_progress");

  const Column = ({
    title,
    icon: Icon,
    items: colItems,
    color,
    blink,
  }: {
    title: string;
    icon: any;
    items: AssemblyTVItem[];
    color: string;
    blink?: boolean;
  }) => (
    <div className="flex flex-col h-full">
      <div className={`px-4 py-3 ${color} flex items-center gap-2 rounded-t-xl`}>
        <Icon size={24} />
        <span className="text-xl font-black uppercase tracking-wider">{title}</span>
        <Badge className="ml-auto bg-white/20 text-white text-lg px-3">{colItems.length}</Badge>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 p-2 bg-black/40 rounded-b-xl min-h-[20vh]">
        {colItems.length === 0 && <p className="text-center text-white/30 text-lg py-8">Empty</p>}
        {colItems.map((item) => {
          const pct = item.quantity > 0 ? Math.round(((item.actual_packed_qty || 0) / item.quantity) * 100) : 0;
          return (
            <div key={item.id} className={`bg-white/10 rounded-xl p-3 border border-white/10 ${blink ? "animate-pulse" : ""}`}>
              <p className="text-white text-lg font-bold truncate overflow-hidden">{item.product?.name || "Unknown"}</p>
              <div className="flex justify-between mt-1">
                <span className="text-white/60 text-sm font-mono">SKU: {item.product?.sku || "N/A"}</span>
                <span className="text-white text-lg font-black">{item.actual_packed_qty ?? 0}/{item.quantity}</span>
              </div>
              <Progress value={pct} className="h-2 mt-2" />
              <p className="text-white/40 text-xs font-mono mt-1">SO#{item.order_id?.slice(0, 8).toUpperCase() ?? "N/A"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h1 className="text-3xl font-black tracking-tight">🧺 ASSEMBLY LIVE BOARD</h1>
        <span className="text-white/50 text-lg font-mono">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
      </div>
      <Badge variant="outline" className="mb-4 border-white/30 text-white/70 text-[10px] uppercase">
        Read-only live queue — internal preview, not yet evidence-validated
      </Badge>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-red-200">
          <AlertTriangle size={18} />
          <span>Failed to load assembly queue: {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-auto xl:h-[70vh]">
        <Column title="Ready" icon={CheckCircle2} items={readyItems} color="bg-emerald-600" blink />
        <Column title="Partial" icon={Package} items={partialItems} color="bg-purple-600" />
        <Column title="Pending / In Progress" icon={Clock} items={pendingItems} color="bg-amber-600" />
      </div>
    </div>
  );
}
