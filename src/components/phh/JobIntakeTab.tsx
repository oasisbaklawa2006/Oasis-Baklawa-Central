import { useState } from "react";
import { rgsGovernedRpc } from "@/lib/rgsGovernedRpc";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon, CheckCircle2, XCircle, AlertTriangle, Flame, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductionJob, PRIORITY_STYLES } from "./types";

interface Props {
  jobs: ProductionJob[];
  userId: string | undefined;
  onRefresh: () => void;
}

export default function JobIntakeTab({ jobs, userId, onRefresh }: Props) {
  const [acting, setActing] = useState<string | null>(null);
  const [rejectJobId, setRejectJobId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const pendingJobs = jobs.filter((j) => j.status === "pending");

  const handleAccept = async (jobId: string) => {
    setActing(jobId);
    const batchNum = `B-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await rgsGovernedRpc.rpc("accept_production_job", {
      p_job_id: jobId,
      p_batch_number: batchNum,
      p_correlation_id: crypto.randomUUID(),
    });
    if (error) {
      toast.error(error.message || "Could not accept job");
    } else {
      toast.success("Job Accepted ✅");
      onRefresh();
    }
    setActing(null);
  };

  const handleReject = async () => {
    if (!rejectJobId || !rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setActing(rejectJobId);
    const { error } = await rgsGovernedRpc.rpc("reject_production_job", {
      p_job_id: rejectJobId,
      p_rejection_reason: rejectReason,
      p_correlation_id: crypto.randomUUID(),
    });
    if (error) {
      toast.error(error.message || "Could not reject job");
    } else {
      toast.success("Job Rejected");
      setRejectJobId(null);
      setRejectReason("");
      onRefresh();
    }
    setActing(null);
  };

  if (pendingJobs.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3 opacity-50" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No Pending Jobs</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendingJobs.map((job) => {
        const pri = PRIORITY_STYLES[job.priority] || PRIORITY_STYLES.normal;
        return (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-2xl border-l-[6px] ${pri.border} p-4 shadow-sm`}
          >
            <div className="flex gap-3">
              <div className="w-16 h-16 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200">
                {job.product?.image_url ? (
                  <img src={job.product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={20} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-slate-900 text-base leading-tight truncate">{job.product?.name || "Unknown SKU"}</h4>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${pri.bg} ${pri.text}`}>
                    {job.priority === "red" ? <Flame size={10} className="inline mr-1" /> : null}
                    {pri.label}
                  </span>
                  {job.product?.sku && <span className="text-[10px] text-slate-400 font-mono">{job.product.sku}</span>}
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="font-black text-slate-900">Qty: {job.assigned_qty}</span>
                  {job.order_id && (
                    <span className="text-[10px] text-slate-400 font-bold">
                      SO-{job.order_id.split("-")[0].toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleAccept(job.id)}
                disabled={acting === job.id}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-1.5"
              >
                {acting === job.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Accept Job</>}
              </button>
              <button
                onClick={() => setRejectJobId(job.id)}
                className="py-3 px-4 rounded-xl bg-red-50 text-red-600 font-black text-xs uppercase tracking-widest active:scale-95 border border-red-200"
              >
                <XCircle size={14} />
              </button>
            </div>
          </motion.div>
        );
      })}

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectJobId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4"
            >
              <h3 className="font-black text-lg text-slate-900">Reject Job</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (required)..."
                className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[100px] outline-none focus:border-red-400"
              />
              <div className="flex gap-2">
                <button onClick={() => { setRejectJobId(null); setRejectReason(""); }} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm">
                  Cancel
                </button>
                <button onClick={handleReject} disabled={!!acting} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black text-sm active:scale-95">
                  {acting ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Confirm Reject"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
