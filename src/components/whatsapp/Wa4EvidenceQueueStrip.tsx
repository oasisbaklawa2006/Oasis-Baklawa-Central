import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Files, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { summarizeWa4EvidenceQueue, type Wa4PacketRow } from "@/components/whatsapp/wa4EvidenceQueue";

export function Wa4EvidenceQueueStrip() {
  const [rows, setRows] = useState<Wa4PacketRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const result = await supabase
      .from("whatsapp_commercial_packets")
      .select("status,processing_state,last_received_at")
      .in("status", ["OPEN", "AWAITING_MEDIA", "FAILED_MEDIA"])
      .order("last_received_at", { ascending: false })
      .limit(1000);
    if (result.error) setError(result.error.message);
    else { setRows((result.data ?? []) as Wa4PacketRow[]); setError(null); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const summary = summarizeWa4EvidenceQueue(rows);

  return (
    <section className="border-b border-slate-200 bg-white px-4 py-2" aria-label="Multimessage and media evidence queue">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
        <span className="inline-flex items-center gap-1 font-semibold"><Files className="h-4 w-4" /> WA-4 evidence</span>
        {loading ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading</span> : (
          <>
            <span>{summary.total} active packets</span>
            <span>{summary.processing} media processing</span>
            <span className={summary.humanReview ? "font-semibold text-amber-700" : ""}>{summary.humanReview} human review</span>
            <span>{summary.ageing} ageing</span>
          </>
        )}
        {error && <span className="inline-flex items-center gap-1 font-medium text-red-700"><AlertTriangle className="h-3 w-3" /> Evidence queue unavailable: {error}</span>}
      </div>
    </section>
  );
}
