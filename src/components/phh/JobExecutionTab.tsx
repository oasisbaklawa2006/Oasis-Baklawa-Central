import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productionGovernedRpc } from "@/lib/production-lifecycle";
import { rgsGovernedRpc } from "@/lib/rgsGovernedRpc";
import { toast } from "sonner";
import { Loader2, Play, Pause, RotateCcw, Image as ImageIcon, AlertTriangle, Camera, Send, Lock, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductionJob, STAGE_ORDER, STAGE_LABELS, PRIORITY_STYLES, DEPARTMENTS } from "./types";
import { executionFieldsForDepartment } from "./departmentExecutionFields";

// Temporary typed boundary for production_issues, pending regenerated
// project-wide Supabase definitions (same escape-hatch pattern used
// elsewhere in this programme).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const issuesDb = supabase as unknown as { from: (relation: string) => any };

type OpenIssue = {
  id: string;
  job_id: string;
  issue_type: string;
  comment: string;
  created_at: string;
};

interface Props {
  jobs: ProductionJob[];
  userId: string | undefined;
  department: string;
  onRefresh: () => void;
}

export default function JobExecutionTab({ jobs, userId, department, onRefresh }: Props) {
  const [acting, setActing] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [producedQty, setProducedQty] = useState("");
  const [wastedQty, setWastedQty] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [pauseReason, setPauseReason] = useState<string>("");
  const [pauseComment, setPauseComment] = useState("");
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState("material");
  const [issueComment, setIssueComment] = useState("");
  const [executionMetadata, setExecutionMetadata] = useState<Record<string, string>>({});
  const [openIssues, setOpenIssues] = useState<OpenIssue[]>([]);
  const [resolutionNotesById, setResolutionNotesById] = useState<Record<string, string>>({});

  const activeJobs = jobs.filter((j) => ["accepted", "in_production", "paused"].includes(j.status));
  const executionFields = executionFieldsForDepartment(department);
  const departmentLabel = DEPARTMENTS.find((d) => d.value === department)?.label ?? department;

  // resolve_production_issue had zero callers anywhere in Central --
  // report_production_issue (above) closed the report side, but nothing
  // ever fetched or resolved an open issue once reported. Scoped to the
  // currently open job so the same worker/department that's dealing with
  // the job can close out a fixed issue right where they reported it,
  // without a separate admin screen.
  const fetchOpenIssues = useCallback(async (jobId: string) => {
    const { data } = await issuesDb
      .from("production_issues")
      .select("id, job_id, issue_type, comment, created_at")
      .eq("job_id", jobId)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    setOpenIssues((data ?? []) as OpenIssue[]);
  }, []);

  useEffect(() => {
    if (!selectedJob) { setOpenIssues([]); return; }
    void fetchOpenIssues(selectedJob.id);
  }, [selectedJob, fetchOpenIssues]);

  const handleResolveIssue = async (issue: OpenIssue) => {
    const notes = (resolutionNotesById[issue.id] ?? "").trim();
    if (!notes) {
      toast.error("Enter resolution notes");
      return;
    }
    setActing(issue.id);
    const { error } = await rgsGovernedRpc.rpc("resolve_production_issue", {
      p_issue_id: issue.id,
      p_resolution_notes: notes,
    });
    if (error) {
      toast.error(error.message || "Could not resolve issue");
    } else {
      toast.success("✅ Issue Resolved");
      setOpenIssues((prev) => prev.filter((i) => i.id !== issue.id));
      setResolutionNotesById((prev) => { const next = { ...prev }; delete next[issue.id]; return next; });
      onRefresh();
    }
    setActing(null);
  };

  const handleStart = async (job: ProductionJob) => {
    setActing(job.id);
    const { error } = await productionGovernedRpc.startJob({ p_job_id: job.id }, job);
    if (error) {
      toast.error(error.message || "Could not start production");
    } else {
      toast.success("🏭 Production Started");
      onRefresh();
    }
    setActing(null);
  };

  const handlePause = async () => {
    if (!selectedJob || !pauseReason) return;
    setActing(selectedJob.id);
    const { error } = await productionGovernedRpc.pauseJob({
      p_job_id: selectedJob.id,
      p_reason: pauseReason,
      p_comment: pauseComment || null,
    }, selectedJob);
    if (error) {
      toast.error(error.message || "Could not pause production");
    } else {
      toast.success("⏸ Production Paused");
      setShowPauseModal(false);
      setPauseReason("");
      setPauseComment("");
      onRefresh();
    }
    setActing(null);
  };

  const handleResume = async (job: ProductionJob) => {
    setActing(job.id);
    const { error } = await productionGovernedRpc.resumeJob({ p_job_id: job.id }, job);
    if (error) {
      toast.error(error.message || "Could not resume production");
    } else {
      toast.success("▶ Production Resumed");
      onRefresh();
    }
    setActing(null);
  };

  const handleAdvanceStage = async (job: ProductionJob) => {
    const currentIdx = STAGE_ORDER.indexOf(job.stage);
    if (currentIdx >= STAGE_ORDER.length - 1) return;
    const nextStage = STAGE_ORDER[currentIdx + 1];
    setActing(job.id);
    const { error } = await productionGovernedRpc.advanceStage({ p_job_id: job.id }, job);
    if (error) {
      toast.error(error.message || "Could not advance stage");
    } else {
      toast.success(`Stage → ${STAGE_LABELS[nextStage]}`);
      onRefresh();
    }
    setActing(null);
  };

  const handleComplete = async (job: ProductionJob) => {
    const produced = parseFloat(producedQty) || 0;
    const wasted = parseFloat(wastedQty) || 0;

    if (produced <= 0) {
      toast.error("Enter produced quantity");
      return;
    }
    if (produced + wasted > job.assigned_qty * 1.1) {
      toast.error(`Produced + Wasted (${produced + wasted}) exceeds assigned qty (${job.assigned_qty}) by >10%`);
      return;
    }

    setActing(job.id);

    // Record output (append-only, idempotent by correlation id), then declare
    // ready. RGS stock is NOT touched here -- accepted_qty only ever posts at
    // RGS acceptance, once the goods have actually been dispatched, received
    // and accepted. This job's role ends at "declared ready + dispatched";
    // it does not itself increase permanent RGS inventory.
    const metadataPayload: Record<string, string | number> = {};
    for (const field of executionFields) {
      const raw = executionMetadata[field.key];
      if (raw === undefined || raw === "") continue;
      metadataPayload[field.key] = field.type === "number" ? Number(raw) : raw;
    }

    const { error: outputError } = await productionGovernedRpc.recordOutput({
      p_job_id: job.id,
      p_produced_qty: produced,
      p_wasted_qty: wasted,
      p_batch_number: job.batch_number,
      p_notes: null,
      p_execution_metadata: metadataPayload,
    }, job);
    if (outputError) {
      toast.error(outputError.message || "Could not record output");
      setActing(null);
      return;
    }

    const { error: readyError } = await productionGovernedRpc.declareReady({ p_job_id: job.id }, {
      ...job,
      stage: "ready",
    });
    if (readyError) {
      toast.error(readyError.message || "Could not declare production ready");
      setActing(null);
      return;
    }

    const { error: dispatchError } = await productionGovernedRpc.dispatchToRgs({
      p_job_id: job.id,
      p_dispatched_qty: produced,
    }, {
      ...job,
      status: "ready",
    });
    if (dispatchError) {
      toast.error(dispatchError.message || "Could not dispatch to RGS");
      setActing(null);
      return;
    }

    toast.success("✅ Production Completed → Dispatched to RGS (pending physical receipt & acceptance)");
    setSelectedJob(null);
    setProducedQty("");
    setWastedQty("");
    setNetWeight("");
    setExecutionMetadata({});
    onRefresh();
    setActing(null);
  };

  const handleReportIssue = async () => {
    if (!selectedJob || !issueComment.trim()) {
      toast.error("Enter issue details");
      return;
    }
    setActing(selectedJob.id);
    const { error } = await rgsGovernedRpc.rpc("report_production_issue", {
      p_job_id: selectedJob.id,
      p_department: department,
      p_issue_type: issueType,
      p_comment: issueComment,
      p_correlation_id: crypto.randomUUID(),
    });
    if (error) {
      toast.error(error.message || "Could not report issue");
      setActing(null);
      return;
    }
    toast.success("⚠️ Issue Reported");
    setShowIssueModal(false);
    setIssueComment("");
    void fetchOpenIssues(selectedJob.id);
    setActing(null);
  };

  if (activeJobs.length === 0) {
    return (
      <div className="text-center py-16">
        <Play size={48} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No Active Jobs</p>
        <p className="text-xs text-slate-400 mt-1">Accept jobs from the Intake tab first</p>
      </div>
    );
  }

  // Detail view for a selected job
  if (selectedJob) {
    const stageIdx = STAGE_ORDER.indexOf(selectedJob.stage);
    const pri = PRIORITY_STYLES[selectedJob.priority] || PRIORITY_STYLES.normal;

    return (
      <div className="space-y-4">
        {/* Back */}
        <button onClick={() => setSelectedJob(null)} className="text-sm font-bold text-slate-500 flex items-center gap-1">
          ← Back to Active Jobs
        </button>

        {/* Job Header */}
        <div className={`bg-white rounded-2xl border-2 ${pri.border} p-4`}>
          <div className="flex gap-3 items-start">
            <div className="w-16 h-16 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden">
              {selectedJob.product?.image_url ? (
                <img src={selectedJob.product.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={20} className="text-slate-300" />
              )}
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">{selectedJob.product?.name}</h3>
              <p className="text-xs text-slate-500 font-bold">Batch: {selectedJob.batch_number || "—"} • Qty: {selectedJob.assigned_qty}</p>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded mt-1 inline-block ${pri.bg} ${pri.text}`}>{pri.label}</span>
            </div>
          </div>
        </div>

        {/* Stage Progress */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Production Stage</p>
          <div className="flex items-center gap-1">
            {STAGE_ORDER.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center">
                <div className={`w-full h-2 rounded-full ${i <= stageIdx ? "bg-emerald-500" : "bg-slate-200"}`} />
                <span className={`text-[9px] font-bold mt-1 ${i <= stageIdx ? "text-emerald-600" : "text-slate-400"}`}>{STAGE_LABELS[s]}</span>
              </div>
            ))}
          </div>
          {stageIdx < STAGE_ORDER.length - 1 && selectedJob.status === "in_production" && (
            <button
              onClick={() => handleAdvanceStage(selectedJob)}
              disabled={!!acting}
              className="w-full mt-3 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-1"
            >
              Advance to {STAGE_LABELS[STAGE_ORDER[stageIdx + 1]]} <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Start / Pause / Resume */}
        {selectedJob.status === "accepted" && (
          <button
            onClick={() => handleStart(selectedJob)}
            disabled={!!acting}
            className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2"
          >
            {acting ? <Loader2 size={16} className="animate-spin" /> : <><Play size={16} /> Start Production</>}
          </button>
        )}

        {selectedJob.status === "in_production" && (
          <button
            onClick={() => { setShowPauseModal(true); }}
            disabled={!!acting}
            className="w-full py-3 rounded-xl bg-amber-500 text-white font-black text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2"
          >
            <Pause size={14} /> Pause Production
          </button>
        )}

        {selectedJob.status === "paused" && (
          <button
            onClick={() => handleResume(selectedJob)}
            disabled={!!acting}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2"
          >
            {acting ? <Loader2 size={14} className="animate-spin" /> : <><RotateCcw size={14} /> Resume Production</>}
          </button>
        )}

        {/* Data Entry for completion */}
        {(selectedJob.status === "in_production" || selectedJob.status === "paused") && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Completion Data</p>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Produced Qty</label>
              <input type="number" value={producedQty} onChange={(e) => setProducedQty(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl p-3 text-lg font-black outline-none focus:border-emerald-500 mt-1" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Wasted Qty</label>
              <input type="number" value={wastedQty} onChange={(e) => setWastedQty(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl p-3 text-lg font-black outline-none focus:border-red-400 mt-1" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Net Weight / Unit (kg)</label>
              <input type="number" step="0.01" value={netWeight} onChange={(e) => setNetWeight(e.target.value)} placeholder="0.00"
                className="w-full border border-slate-200 rounded-xl p-3 text-lg font-black outline-none focus:border-blue-400 mt-1" />
            </div>
            {executionFields.length > 0 && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{departmentLabel} details</p>
                {executionFields.map((field) => (
                  <div key={field.key}>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">{field.label}</label>
                    <input
                      type={field.type}
                      value={executionMetadata[field.key] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(e) => setExecutionMetadata((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-emerald-500 mt-1"
                    />
                  </div>
                ))}
              </div>
            )}
            {producedQty && (
              <p className="text-xs font-bold text-slate-500">
                Validation: {parseFloat(producedQty || "0") + parseFloat(wastedQty || "0")} / {selectedJob.assigned_qty} assigned
              </p>
            )}
            <button
              onClick={() => handleComplete(selectedJob)}
              disabled={!!acting}
              className="w-full py-4 rounded-2xl bg-emerald-700 text-white font-black text-sm uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 shadow-lg"
            >
              {acting ? <Loader2 size={16} className="animate-spin" /> : <><Lock size={16} /> Production Completed → Transfer to RGS</>}
            </button>
          </div>
        )}

        {/* Open Issues for this job */}
        {openIssues.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-red-200 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Open issues on this job</p>
            {openIssues.map((issue) => (
              <div key={issue.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-xs font-bold uppercase text-slate-500">{issue.issue_type}</p>
                <p className="text-sm text-slate-700">{issue.comment}</p>
                <textarea
                  value={resolutionNotesById[issue.id] ?? ""}
                  onChange={(e) => setResolutionNotesById((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                  placeholder="Resolution notes (what fixed it)..."
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm min-h-[60px] outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleResolveIssue(issue)}
                  disabled={!!acting}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-1"
                >
                  {acting === issue.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Mark Resolved</>}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Report Issue */}
        <button
          onClick={() => setShowIssueModal(true)}
          disabled={!!acting}
          className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-black text-xs uppercase tracking-widest border border-red-200 active:scale-95 flex items-center justify-center gap-2"
        >
          <AlertTriangle size={14} /> Report Issue
        </button>

        {/* Pause Modal */}
        <AnimatePresence>
          {showPauseModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
                <h3 className="font-black text-lg">Pause Reason</h3>
                <div className="flex flex-col gap-2">
                  {[
                    { val: "machine_breakdown", label: "🔧 Machine Breakdown" },
                    { val: "material_shortage", label: "📦 Material Shortage" },
                    { val: "other", label: "📝 Other" },
                  ].map((r) => (
                    <button key={r.val} onClick={() => setPauseReason(r.val)}
                      className={`py-3 px-4 rounded-xl text-sm font-bold text-left border-2 ${pauseReason === r.val ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
                <textarea value={pauseComment} onChange={(e) => setPauseComment(e.target.value)} placeholder="Additional notes..." className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[80px] outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => setShowPauseModal(false)} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-sm">Cancel</button>
                  <button onClick={handlePause} disabled={!pauseReason || !!acting} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-black text-sm active:scale-95">Confirm Pause</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Issue Modal */}
        <AnimatePresence>
          {showIssueModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
                <h3 className="font-black text-lg text-red-600">Report Issue</h3>
                <div className="flex gap-2">
                  {["material", "machine", "delay"].map((t) => (
                    <button key={t} onClick={() => setIssueType(t)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase border-2 ${issueType === t ? "border-red-500 bg-red-50 text-red-600" : "border-slate-200 text-slate-500"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <textarea value={issueComment} onChange={(e) => setIssueComment(e.target.value)} placeholder="Describe the issue..." className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[100px] outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => setShowIssueModal(false)} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-sm">Cancel</button>
                  <button onClick={handleReportIssue} disabled={!!acting} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black text-sm active:scale-95 flex items-center justify-center gap-1">
                    {acting ? <Loader2 size={14} className="animate-spin" /> : "Submit Issue"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Job list
  return (
    <div className="space-y-3">
      {activeJobs.map((job) => {
        const pri = PRIORITY_STYLES[job.priority] || PRIORITY_STYLES.normal;
        const stageIdx = STAGE_ORDER.indexOf(job.stage);
        const stagePercent = ((stageIdx + 1) / STAGE_ORDER.length) * 100;

        return (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelectedJob(job)}
            className={`bg-white rounded-2xl border-l-[6px] ${pri.border} p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer`}
          >
            <div className="flex gap-3 items-center">
              <div className="w-14 h-14 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden">
                {job.product?.image_url ? (
                  <img src={job.product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={18} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-slate-900 text-sm truncate">{job.product?.name}</h4>
                <p className="text-[10px] text-slate-500 font-bold">Batch: {job.batch_number || "—"} • Qty: {job.assigned_qty}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stagePercent}%` }} />
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase">{STAGE_LABELS[job.stage]}</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                  job.status === "paused" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                }`}>
                  {job.status === "paused" ? "⏸ PAUSED" : job.status === "accepted" ? "READY" : "▶ ACTIVE"}
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
