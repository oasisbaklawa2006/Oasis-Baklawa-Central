import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ClipboardList, Play, Camera, AlertTriangle, Zap } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";
import { normalizeRole } from "@/lib/auth-routing";
import JobIntakeTab from "@/components/phh/JobIntakeTab";
import JobExecutionTab from "@/components/phh/JobExecutionTab";
import QuickEntryTab from "@/components/phh/QuickEntryTab";
import { ProductionJob, HOD_DEPARTMENT_MAP, DEPARTMENTS } from "@/components/phh/types";

// Temporary typed boundary: canonical_department is a governed column added
// by oasis-supabase-core's 20260817090000 taxonomy migration, pending
// regenerated project-wide Supabase definitions (same pattern as
// ReadyGoodsStore.tsx's operationsDb).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const productionJobsDb = supabase as unknown as { from: (relation: string) => any };

const getDepartmentForRole = (role?: string | null) => {
  const n = normalizeRole(role);
  return n ? HOD_DEPARTMENT_MAP[n] ?? null : null;
};

const OperationsController = () => {
  const { user, role } = useAuth();
  const roleDepartment = getDepartmentForRole(role);
  const [loading, setLoading] = useState(true);
  const [myDepartment, setMyDepartment] = useState(roleDepartment ?? "ARABIC_SWEETS");
  const [activeTab, setActiveTab] = useState<"intake" | "execution" | "quick_entry">("intake");
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [urgentCount, setUrgentCount] = useState(0);
  useEffect(() => {
    if (roleDepartment) setMyDepartment(roleDepartment);
  }, [roleDepartment]);

  const deptLabel = DEPARTMENTS.find((d) => d.value === myDepartment)?.label || myDepartment;

  const fetchJobs = useCallback(async () => {
    const { data } = await productionJobsDb
      .from("production_jobs")
      .select("*, product:products(name, image_url, sku), order:orders(id, created_at, status)")
      // canonical_department is trigger-maintained server-side (see
      // canonical_production_department() in oasis-supabase-core) and
      // normalises every legacy department spelling a job's raw `department`
      // column might carry, so this queue is complete regardless of which
      // spelling created the job.
      .eq("canonical_department", myDepartment)
      .in("status", ["pending", "accepted", "in_production", "paused", "completed"])
      .order("created_at", { ascending: true });
    setJobs((data as any[]) || []);
    const urgent = ((data as any[]) || []).filter((j: any) => j.priority === "urgent" || j.priority === "red");
    setUrgentCount(urgent.length);
    setLoading(false);
  }, [myDepartment]);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const pendingCount = jobs.filter((j) => j.status === "pending").length;
  const activeCount = jobs.filter((j) => ["accepted", "in_production", "paused"].includes(j.status)).length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-12 h-12 text-[#B8860B] animate-spin" />
      </div>
    );
  }

  const TABS = [
    { key: "intake" as const, label: "Intake", icon: ClipboardList, badge: pendingCount },
    { key: "execution" as const, label: "Execute", icon: Play, badge: activeCount },
    { key: "quick_entry" as const, label: "Quick Log", icon: Camera, badge: 0 },
  ];

  return (
    <div className="bg-slate-50 min-h-screen pb-safe font-sans">
      <TopNavBar />

      {/* Urgent Flash Banner */}
      {urgentCount > 0 && (
        <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-2 animate-pulse sticky top-16 z-20" style={{ animationDuration: "1.5s" }}>
          <Zap size={16} />
          <span className="text-xs font-black uppercase tracking-wider">
            {urgentCount} URGENT/RED job{urgentCount > 1 ? "s" : ""} awaiting action
          </span>
          <AlertTriangle size={16} className="ml-auto" />
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 text-white pt-24 pb-4 px-4 sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wider uppercase">PHH Engine</h1>
            <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">Production Handheld • {deptLabel}</p>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Department</span>
            {roleDepartment ? (
              <span className="text-xs font-black text-[#B8860B] bg-white/10 px-3 py-2 rounded-lg">{deptLabel}</span>
            ) : (
              <select
                value={myDepartment}
                onChange={(e) => setMyDepartment(e.target.value)}
                className="bg-white/10 border border-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg outline-none"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value} className="text-black">{d.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 relative ${
                  active ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon size={14} />
                {tab.label}
                {tab.badge > 0 && (
                  <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center ${
                    active ? "bg-red-500 text-white" : "bg-red-500/80 text-white"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "intake" && (
          <JobIntakeTab jobs={jobs} userId={user?.id} onRefresh={fetchJobs} />
        )}
        {activeTab === "execution" && (
          <JobExecutionTab jobs={jobs} userId={user?.id} department={myDepartment} onRefresh={fetchJobs} />
        )}
        {activeTab === "quick_entry" && (
          <QuickEntryTab department={myDepartment} departmentLabel={deptLabel} userId={user?.id} />
        )}
      </div>
    </div>
  );
};

export default OperationsController;
