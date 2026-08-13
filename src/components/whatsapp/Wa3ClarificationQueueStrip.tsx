import { useCallback, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  fetchWhatsAppClarificationSummary,
  type WhatsAppClarificationSummary,
} from "@/services/whatsappClarificationSummary";

export function Wa3ClarificationQueueStrip() {
  const [summary, setSummary] = useState<WhatsAppClarificationSummary | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      setSummary(await fetchWhatsAppClarificationSummary());
      setError(false);
    } catch {
      setError(true);
      setSummary(null);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <section aria-label="WhatsApp clarification accountability" className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-950">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <strong className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> WA‑3 Clarifications</strong>
        {error ? <span role="alert">Clarification queue unavailable—commercial readiness is unknown.</span> : !summary ? <span>Loading clarification accountability…</span> : <>
          <span>Unresolved fields {summary.unresolved}</span><span>Conflicts {summary.conflicting}</span><span>Open questions {summary.open_questions}</span><span>Overdue {summary.overdue}</span>
        </>}
      </div>
    </section>
  );
}
