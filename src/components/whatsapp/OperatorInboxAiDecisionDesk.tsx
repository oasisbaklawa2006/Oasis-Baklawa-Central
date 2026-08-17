import { useEffect, useMemo, useRef, useState } from "react";
import { BrainCircuit, CheckCircle2, Clipboard, Loader2, Route, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppPermissions } from "@/hooks/useWhatsAppPermissions";
import type { ProductResolutionAiInterpretation } from "@/lib/wa-governance/productResolutionTypes";
import {
  acceptWhatsAppAiRouting,
  fetchWhatsAppCaseDecisionSnapshot,
  newCaseRoutingIdempotencyKey,
  type WhatsAppCaseDecisionSnapshot,
} from "@/lib/wa-governance/caseDecisionDesk";

const DEPARTMENTS = [
  "SALES",
  "FINANCE",
  "QUALITY",
  "DISPATCH",
  "LOGISTICS",
  "PRODUCTION",
  "PACKAGING",
  "OPERATIONS",
  "CUSTOMER_SERVICE",
] as const;

function humanLabel(value: string | null | undefined): string {
  return value ? value.replace(/_/g, " ") : "Not resolved";
}

export function OperatorInboxAiDecisionDesk({
  packetId,
  interpretation,
}: {
  packetId: string;
  interpretation: ProductResolutionAiInterpretation;
}) {
  const authority = useWhatsAppPermissions();
  const conclusion = interpretation.conclusion;
  const [snapshot, setSnapshot] = useState<WhatsAppCaseDecisionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [team, setTeam] = useState(conclusion?.primary_department ?? "");
  const [nextAction, setNextAction] = useState(conclusion?.recommended_action ?? "");
  const [dueAt, setDueAt] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setTeam(conclusion?.primary_department ?? "");
    setNextAction(conclusion?.recommended_action ?? "");
    setDueAt("");
    setFeedback(null);
    idempotencyKeyRef.current = null;
  }, [packetId, conclusion?.primary_department, conclusion?.recommended_action]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchWhatsAppCaseDecisionSnapshot(supabase, packetId));
    } catch (caught) {
      setSnapshot(null);
      setError(caught instanceof Error ? caught.message : "Could not load governed communication case");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchWhatsAppCaseDecisionSnapshot(supabase, packetId)
      .then((value) => { if (!cancelled) setSnapshot(value); })
      .catch((caught) => {
        if (!cancelled) {
          setSnapshot(null);
          setError(caught instanceof Error ? caught.message : "Could not load governed communication case");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [packetId]);

  const communicationCase = snapshot?.communicationCase ?? null;
  const mayAcceptRouting = authority.has("wa.intake.triage") && authority.has("wa.intake.assign");
  const isAssigned = communicationCase?.accountability_status === "ASSIGNED" || communicationCase?.accountability_status === "ESCALATED";
  const contributorDepartments = useMemo(
    () => conclusion?.contributor_departments ?? [],
    [conclusion?.contributor_departments],
  );

  const acceptRouting = async () => {
    if (!communicationCase || !team || !nextAction.trim() || !dueAt || !mayAcceptRouting) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const key = idempotencyKeyRef.current ?? newCaseRoutingIdempotencyKey(communicationCase.id);
      idempotencyKeyRef.current = key;
      await acceptWhatsAppAiRouting(supabase, {
        caseId: communicationCase.id,
        accountableTeam: team,
        nextAction,
        dueAt: new Date(dueAt).toISOString(),
        contributorDepartments,
        idempotencyKey: key,
      });
      setFeedback("AI routing accepted by authorised operator. Accountability and department tasks are now governed.");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not accept AI routing");
    } finally {
      setSaving(false);
    }
  };

  const copyDraft = async () => {
    if (!conclusion?.draft_reply) return;
    try {
      await navigator.clipboard.writeText(conclusion.draft_reply);
      setFeedback("AI draft copied. Copying does not send or approve the reply.");
    } catch {
      setError("Could not copy the AI draft on this device.");
    }
  };

  return (
    <section className="rounded-md border border-slate-300 bg-slate-50/80 p-3" aria-label="AI B2B Decision Desk">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-slate-700" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-800">AI B2B Decision Desk</p>
            <p className="text-[11px] text-slate-500">AI concludes and recommends. An authorised human makes the business decision.</p>
          </div>
        </div>
        {interpretation.source ? (
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            {interpretation.source === "server" ? "server AI" : "historical fallback"}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading governed case state…
        </div>
      ) : null}

      {communicationCase ? (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          <div className="rounded border border-slate-200 bg-white p-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Case</span>
            <p className="mt-0.5 font-medium text-slate-800">{humanLabel(communicationCase.case_type)}</p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Case state</span>
            <p className="mt-0.5 font-medium text-slate-800">{humanLabel(communicationCase.status)}</p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Accountability</span>
            <p className="mt-0.5 font-medium text-slate-800">
              {isAssigned ? humanLabel(communicationCase.accountable_team) : "Human decision pending"}
            </p>
          </div>
        </div>
      ) : !loading ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          No governed communication case is available for this packet yet. The packet remains evidence; do not infer that a business action has been approved.
        </div>
      ) : null}

      {conclusion ? (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Route className="h-3.5 w-3.5" aria-hidden />
                AI routing recommendation
              </div>
              <p className="mt-1 text-xs font-medium text-slate-800">
                Accountable: {humanLabel(conclusion.primary_department)}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Contributors: {contributorDepartments.length ? contributorDepartments.map(humanLabel).join(", ") : "None proposed"}
              </p>
            </div>
            <div className="rounded border border-slate-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Reply readiness
              </div>
              <p className="mt-1 text-xs font-medium text-slate-800">{humanLabel(conclusion.reply_clearance)}</p>
              <p className="mt-1 text-[11px] text-slate-600">No clearance value sends a message automatically in the current B2B phase.</p>
            </div>
          </div>

          {conclusion.draft_reply ? (
            <div className="mt-3 rounded border border-slate-200 bg-white p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">AI draft reply · not sent</p>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={copyDraft}>
                  <Clipboard className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Copy
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{conclusion.draft_reply}</p>
            </div>
          ) : null}

          {!isAssigned && communicationCase ? (
            <div className="mt-3 rounded border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Human decision — accept / modify AI routing</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-700">
                  Accountable department
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={team}
                    onChange={(event) => setTeam(event.target.value)}
                    disabled={!mayAcceptRouting || saving}
                  >
                    <option value="">Choose department</option>
                    {DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>{humanLabel(department)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-700">
                  Action due at
                  <input
                    type="datetime-local"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                    disabled={!mayAcceptRouting || saving}
                  />
                </label>
              </div>
              <label className="mt-2 block text-xs text-slate-700">
                Next action
                <Textarea
                  className="mt-1 min-h-[72px] text-sm"
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                  disabled={!mayAcceptRouting || saving}
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!mayAcceptRouting || saving || !team || !nextAction.trim() || !dueAt}
                  onClick={acceptRouting}
                >
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />}
                  Accept routing & own case
                </Button>
                {!mayAcceptRouting && !authority.loading ? (
                  <span className="text-[11px] text-amber-800">Triage + assignment permission required.</span>
                ) : null}
                <span className="text-[11px] text-slate-500">No due time is invented by AI; the operator must set it.</span>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {feedback ? <p className="mt-2 text-xs font-medium text-emerald-800">{feedback}</p> : null}
      {error ? <p className="mt-2 text-xs text-amber-900" role="alert">{error}</p> : null}
    </section>
  );
}
