import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Clock, Package, AlertTriangle, Zap } from "lucide-react";
import { getPackDescription, getPrimaryPackWeightKg } from "@/utils/pricing";
import { tvGroupOf } from "@/lib/productProductionDepartments";

// Temporary typed boundary: canonical_department is a governed column added
// by oasis-supabase-core's 20260817090000 taxonomy migration, pending
// regenerated project-wide Supabase definitions (same pattern as
// OperationsController.tsx's productionJobsDb and ReadyGoodsStore.tsx's
// operationsDb).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const productionJobsDb = supabase as unknown as { from: (relation: string) => any };

// production_jobs is the governed production execution authority (RGS
// shortage demand -> create_production_shortage_demand -> production_jobs,
// and the PHH lifecycle RPCs that drive it through accepted/in_production/
// paused/completed). A TV built from `orders`/`order_items` alone -- as this
// module previously was -- never shows a job like an RGS-created shortage
// job unless it happens to also carry `urgent`/`red` priority, because that
// was the only production_jobs query this component ran. Central issue
// (owner runtime report, 2026-08-25): job E3ED28B0 (ARABIC_SWEETS, status
// pending, priority normal) was invisible on this TV for exactly that
// reason. This module now reads production_jobs directly, scoped to this
// TV's canonical department group, for every open job regardless of
// priority; priority only changes visual treatment (flash banner + red
// card), never whether a job appears at all.
type ProductionJobProduct = {
  name: string;
  sku: string | null;
  image_url: string | null;
  uom: string | null;
  net_weight_grams: number | null;
  avg_weight_per_pack: number | null;
  category: string | null;
  sub_category: string | null;
  packs_per_master_carton: number | null;
  pcs_per_master_carton: number | null;
  moq: number | null;
} | null;

interface ProductionJobRow {
  id: string;
  order_id: string | null;
  assigned_qty: number;
  produced_qty: number | null;
  priority: string;
  status: string;
  department: string | null;
  created_at: string | null;
  product: ProductionJobProduct;
}

interface OrderLookup {
  id: string;
  company: { business_name: string } | null;
}

interface FactoryTVModuleProps {
  category: string;
  departmentFilter: string;
  title: string;
}

const REFRESH_INTERVAL = 30_000;
const OPEN_STATUSES = ["pending", "accepted", "in_production", "paused"];

const FactoryTVModule = ({ category, departmentFilter, title }: FactoryTVModuleProps) => {
  const [jobs, setJobs] = useState<ProductionJobRow[]>([]);
  const [orderLookup, setOrderLookup] = useState<Map<string, OrderLookup>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const tvGroup = tvGroupOf(departmentFilter);

  const fetchJobs = useCallback(async () => {
    if (!tvGroup) {
      setError(`Unrecognised department filter: ${departmentFilter}`);
      setLoading(false);
      return;
    }

    const { data, error: jobsError } = await productionJobsDb
      .from("production_jobs")
      .select(
        "id, order_id, assigned_qty, produced_qty, priority, status, department, created_at, product:products(name, sku, image_url, uom, net_weight_grams, avg_weight_per_pack, category, sub_category, packs_per_master_carton, pcs_per_master_carton, moq)",
      )
      .eq("canonical_department", tvGroup)
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: true });

    if (jobsError) {
      console.error("TV fetch error:", jobsError);
      setError(jobsError.message);
      setLoading(false);
      return;
    }

    const rows = (data as unknown as ProductionJobRow[]) ?? [];
    setJobs(rows);
    setError(null);

    const orderIds = Array.from(new Set(rows.map((r) => r.order_id).filter((id): id is string => !!id)));
    if (orderIds.length > 0) {
      const { data: orderRows, error: orderErr } = await supabase
        .from("orders")
        .select("id, company:companies(business_name)")
        .in("id", orderIds);
      if (!orderErr && orderRows) {
        setOrderLookup(new Map((orderRows as unknown as OrderLookup[]).map((o) => [o.id, o])));
      }
    } else {
      setOrderLookup(new Map());
    }

    setLastRefresh(new Date());
    setLoading(false);
  }, [tvGroup, departmentFilter]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const urgentJobs = jobs.filter((j) => j.priority === "urgent" || j.priority === "red");
  const totalAssigned = jobs.reduce((s, j) => s + (j.assigned_qty ?? 0), 0);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-[100]">
        <Loader2 size={64} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-900 text-white z-[100] flex flex-col items-center justify-center gap-4">
        <AlertTriangle size={64} className="text-red-500" />
        <p className="text-2xl font-bold">Could not load {title}</p>
        <p className="text-gray-400">{error}</p>
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
            <p className="text-sm text-gray-400">Open Jobs</p>
            <p className="text-5xl font-black text-emerald-400">{jobs.length}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Assigned</p>
            <p className="text-5xl font-black text-amber-400">{totalAssigned}</p>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm ml-4">
            <RefreshCw size={14} className="animate-spin" style={{ animationDuration: "4s" }} />
            <span>
              {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </header>

      {/* Urgent Jobs Flash Banner -- affects visual priority only; every job
          below (urgent or not) already appears in the main grid. */}
      {urgentJobs.length > 0 && (
        <div className="bg-red-600 px-8 py-3 flex items-center gap-4 animate-pulse shrink-0" style={{ animationDuration: "1.5s" }}>
          <Zap size={28} className="text-white shrink-0" />
          <div className="flex gap-6 overflow-x-auto flex-1">
            {urgentJobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 shrink-0">
                <span className={`px-2 py-0.5 rounded text-xs font-black uppercase ${job.priority === "red" ? "bg-white text-red-600" : "bg-amber-400 text-black"}`}>
                  {job.priority}
                </span>
                <span className="text-white font-bold text-lg">{job.product?.name || "Unknown"}</span>
                <span className="text-white/80 text-lg font-black">×{job.assigned_qty}</span>
              </div>
            ))}
          </div>
          <AlertTriangle size={28} className="text-white shrink-0" />
        </div>
      )}

      {/* Job Grid */}
      <main className="flex-1 overflow-auto p-6">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Package size={80} className="mb-4 opacity-30" />
            <p className="text-3xl font-bold">No Open Production Jobs</p>
            <p className="text-xl mt-2">All caught up for {title}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {jobs.map((job) => {
              const daysSince = job.created_at
                ? Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000)
                : 0;
              const hoursSince = job.created_at
                ? Math.floor((Date.now() - new Date(job.created_at).getTime()) / 3600000)
                : 0;
              const isPriorityUrgent = job.priority === "urgent" || job.priority === "red";
              const isAgingUrgent = hoursSince > 4;
              const isUrgent = isPriorityUrgent || isAgingUrgent;
              const order = job.order_id ? orderLookup.get(job.order_id) : null;
              const remaining = Math.max(0, (job.assigned_qty ?? 0) - (job.produced_qty ?? 0));

              return (
                <div
                  key={job.id}
                  className={`rounded-2xl p-6 flex flex-col gap-4 transition-all ${
                    isUrgent
                      ? "bg-red-900/40 border-2 border-red-500 animate-pulse"
                      : "bg-gray-800 border border-gray-700"
                  }`}
                  style={isUrgent ? { animationDuration: "3s" } : undefined}
                >
                  {/* Job Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-3xl font-black text-white tracking-wide">
                        #{job.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-lg text-gray-400 mt-1">
                        {order?.company?.business_name ?? "RGS / Internal Demand"}
                      </p>
                    </div>
                    <div className="text-right">
                      {isPriorityUrgent && (
                        <div className="flex items-center gap-1 text-red-400 mb-1">
                          <AlertTriangle size={18} />
                          <span className="text-sm font-bold">{job.priority.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock size={14} />
                        <span className="text-sm">{daysSince > 0 ? `${daysSince}d ago` : `${hoursSince}h ago`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Item Row */}
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center bg-gray-900/40 rounded-lg px-4 py-3">
                      <div className="flex-1">
                        <p className="text-xl font-bold text-white truncate">
                          {job.product?.name ?? "Unknown Item"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {job.product ? getPackDescription(job.product) : ""}
                        </p>
                      </div>
                      <span className="text-3xl font-black text-amber-400 ml-4">
                        {job.product?.uom?.toLowerCase() === "kg"
                          ? `${remaining} × ${getPrimaryPackWeightKg(job.product)}kg`
                          : `×${remaining}`}
                      </span>
                    </div>
                  </div>

                  {/* Assigned / Produced KPI */}
                  <div className="bg-gray-900/60 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-lg text-gray-400">Assigned / Produced</span>
                    <span className="text-2xl font-black text-emerald-400">
                      {job.assigned_qty} / {job.produced_qty ?? 0}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="pt-2 border-t border-gray-700">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${
                        job.status === "in_production"
                          ? "bg-blue-900/50 text-blue-300"
                          : job.status === "paused"
                          ? "bg-purple-900/50 text-purple-300"
                          : "bg-emerald-900/50 text-emerald-300"
                      }`}
                    >
                      {job.status.replace(/_/g, " ")}
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
