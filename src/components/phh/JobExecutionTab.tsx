import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Play, Pause, RotateCcw, Image as ImageIcon, AlertTriangle, Camera, Send, Lock, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductionJob, STAGE_ORDER, STAGE_LABELS, PRIORITY_STYLES } from "./types";

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

  const activeJobs = jobs.filter((j) => ["accepted", "in_production", "paused"].includes(j.status));

  const handleStart = async (job: ProductionJob) => {
    setActing(job.id);
    await supabase
      .from("production_jobs")
      .update({ status: "in_production", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", job.id);
    toast.success("🏭 Production Started");
    onRefresh();
    setActing(null);
  };

  const handlePause = async () => {
    if (!selectedJob || !pauseReason) return;
    setActing(selectedJob.id);
    await supabase.from("production_pauses").insert({
      job_id: selectedJob.id,
      reason: pauseReason,
      comment: pauseComment || null,
      paused_by: userId,
    });
    await supabase
      .from("production_jobs")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("id", selectedJob.id);
    toast.success("⏸ Production Paused");
    setShowPauseModal(false);
    setPauseReason("");
    setPauseComment("");
    onRefresh();
    setActing(null);
  };

  const handleResume = async (job: ProductionJob) => {
    setActing(job.id);
    // Close open pause
    await supabase
      .from("production_pauses")
      .update({ resumed_at: new Date().toISOString() })
      .eq("job_id", job.id)
      .is("resumed_at", null);
    await supabase
      .from("production_jobs")
      .update({ status: "in_production", updated_at: new Date().toISOString() })
      .eq("id", job.id);
    toast.success("▶ Production Resumed");
    onRefresh();
    setActing(null);
  };

  const handleAdvanceStage = async (job: ProductionJob) => {
    const currentIdx = STAGE_ORDER.indexOf(job.stage as any);
    if (currentIdx >= STAGE_ORDER.length - 1) return;
    const nextStage = STAGE_ORDER[currentIdx + 1];
    setActing(job.id);
    await supabase
      .from("production_jobs")
      .update({ stage: nextStage, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    toast.success(`Stage → ${STAGE_LABELS[nextStage]}`);
    onRefresh();
    setActing(null);
  };

  const handleComplete = async (job: ProductionJob) => {
    const produced = parseFloat(producedQty) || 0;
    const wasted = parseFloat(wastedQty) || 0;
    const weight = parseFloat(netWeight) || 0;

    if (produced <= 0) {
      toast.error("Enter produced quantity");
      return;
    }
    if (produced + wasted > job.assigned_qty * 1.1) {
      toast.error(`Produced + Wasted (${produced + wasted}) exceeds assigned qty (${job.assigned_qty}) by >10%`);
      return;
    }

    setActing(job.id);

    // Lock job
    await supabase
      .from("production_jobs")
      .update({
        status: "completed",
        produced_qty: produced,
        wasted_qty: wasted,
        net_weight_per_unit: weight,
        locked: true,
        completed_at: new Date().toISOString(),
        stage: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // Transfer to RGS
    await supabase.from("production_rgs_transfers").insert({
      job_id: job.id,
      product_id: job.product_id,
      quantity: produced,
      batch_number: job.batch_number,
      transferred_by: userId,
      rgs_notified: true,
    });

    // Update factory_inventory
    if (job.product_id) {
      const { data: inv } = await supabase
        .from("factory_inventory")
        .select("id, quantity")
        .eq("product_id", job.product_id)
        .maybeSingle();
      if (inv) {
        await supabase.from("factory_inventory").update({
          quantity: (inv.quantity || 0) + produced,
          last_updated: new Date().toISOString(),
        }).eq("id", inv.id);
      } else {
        await supabase.from("factory_inventory").insert({ product_id: job.product_id, quantity: produced });
      }
    }

    // Log to daily_production_logs
    await supabase.from("daily_production_logs").insert({
      product_id: job.product_id!,
      produced_qty: produced,
      wastage_qty: wasted,
      department,
      logged_by: userId,
    });

    toast.success("✅ Production Completed → Transferred to RGS");
    setSelectedJob(null);
    setProducedQty("");
    setWastedQty("");
    setNetWeight("");
    onRefresh();
    setActing(null);
  };

  const handleReportIssue = async () => {
    if (!selectedJob || !issueComment.trim()) {
      toast.error("Enter issue details");
      return;
    }
    await supabase.from("production_issues").insert({
      job_id: selectedJob.id,
      department,
      issue_type: issueType,
      comment: issueComment,
      reported_by: userId,
    });
    toast.success("⚠️ Issue Reported");
    setShowIssueModal(false);
    setIssueComment("");
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
    const stageIdx = STAGE_ORDER.indexOf(selectedJob.stage as any);
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

        {/* Report Issue */}
        <button
          onClick={() => setShowIssueModal(true)}
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
                  <button onClick={handlePause} disabled={!pauseReason} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-black text-sm active:scale-95">Confirm Pause</button>
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
                  <button onClick={handleReportIssue} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black text-sm active:scale-95">Submit Issue</button>
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
        const stageIdx = STAGE_ORDER.indexOf(job.stage as any);
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
