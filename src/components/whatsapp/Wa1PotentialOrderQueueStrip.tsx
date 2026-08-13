import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

type Wa1Metrics = {
  active_pending: number | null;
  unassigned: number | null;
  failed_interpretation: number | null;
  at_risk_escalated: number | null;
  unaccounted_potential_orders: number | null;
};

export function Wa1PotentialOrderQueueStrip() {
  const [metrics, setMetrics] = useState<Wa1Metrics | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("whatsapp_potential_order_reconciliation")
      .select("active_pending,unassigned,failed_interpretation,at_risk_escalated,unaccounted_potential_orders")
      .single();
    setError(Boolean(queryError));
    if (!queryError) setMetrics(data);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <section aria-label="WhatsApp potential-order accountability" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <strong className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> WA‑1 Potential Orders</strong>
        {error ? <span role="alert">Queue unavailable—do not treat the inbox as reconciled.</span> : <>
          <span>Active {metrics?.active_pending ?? 0}</span><span>Unassigned {metrics?.unassigned ?? 0}</span><span>Failed interpretation {metrics?.failed_interpretation ?? 0}</span><span>At risk/escalated {metrics?.at_risk_escalated ?? 0}</span><span>Unaccounted {metrics?.unaccounted_potential_orders ?? 0}</span>
        </>}
      </div>
    </section>
  );
}
