import { useCallback, useEffect, useState } from "react";
import { Package, Clock, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { withTimeout, isQueryTimeoutError } from "@/lib/query-timeout";
import {
  ASSEMBLY_TV_REFRESH_MS,
  ASSEMBLY_TV_DISPLAY_LIMIT,
  assemblyJobTvProgress,
  classifyAssemblyJobForTvColumn,
  fetchAssemblyJobsForTv,
  fetchProductNamesForAssemblyTv,
  type AssemblyJobTvRow,
  type AssemblyTvColumn,
} from "@/lib/assembly/assemblyJobReadBoundary";

type AssemblyTVDisplayRow = AssemblyJobTvRow & {
  productName: string;
};

export default function AssemblyTV() {
  const [items, setItems] = useState<AssemblyTVDisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const jobs = await withTimeout(fetchAssemblyJobsForTv(ASSEMBLY_TV_DISPLAY_LIMIT));
      const productIds = [...new Set(jobs.map((job) => job.output_product_id).filter(Boolean))];
      const products = await withTimeout(fetchProductNamesForAssemblyTv(productIds));

      const displayRows: AssemblyTVDisplayRow[] = jobs.map((job) => ({
        ...job,
        productName: products[job.output_product_id]?.name ?? job.output_sku,
      }));

      setItems(displayRows);
      setCoverageWarning(
        jobs.length >= ASSEMBLY_TV_DISPLAY_LIMIT
          ? `Showing the latest ${ASSEMBLY_TV_DISPLAY_LIMIT} active assembly jobs. Use Assembly Management for full queue reconciliation.`
          : null,
      );
      setError(null);
    } catch (err) {
      setItems([]);
      setCoverageWarning(null);
      setError(
        isQueryTimeoutError(err)
          ? "Query timed out"
          : err instanceof Error
            ? err.message
            : "Failed to load assembly jobs",
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
    }, ASSEMBLY_TV_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const readyItems = items.filter((item) => classifyAssemblyJobForTvColumn(item.status) === "ready");
  const partialItems = items.filter((item) => classifyAssemblyJobForTvColumn(item.status) === "partial");
  const pendingItems = items.filter((item) => classifyAssemblyJobForTvColumn(item.status) === "pending");

  const Column = ({
    title,
    icon: Icon,
    items: colItems,
    color,
    blink,
    column,
  }: {
    title: string;
    icon: typeof Package;
    items: AssemblyTVDisplayRow[];
    color: string;
    blink?: boolean;
    column: AssemblyTvColumn;
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
          const progress = assemblyJobTvProgress(item);
          const qtyLabel = column === "ready"
            ? `${progress.numerator}/${progress.denominator} accepted`
            : column === "partial"
              ? `${progress.numerator}/${progress.denominator} completed`
              : `${progress.denominator} planned`;
          return (
            <div key={item.id} className={`bg-white/10 rounded-xl p-3 border border-white/10 ${blink ? "animate-pulse" : ""}`}>
              <p className="text-white text-lg font-bold truncate overflow-hidden">{item.productName}</p>
              <div className="flex justify-between mt-1">
                <span className="text-white/60 text-sm font-mono">SKU: {item.output_sku}</span>
                <span className="text-white text-lg font-black">{qtyLabel}</span>
              </div>
              <Progress value={progress.pct} className="h-2 mt-2" />
              <p className="text-white/40 text-xs font-mono mt-1">
                {item.assembly_job_number} · SO#{item.order_id.slice(0, 8).toUpperCase()}
              </p>
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
        Read-only · governed b2b_assembly_jobs authority · no mutations
      </Badge>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-red-200">
          <AlertTriangle size={18} />
          <span>Failed to load assembly jobs: {error}</span>
        </div>
      )}

      {coverageWarning && !error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-amber-100">
          <AlertTriangle size={18} />
          <span>{coverageWarning}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-auto xl:h-[70vh]">
        <Column title="Ready" icon={CheckCircle2} items={readyItems} color="bg-emerald-600" blink column="ready" />
        <Column title="Partial" icon={Package} items={partialItems} color="bg-purple-600" column="partial" />
        <Column title="Pending / In Progress" icon={Clock} items={pendingItems} color="bg-amber-600" column="pending" />
      </div>
    </div>
  );
}
