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
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  task_type: string | null;
  product?: { name: string; sku: string | null; production_department: string | null } | null;
  order?: { id: string } | null;
}

const REFRESH_MS = 30000;
const TV_DISPLAY_LIMIT = 200;
const ASSEMBLY_DEPARTMENTS = ["Packing & Assembly", "Assembly", "Hampers", "Gifts", "packing_assembly"];
const ACTIVE_ASSEMBLY_STATUSES = ["pending", "in_progress", "partial_ready", "completed"];

export default function AssemblyTV() {
  const [items, setItems] = useState<AssemblyTVItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const { data: assemblyProducts, error: productError } = await withTimeout(
        supabase
          .from("products")
          .select("id")
          .in("production_department", ASSEMBLY_DEPARTMENTS),
      );

      if (productError) throw productError;

      const assemblyProductIds = ((assemblyProducts as Array<{ id: string }> | null) ?? [])
        .map((product) => product.id)
        .filter(Boolean);

      const orderItemQuery = supabase
        .from("order_items")
        .select(
          "id, order_id, product_id, quantity, actual_packed_qty, production_status, department, task_type, product:products(name, sku, production_department), order:orders!inner(id)",
        )
        .in("production_status", ACTIVE_ASSEMBLY_STATUSES)
        .order("id", { ascending: false })
        .limit(TV_DISPLAY_LIMIT);

      const assemblyFilters = [
        `department.in.(${ASSEMBLY_DEPARTMENTS.map((department) => `"${department}"`).join(",")})`,
        ...(assemblyProductIds.length > 0 ? [`product_id.in.(${assemblyProductIds.join(",")})`] : []),
      ];

      const { data, error: queryError } = await withTimeout(orderItemQuery.or(assemblyFilters.join(",")));

      if (queryError) throw queryError;

      // Server-side filters narrow to active assembly candidates before the TV display cap.
      // The resolver remains a final safety check because the canonical flow also considers
      // product production_department and task/dept edge cases. Inner order join prevents SO#N/A orphans.
      const candidateRows = (((data as any[]) || []) as AssemblyTVItem[]);
      const assemblyOnly = candidateRows.filter(
        (item) => item.order && resolveOrderItemFlow(item) === "FLOW_ASSEMBLY",
      );

      setItems(assemblyOnly);
      setCoverageWarning(
        candidateRows.length >= TV_DISPLAY_LIMIT
          ? `Showing ${assemblyOnly.length} assembly rows from the latest ${TV_DISPLAY_LIMIT} matching candidates. Use Assembly Management for full queue reconciliation.`
          : null,
      );
      setError(null);
    } catch (err) {
      // Clear the queue on a failed refresh — this is an operator TV wall, so a stale board showing the
      // last successful load while the error banner says the fetch failed would be actively misleading.
      setItems([]);
      setCoverageWarning(null);
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

      {coverageWarning && !error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-amber-100">
          <AlertTriangle size={18} />
          <span>{coverageWarning}</span>
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
