import { useCallback, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { summarizeWa3ClarificationQueue, type Wa3ClarificationTask, type Wa3FieldResolution } from "./wa3ClarificationQueue";

type QueryResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
type Wa3ReadClient = {
  from(table: "whatsapp_order_field_resolutions"): { select(columns: "resolution_state"): QueryResult<Wa3FieldResolution> };
  from(table: "whatsapp_order_clarification_tasks"): { select(columns: "status,due_at"): QueryResult<Wa3ClarificationTask> };
};

export function Wa3ClarificationQueueStrip() {
  const [summary, setSummary] = useState<ReturnType<typeof summarizeWa3ClarificationQueue> | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    // Generated database types are updated from Core after migration deployment;
    // this narrow read contract avoids giving Central any mutation authority.
    const client = supabase as unknown as Wa3ReadClient;
    const [resolutions, tasks] = await Promise.all([
      client.from("whatsapp_order_field_resolutions").select("resolution_state"),
      client.from("whatsapp_order_clarification_tasks").select("status,due_at"),
    ]);
    setError(Boolean(resolutions.error || tasks.error));
    if (!resolutions.error && !tasks.error) setSummary(summarizeWa3ClarificationQueue(resolutions.data ?? [], tasks.data ?? []));
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <section aria-label="WhatsApp clarification accountability" className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-950">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <strong className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> WA‑3 Clarifications</strong>
        {error ? <span role="alert">Clarification queue unavailable—commercial readiness is unknown.</span> : <>
          <span>Unresolved fields {summary?.unresolved ?? 0}</span><span>Conflicts {summary?.conflicting ?? 0}</span><span>Open questions {summary?.open ?? 0}</span><span>Overdue {summary?.overdue ?? 0}</span>
        </>}
      </div>
    </section>
  );
}
