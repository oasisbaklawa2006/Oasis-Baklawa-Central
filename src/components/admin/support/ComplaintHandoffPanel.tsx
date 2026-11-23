import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  canLinkComplaintReturn,
  canResolveCommercialComplaint,
  isBridgeId,
  returnLinkError,
} from "@/lib/support/complaintBridge";
import ComplaintFinanceResolution from "./ComplaintFinanceResolution";

interface Props {
  ticketId: string;
  actorId: string;
  role: string | null;
  queueAction?: ReactNode;
}

export default function ComplaintHandoffPanel({ ticketId, actorId, role, queueAction }: Props) {
  const handoff = useQuery({
    queryKey: ["commercial-complaint-handoff", actorId, role, ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_commercial_complaint_handoff_facts_v1", { p_support_ticket_id: ticketId })
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  if (handoff.isPending) return <p role="status">Checking complaint handoff…</p>;
  if (handoff.isError && !handoff.data) {
    return <div className="space-y-2">
      <p role="alert">Could not verify the complaint handoff.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => void handoff.refetch()}>Retry handoff</Button>
    </div>;
  }

  const facts = handoff.data;
  if (!facts) return <div className="space-y-2">
    <p>No commercial complaint is linked to this support ticket.</p>
    {!handoff.isFetching && queueAction}
  </div>;

  return (
    <section aria-label="Complaint handoff" className="space-y-4 rounded-lg border bg-card p-4 text-sm">
      <dl className="grid gap-4 break-words md:grid-cols-2">
        <div>
          <dt className="font-semibold">Support ticket ID</dt>
          <dd>{facts.support_ticket_id}</dd>
          <dd>Support queue status · {facts.ticket_status ?? "Unknown"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Commercial complaint ID</dt>
          <dd>{facts.complaint_id}</dd>
          <dd>Complaint status · {facts.complaint_status ?? "Unavailable"}</dd>
          <dd>Filing deadline · <time dateTime={facts.complaint_deadline}>
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
            }).format(new Date(facts.complaint_deadline))} IST
          </time></dd>
        </div>
        <div>
          <dt className="font-semibold">Physical return case IDs</dt>
          <dd>{facts.return_case_ids.length ? (
            <ul>{facts.return_case_ids.map((id) => <li key={id}>{id}</li>)}</ul>
          ) : "No return case linked"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Finance adjustments</dt>
          <dd>{facts.adjustments.length ? (
            <ul className="space-y-1">{facts.adjustments.map((adjustment) => (
              <li key={adjustment.adjustment_id}>
                <p>Adjustment ID · {adjustment.adjustment_id}</p>
                <p>{adjustment.adjustment_type} · ₹{adjustment.amount}</p>
              </li>
            ))}</ul>
          ) : "No Finance adjustment recorded"}</dd>
        </div>
      </dl>
      {handoff.isError && <p role="alert">Could not refresh the handoff. Displayed facts are from the previous read.</p>}
      {!handoff.isError && canLinkComplaintReturn(role) && (
        <ReturnLinkForm complaintId={facts.complaint_id} refresh={handoff.refetch} />
      )}
      {canResolveCommercialComplaint(role) && (
        <ComplaintFinanceResolution
          key={facts.complaint_id}
          complaintId={facts.complaint_id}
          resolved={facts.resolved}
          handoffUnavailable={handoff.isError}
          refresh={handoff.refetch}
        />
      )}
    </section>
  );
}

function ReturnLinkForm({ complaintId, refresh }: { complaintId: string; refresh: () => Promise<unknown> }) {
  const fieldId = useId();
  const [returnId, setReturnId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function linkReturn(event: FormEvent) {
    event.preventDefault();
    const id = returnId.trim();
    if (busy || !isBridgeId(id)) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await supabase.rpc("link_return_case_to_commercial_complaint_v1", {
        p_return_case_id: id,
        p_complaint_id: complaintId,
      }).single();
      if (result.error) {
        setError(returnLinkError(result.error.message));
        return;
      }
      setMessage(result.data.already_linked ? "Return case already linked." : "Return case linked.");
      setReturnId("");
      await refresh();
    } catch {
      setError("Could not confirm the return link. Check the case ID and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={linkReturn} className="space-y-2 border-t pt-3">
      <label htmlFor={fieldId} className="font-medium">Physical return case ID</label>
      <p className="text-muted-foreground">Link an existing return case to record order and company lineage. Stock and liability decisions are handled separately.</p>
      <div className="flex flex-wrap gap-2">
        <Input id={fieldId} className="max-w-sm" value={returnId} onChange={(event) => setReturnId(event.target.value)} disabled={busy} />
        <Button type="submit" size="sm" disabled={busy || !isBridgeId(returnId.trim())}>Link return case</Button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </form>
  );
}
