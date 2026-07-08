import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Truck, PackageCheck, ShieldAlert, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { canReleaseOrderToDispatch, getFinanceReleaseBlockers, type FinanceReleaseBlocker } from "@/utils/financeReleaseState";
import { withTimeout, isQueryTimeoutError } from "@/lib/query-timeout";

interface DispatchTVOrderItem {
  id: string;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
}

interface DispatchTVOrder {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  payment_status: string | null;
  advance_paid: number | null;
  advance_required: number | null;
  company?: { business_name: string } | null;
  order_items?: DispatchTVOrderItem[] | null;
}

const REFRESH_MS = 30000;
const TV_DISPLAY_LIMIT = 200;
const DISPATCH_STATUSES = ["packed_ready", "cleared_for_dispatch"];

function financeTraceInput(order: DispatchTVOrder) {
  return {
    status: order.status,
    payment_status: order.payment_status,
    advance_paid: order.advance_paid,
    advance_required: order.advance_required,
    sales_order_value: order.sales_order_value,
  };
}

export default function DispatchTV() {
  const [orders, setOrders] = useState<DispatchTVOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const { data, error: queryError } = await withTimeout(
        supabase
          .from("orders")
          .select(
            "id, status, created_at, sales_order_value, payment_status, advance_paid, advance_required, company:companies(business_name), order_items(id, quantity, actual_packed_qty, production_status)",
          )
          .in("status", DISPATCH_STATUSES)
          .order("created_at", { ascending: true })
          .limit(TV_DISPLAY_LIMIT),
      );
      if (queryError) throw queryError;

      // Cap warning is based on the raw fetched row count (before lane splitting), so it reflects the
      // actual query truncation risk, not just how many rows happened to land in one lane.
      const rows = ((data as any[]) || []) as DispatchTVOrder[];
      setOrders(rows);
      setCoverageWarning(
        rows.length >= TV_DISPLAY_LIMIT
          ? `Showing the oldest ${TV_DISPLAY_LIMIT} packed/dispatch-ready orders. Use Packing & Dispatch for full queue reconciliation.`
          : null,
      );
      setError(null);
    } catch (err) {
      // Clear rows on a failed refresh — this is an operator TV wall, so stale dispatch data displayed
      // as current would be actively misleading.
      setOrders([]);
      setCoverageWarning(null);
      setError(
        isQueryTimeoutError(err)
          ? "Query timed out"
          : err instanceof Error
            ? err.message
            : "Failed to load dispatch queue",
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

  // Same finance-release semantics as AdminPackingDispatch.tsx: canReleaseOrderToDispatch / getFinanceReleaseBlockers.
  const isFinanceBlocked = (order: DispatchTVOrder) => !canReleaseOrderToDispatch(financeTraceInput(order));

  const packedReadyOrders = orders.filter((o) => o.status === "packed_ready");
  const financeBlockedOrders = orders.filter((o) => isFinanceBlocked(o));
  const dispatchReadyOrders = orders.filter((o) => o.status === "cleared_for_dispatch" && !isFinanceBlocked(o));

  const packProgress = (order: DispatchTVOrder) => {
    const items = order.order_items || [];
    const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const packedQty = items.reduce((sum, item) => sum + (item.actual_packed_qty || 0), 0);
    return totalQty > 0 ? Math.round((packedQty / totalQty) * 100) : 0;
  };

  const Column = ({
    title,
    icon: Icon,
    items: colOrders,
    color,
    blink,
    showBlockReason,
  }: {
    title: string;
    icon: any;
    items: DispatchTVOrder[];
    color: string;
    blink?: boolean;
    showBlockReason?: boolean;
  }) => (
    <div className="flex flex-col h-full">
      <div className={`px-4 py-3 ${color} flex items-center gap-2 rounded-t-xl`}>
        <Icon size={24} />
        <span className="text-xl font-black uppercase tracking-wider">{title}</span>
        <Badge className="ml-auto bg-white/20 text-white text-lg px-3">{colOrders.length}</Badge>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 p-2 bg-black/40 rounded-b-xl min-h-[20vh]">
        {colOrders.length === 0 && <p className="text-center text-white/30 text-lg py-8">Empty</p>}
        {colOrders.map((order) => {
          const pct = packProgress(order);
          const blockers: FinanceReleaseBlocker[] = showBlockReason
            ? getFinanceReleaseBlockers(financeTraceInput(order))
            : [];
          return (
            <div key={order.id} className={`bg-white/10 rounded-xl p-3 border border-white/10 ${blink ? "animate-pulse" : ""}`}>
              <p className="text-white text-lg font-bold truncate overflow-hidden">{order.company?.business_name || "Unknown"}</p>
              <div className="flex justify-between mt-1">
                <span className="text-white/60 text-sm font-mono">SO#{order.id.slice(0, 8).toUpperCase()}</span>
                <span className="text-white text-lg font-black">{pct}% packed</span>
              </div>
              <Progress value={pct} className="h-2 mt-2" />
              <p className="text-white/40 text-xs font-mono mt-1">
                ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")} · {order.payment_status || "unknown"}
              </p>
              {showBlockReason && blockers[0] && <p className="text-amber-300 text-xs mt-1">{blockers[0].message}</p>}
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
        <h1 className="text-3xl font-black tracking-tight">🚚 DISPATCH LIVE BOARD</h1>
        <span className="text-white/50 text-lg font-mono">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
      </div>
      <Badge variant="outline" className="mb-4 border-white/30 text-white/70 text-[10px] uppercase">
        Read-only live queue — internal preview, not yet evidence-validated
      </Badge>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-red-200">
          <AlertTriangle size={18} />
          <span>Failed to load dispatch queue: {error}</span>
        </div>
      )}

      {coverageWarning && !error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-amber-100">
          <AlertTriangle size={18} />
          <span>{coverageWarning}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-auto xl:h-[70vh]">
        <Column title="Packed Ready" icon={PackageCheck} items={packedReadyOrders} color="bg-blue-600" />
        <Column title="Dispatch Ready" icon={Truck} items={dispatchReadyOrders} color="bg-emerald-600" blink />
        <Column title="Finance Blocked" icon={ShieldAlert} items={financeBlockedOrders} color="bg-red-700" showBlockReason />
      </div>
    </div>
  );
}
