import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { summarizeWa1Queue, type Wa1PotentialOrder } from "./wa1PotentialOrderQueue";

export function Wa1PotentialOrderQueueStrip() {
  const [rows, setRows] = useState<Wa1PotentialOrder[]>([]);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("whatsapp_potential_orders" as never)
      .select("id,state,disposition,queue,next_action,next_action_due_at,owner_id")
      .eq("disposition", "ACTIVE_PENDING")
      .order("next_action_due_at", { ascending: true })
      .limit(250);
    setError(Boolean(queryError));
    if (!queryError) setRows((data || []) as unknown as Wa1PotentialOrder[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const summary = summarizeWa1Queue(rows);
  return (
    <section aria-label="WhatsApp potential-order accountability" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <strong className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> WA‑1 Potential Orders</strong>
        {error ? <span role="alert">Queue unavailable—do not treat the inbox as reconciled.</span> : <>
          <span>Active {summary.active}</span><span>Unassigned {summary.unassigned}</span><span>Failed interpretation {summary.failed}</span><span>At risk/escalated {summary.atRisk}</span>
        </>}
      </div>
    </section>
  );
}
