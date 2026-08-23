import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rgsGovernedRpc } from "@/lib/rgsGovernedRpc";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";

// Temporary typed boundary for production_day_end_current, pending
// regenerated project-wide Supabase definitions (same escape-hatch pattern
// used elsewhere in this programme).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dayEndDb = supabase as unknown as { from: (relation: string) => any };

type DaySignoff = {
  id: string;
  department: string;
  business_date: string;
  summary: Record<string, unknown>;
  exception_notes: string | null;
  signed_by: string;
  signed_at: string;
  corrects_signoff_id: string | null;
};

interface Props {
  department: string;
  userId: string | undefined;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const SUMMARY_LABELS: Record<string, string> = {
  opening_pending_jobs: "Opening/pending jobs",
  jobs_received_today: "Jobs received today",
  quantity_required_today: "Quantity required",
  quantity_produced_today: "Quantity produced",
  wastage_today: "Wastage",
  completed_jobs_today: "Completed jobs",
  goods_declared_ready_today: "Goods declared ready",
  material_under_department_custody: "Material under custody",
  urgent_jobs_outstanding: "Urgent jobs outstanding",
  goods_handed_to_rgs_today: "Goods handed to RGS",
};

// These summary fields are jsonb arrays (job/issue/handover lists), not
// scalars -- rendered as a count rather than the raw array.
const SUMMARY_COUNT_LABELS: Record<string, string> = {
  wip_jobs: "WIP jobs",
  paused_jobs: "Paused jobs",
  shortfall_completed_jobs: "Shortfall jobs",
  handovers_awaiting_rgs_acknowledgement: "Awaiting RGS ack",
  escalations_open: "Open escalations",
  batches_recorded_today: "Batches recorded",
};

/**
 * submit_production_day_end (20260822170000_production_day_end_signoff.sql)
 * had zero callers anywhere in Central -- the full HOD sign-off design (a
 * governed, immutable, actor/time-bound accountability checkpoint compiled
 * server-side from real production_jobs/production_job_outputs data) was
 * shipped with no admin UI ever built to submit one. This tab closes that
 * gap: it does NOT compute the summary client-side (the RPC does that
 * atomically and authoritatively) -- it only shows today's already-signed
 * record if one exists, or a form to submit one, plus a correction path.
 * Route: /operations-controller (PHH Engine), Day End tab.
 */
export default function DayEndSignoffTab({ department, userId }: Props) {
  const [current, setCurrent] = useState<DaySignoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [exceptionNotes, setExceptionNotes] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await dayEndDb
      .from("production_day_end_current")
      .select("id, department, business_date, summary, exception_notes, signed_by, signed_at, corrects_signoff_id")
      .eq("department", department)
      .eq("business_date", todayIso())
      .maybeSingle();
    setCurrent((data ?? null) as DaySignoff | null);
    setLoading(false);
  }, [department]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (notes: string, correctsId: string | null) => {
    setSubmitting(true);
    const { error } = await rgsGovernedRpc.rpc("submit_production_day_end", {
      p_department: department,
      // A correction must reference the SAME business_date as the record it
      // corrects (the RPC itself rejects a mismatch) -- use that record's
      // date directly rather than re-deriving today's date, which would
      // only coincidentally match.
      p_business_date: correctsId && current ? current.business_date : todayIso(),
      p_exception_notes: notes.trim() || null,
      p_corrects_signoff_id: correctsId,
      p_correlation_id: crypto.randomUUID(),
    });
    if (error) {
      toast.error(error.message || "Could not submit the day-end signoff");
    } else {
      toast.success(correctsId ? "Correcting signoff submitted" : "Day-end signoff submitted");
      setExceptionNotes("");
      setCorrectionNotes("");
      setShowCorrection(false);
      await load();
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={18} className="text-slate-500" />
          <p className="text-sm font-black text-slate-900">Day-end sign-off — {todayIso()}</p>
        </div>
        <p className="text-xs text-slate-500">
          Not yet submitted today. Submitting compiles a real, department-wide snapshot for today from actual job
          data and signs it under your identity — it does not close or modify any open job.
        </p>
        <textarea
          value={exceptionNotes}
          onChange={(e) => setExceptionNotes(e.target.value)}
          placeholder="Exception notes (optional)..."
          className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[80px] outline-none focus:border-emerald-500"
        />
        <button
          onClick={() => void submit(exceptionNotes, null)}
          disabled={submitting || !userId}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Submit Day-End Signoff</>}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-emerald-200 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-emerald-600" />
        <p className="text-sm font-black text-slate-900">Signed for {current.business_date}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(SUMMARY_LABELS).map(([key, label]) => (
          current.summary[key] !== undefined ? (
            <div key={key} className="rounded-lg bg-slate-50 p-2">
              <p className="text-slate-400 uppercase text-[9px] font-bold">{label}</p>
              <p className="font-black text-slate-900">{String(current.summary[key])}</p>
            </div>
          ) : null
        ))}
        {Object.entries(SUMMARY_COUNT_LABELS).map(([key, label]) => {
          const value = current.summary[key];
          if (!Array.isArray(value)) return null;
          return (
            <div key={key} className="rounded-lg bg-slate-50 p-2">
              <p className="text-slate-400 uppercase text-[9px] font-bold">{label}</p>
              <p className="font-black text-slate-900">{value.length}</p>
            </div>
          );
        })}
      </div>
      {current.exception_notes ? (
        <p className="text-xs text-slate-600"><span className="font-bold">Exception notes:</span> {current.exception_notes}</p>
      ) : null}
      <p className="text-[10px] text-slate-400">Signed at {new Date(current.signed_at).toLocaleString()}</p>

      {!showCorrection ? (
        <button
          onClick={() => setShowCorrection(true)}
          className="w-full py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest active:scale-95"
        >
          Submit a correction
        </button>
      ) : (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
            A correction is a new, separate signed record referencing this one — this record is never edited.
          </p>
          <textarea
            value={correctionNotes}
            onChange={(e) => setCorrectionNotes(e.target.value)}
            placeholder="Why is this being corrected?"
            className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[70px] outline-none focus:border-amber-500"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowCorrection(false)} className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-xs">Cancel</button>
            <button
              onClick={() => void submit(correctionNotes, current.id)}
              disabled={submitting || !correctionNotes.trim() || !userId}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-black text-xs active:scale-95"
            >
              {submitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Submit Correction"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
