import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppPermissions } from "@/hooks/useWhatsAppPermissions";
import {
  fetchWhatsAppCaseInboundMessages,
  type CaseInboundMessage,
  type WhatsAppCaseDecisionSnapshot,
} from "@/lib/wa-governance/caseDecisionDesk";
import {
  acceptWhatsAppCaseHandoff,
  confirmWhatsAppOriginalCommunicator,
  decideWhatsAppCaseProposedChange,
  fetchWhatsAppCommercialLayers,
  newWhatsAppCaseCommercialActionKey,
  proposeWhatsAppCaseChange,
  releaseReviewedWhatsAppCaseReply,
  type WhatsAppCommercialLayers,
} from "@/lib/wa-governance/caseCommercialLayers";

const TEAMS = ["SALES","FINANCE","QUALITY","DISPATCH","LOGISTICS","PRODUCTION","PACKAGING","OPERATIONS","CUSTOMER_SERVICE"] as const;
const CHANGE_TYPES = ["PRODUCT_SUBSTITUTION","QUANTITY","UNIT","PACKAGING","PRICE","DELIVERY_DATE","DELIVERY_LOCATION","OTHER"] as const;

function text(item: Record<string, unknown>, key: string): string {
  return typeof item[key] === "string" ? item[key] as string : "";
}
function numberText(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  return typeof value === "number" ? String(value) : value == null ? "" : String(value);
}
function human(value: string): string {
  return value ? value.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : "—";
}
function parseJson(textValue: string, code: string): unknown {
  try { return JSON.parse(textValue); } catch { throw new Error(code); }
}
function objectJson(textValue: string, code: string): Record<string, unknown> {
  const parsed = parseJson(textValue, code);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}

export function OperatorInboxCommercialLayers({
  packetId,
  snapshot,
  onReload,
}: {
  packetId: string;
  snapshot: WhatsAppCaseDecisionSnapshot;
  onReload: () => Promise<void>;
}) {
  const authority = useWhatsAppPermissions();
  const caseId = snapshot.communicationCase?.id ?? "";
  const [layers, setLayers] = useState<WhatsAppCommercialLayers | null>(null);
  const [messages, setMessages] = useState<CaseInboundMessage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submittingIdentity = useMemo(
    () => snapshot.identities.find((item) => text(item, "identity_role") === "SUBMITTING_SENDER") ?? null,
    [snapshot.identities],
  );
  const originalIdentity = useMemo(
    () => snapshot.identities.find((item) => text(item, "identity_role") === "ORIGINAL_COMMUNICATOR") ?? null,
    [snapshot.identities],
  );

  const [originalPartyType, setOriginalPartyType] = useState<"EMPLOYEE"|"CUSTOMER"|"CONTACT"|"COMPANY"|"UNKNOWN">("CONTACT");
  const [originalPartyId, setOriginalPartyId] = useState("");
  const [originalLabel, setOriginalLabel] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [originalMethod, setOriginalMethod] = useState<"DIRECT_MESSAGE"|"FORWARDED_MESSAGE"|"CALLBACK"|"EMPLOYEE_REPORT"|"CUSTOMER_NOMINATED"|"OPERATOR_VERIFIED">("DIRECT_MESSAGE");
  const [originalEvidence, setOriginalEvidence] = useState("");

  const [proposalInterpretationId, setProposalInterpretationId] = useState("");
  const [proposalType, setProposalType] = useState<string>("QUANTITY");
  const [proposalRequested, setProposalRequested] = useState("null");
  const [proposalValue, setProposalValue] = useState("{}");
  const [proposalReason, setProposalReason] = useState("");
  const [decisionReason, setDecisionReason] = useState<Record<string,string>>({});
  const [decisionAuthority, setDecisionAuthority] = useState<Record<string,string>>({});
  const [decisionMessageId, setDecisionMessageId] = useState<Record<string,string>>({});

  const [handoffTeam, setHandoffTeam] = useState("OPERATIONS");
  const [handoffReason, setHandoffReason] = useState("");
  const [handoffOpenWork, setHandoffOpenWork] = useState("{}");

  const [reviewEvidenceReference, setReviewEvidenceReference] = useState<Record<string,string>>({});
  const [reviewDecisionBasis, setReviewDecisionBasis] = useState<Record<string,string>>({});

  const load = async () => {
    if (!caseId) return;
    const [nextLayers, nextMessages] = await Promise.all([
      fetchWhatsAppCommercialLayers(supabase, caseId),
      fetchWhatsAppCaseInboundMessages(supabase, packetId),
    ]);
    setLayers(nextLayers);
    setMessages(nextMessages);
  };

  useEffect(() => {
    let cancelled = false;
    if (!caseId) { setLayers(null); setMessages([]); return () => { cancelled = true; }; }
    void Promise.all([fetchWhatsAppCommercialLayers(supabase, caseId), fetchWhatsAppCaseInboundMessages(supabase, packetId)])
      .then(([nextLayers, nextMessages]) => {
        if (!cancelled) { setLayers(nextLayers); setMessages(nextMessages); }
      })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load commercial layers"); });
    return () => { cancelled = true; };
  }, [caseId, packetId]);

  useEffect(() => {
    if (originalIdentity) return;
    if (!submittingIdentity) return;
    const partyType = text(submittingIdentity, "party_type");
    if (["EMPLOYEE","CUSTOMER","CONTACT","COMPANY","UNKNOWN"].includes(partyType)) {
      setOriginalPartyType(partyType as typeof originalPartyType);
    }
    setOriginalPartyId(text(submittingIdentity, "party_id"));
    setOriginalLabel(text(submittingIdentity, "display_label"));
    setOriginalPhone(text(submittingIdentity, "phone_e164"));
  }, [originalIdentity, submittingIdentity]);

  const run = async (name: string, operation: () => Promise<unknown>, success: string) => {
    setBusy(name); setError(null); setFeedback(null);
    try {
      await operation();
      await Promise.all([load(), onReload()]);
      setFeedback(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${name} failed`);
    } finally { setBusy(null); }
  };

  if (!caseId) return null;
  const mayTriage = authority.has("wa.intake.triage");
  const mayDraft = authority.has("wa.draft.manage");
  const mayAssign = authority.has("wa.intake.assign");
  const mayReply = authority.has("wa.reply.send");
  const mayDisclose = authority.has("wa.disclosure.authorize");
  const pendingProposals = layers?.proposedChanges.filter((item) => text(item,"authority_status") === "REQUIRES_APPROVAL") ?? [];
  const reviewDrafts = snapshot.outboundDecisions.filter((item) => text(item,"status") === "DRAFT");

  return (
    <div className="mt-2 space-y-2" data-operator-inbox-interactive>
      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">Evidence layers · requested → interpreted → proposed → confirmed</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <p className="mb-2 text-slate-600">The customer’s source evidence is never overwritten by AI normalization or a proposed business change.</p>
          <div className="grid gap-2 lg:grid-cols-2">
            {(layers?.requestedLines ?? []).map((line) => {
              const lineId = text(line,"id");
              const interpretation = layers?.interpretations.find((item) => text(item,"requested_line_id") === lineId);
              return (
                <div key={lineId} className="rounded border border-slate-200 bg-slate-50 p-2">
                  <p className="font-semibold text-slate-800">Customer requested</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{text(line,"verbatim_request") || "Evidence-only line"}</p>
                  {text(line,"superseded_at") ? <p className="mt-1 text-[10px] font-semibold uppercase text-amber-700">Superseded by later packet interpretation</p> : null}
                  <div className="mt-2 rounded border border-slate-200 bg-white p-2">
                    <p className="font-semibold text-slate-700">AI interpretation · advisory</p>
                    <p className="mt-1 text-slate-600">Quantity: {interpretation ? numberText(interpretation,"quantity") || "unresolved" : "—"} {interpretation ? text(interpretation,"unit") : ""}</p>
                    <p className="text-slate-600">Confidence: {interpretation ? numberText(interpretation,"confidence") : "—"}</p>
                    <p className="text-slate-600">Source: {interpretation ? human(text(interpretation,"inference_source")) : "—"}</p>
                  </div>
                </div>
              );
            })}
            {!layers?.requestedLines.length ? <p className="text-slate-500">No grounded order lines have been materialised yet.</p> : null}
          </div>
          {(layers?.confirmations.length ?? 0) > 0 ? (
            <div className="mt-3">
              <p className="font-semibold text-slate-800">Customer confirmations</p>
              {layers?.confirmations.map((item) => <p key={text(item,"id")} className="mt-1 rounded bg-emerald-50 px-2 py-1 text-emerald-900">Version {numberText(item,"version")} · {human(text(item,"status"))}</p>)}
            </div>
          ) : null}
          {(layers?.paymentProofs.length ?? 0) > 0 ? (
            <div className="mt-3">
              <p className="font-semibold text-slate-800">Payment evidence</p>
              {layers?.paymentProofs.map((item) => <p key={text(item,"id")} className="mt-1 rounded bg-slate-50 px-2 py-1">{human(text(item,"receipt_status"))} · claimed {numberText(item,"claimed_amount") || "amount not extracted"}</p>)}
              <p className="mt-1 text-[11px] text-slate-500">Receipt is evidence only until Finance records VERIFIED.</p>
            </div>
          ) : null}
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void run("layers-refresh", load, "Evidence layers refreshed.")} disabled={busy !== null}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh layers
          </Button>
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white" open={!originalIdentity}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">Original human communicator</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          {originalIdentity ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-900">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Confirmed separately: {text(originalIdentity,"display_label") || "Original communicator"}
            </div>
          ) : (
            <>
              <p className="mb-2 text-slate-600">Forwarding does not transfer authorship. Confirm who actually expressed the instruction and how that was verified.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <select className="h-9 rounded border border-input bg-background px-2" value={originalPartyType} onChange={(event) => setOriginalPartyType(event.target.value as typeof originalPartyType)}>
                  {["CONTACT","CUSTOMER","EMPLOYEE","COMPANY","UNKNOWN"].map((item) => <option key={item} value={item}>{human(item)}</option>)}
                </select>
                <select className="h-9 rounded border border-input bg-background px-2" value={originalMethod} onChange={(event) => setOriginalMethod(event.target.value as typeof originalMethod)}>
                  {["DIRECT_MESSAGE","FORWARDED_MESSAGE","CALLBACK","EMPLOYEE_REPORT","CUSTOMER_NOMINATED","OPERATOR_VERIFIED"].map((item) => <option key={item} value={item}>{human(item)}</option>)}
                </select>
                <Input value={originalLabel} onChange={(event) => setOriginalLabel(event.target.value)} placeholder="Original communicator name / label" />
                <Input value={originalPhone} onChange={(event) => setOriginalPhone(event.target.value)} placeholder="Phone (optional)" />
                {originalPartyType !== "UNKNOWN" ? <Input value={originalPartyId} onChange={(event) => setOriginalPartyId(event.target.value)} placeholder="Canonical party UUID" /> : null}
                <Input value={originalEvidence} onChange={(event) => setOriginalEvidence(event.target.value)} placeholder="Evidence: direct message, callback note, forward source…" />
              </div>
              <Button type="button" size="sm" className="mt-2" disabled={!mayTriage || busy !== null || !originalLabel.trim() || !originalEvidence.trim() || (originalPartyType !== "UNKNOWN" && !originalPartyId.trim())}
                onClick={() => void run("original-communicator", () => confirmWhatsAppOriginalCommunicator(supabase, {
                  caseId, partyType: originalPartyType, partyId: originalPartyId || null, displayLabel: originalLabel, phoneE164: originalPhone || null,
                  verificationMethod: originalMethod, evidence: { note: originalEvidence, packet_id: packetId },
                  idempotencyKey: newWhatsAppCaseCommercialActionKey("original", caseId),
                }), "Original communicator confirmed with evidence.")}>Confirm original communicator</Button>
            </>
          )}
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">Proposed changes · never silently added to customer request</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="h-9 rounded border border-input bg-background px-2" value={proposalType} onChange={(event) => setProposalType(event.target.value)}>
              {CHANGE_TYPES.map((item) => <option key={item} value={item}>{human(item)}</option>)}
            </select>
            <select className="h-9 rounded border border-input bg-background px-2" value={proposalInterpretationId} onChange={(event) => setProposalInterpretationId(event.target.value)}>
              <option value="">Case-level proposal</option>
              {(layers?.interpretations ?? []).map((item) => <option key={text(item,"id")} value={text(item,"id")}>Interpretation {text(item,"id").slice(0,8)}</option>)}
            </select>
            <Textarea value={proposalRequested} onChange={(event) => setProposalRequested(event.target.value)} placeholder='Customer-requested JSON, e.g. {"quantity":3}' />
            <Textarea value={proposalValue} onChange={(event) => setProposalValue(event.target.value)} placeholder='Proposed JSON, e.g. {"quantity":5}' />
          </div>
          <Input className="mt-2" value={proposalReason} onChange={(event) => setProposalReason(event.target.value)} placeholder="Why is Oasis proposing this change?" />
          <Button type="button" size="sm" className="mt-2" disabled={!mayDraft || busy !== null || !proposalReason.trim()}
            onClick={() => void run("proposal-create", () => proposeWhatsAppCaseChange(supabase, {
              caseId, interpretationId: proposalInterpretationId || null, changeType: proposalType,
              requestedValue: parseJson(proposalRequested,"REQUESTED_VALUE_JSON_INVALID"), proposedValue: parseJson(proposalValue,"PROPOSED_VALUE_JSON_INVALID"),
              reason: proposalReason, idempotencyKey: newWhatsAppCaseCommercialActionKey("proposal",caseId),
            }), "Proposed change recorded. It is not part of the customer order until authorised.")}>Record proposal</Button>

          {pendingProposals.map((item) => {
            const changeId = text(item,"id");
            const eligibleMessages = messages.filter((message) => !message.created_at || !text(item,"created_at") || Date.parse(message.created_at) >= Date.parse(text(item,"created_at")));
            return (
              <div key={changeId} className="mt-3 rounded border border-amber-200 bg-amber-50 p-2">
                <p className="font-semibold text-amber-950">{human(text(item,"change_type"))} · approval required</p>
                <p className="mt-1 text-amber-900">{text(item,"reason")}</p>
                <Input className="mt-2" value={decisionReason[changeId] ?? ""} onChange={(event) => setDecisionReason((current) => ({...current,[changeId]:event.target.value}))} placeholder="Decision reason" />
                <Input className="mt-2" value={decisionAuthority[changeId] ?? ""} onChange={(event) => setDecisionAuthority((current) => ({...current,[changeId]:event.target.value}))} placeholder="Standing authority reference (operator approval only)" />
                <select className="mt-2 h-9 w-full rounded border border-input bg-background px-2" value={decisionMessageId[changeId] ?? ""} onChange={(event) => setDecisionMessageId((current) => ({...current,[changeId]:event.target.value}))}>
                  <option value="">Customer confirmation message (for customer approval)</option>
                  {eligibleMessages.map((message) => <option key={message.id} value={message.id}>{message.packet_sequence ?? "?"}. {(message.content ?? `[${message.message_type ?? "media"}]`).slice(0,90)}</option>)}
                </select>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={!mayDraft || busy !== null || !(decisionReason[changeId] ?? "").trim() || !(decisionAuthority[changeId] ?? "").trim()}
                    onClick={() => void run(`proposal-operator-${changeId}`, () => decideWhatsAppCaseProposedChange(supabase, { changeId, decision:"OPERATOR_APPROVED", authorityReference:decisionAuthority[changeId], reason:decisionReason[changeId], idempotencyKey:newWhatsAppCaseCommercialActionKey("proposal-operator",caseId) }), "Proposal approved under documented standing authority.")}>Approve by standing authority</Button>
                  <Button type="button" size="sm" disabled={!mayDraft || busy !== null || !(decisionReason[changeId] ?? "").trim() || !(decisionMessageId[changeId] ?? "")}
                    onClick={() => void run(`proposal-customer-${changeId}`, () => decideWhatsAppCaseProposedChange(supabase, { changeId, decision:"CUSTOMER_APPROVED", sourceMessageId:decisionMessageId[changeId], reason:decisionReason[changeId], idempotencyKey:newWhatsAppCaseCommercialActionKey("proposal-customer",caseId) }), "Customer-confirmed proposal recorded with inbound evidence.")}>Customer confirmed</Button>
                  <Button type="button" size="sm" variant="destructive" disabled={!mayDraft || busy !== null || !(decisionReason[changeId] ?? "").trim()}
                    onClick={() => void run(`proposal-reject-${changeId}`, () => decideWhatsAppCaseProposedChange(supabase, { changeId, decision:"REJECTED", reason:decisionReason[changeId], idempotencyKey:newWhatsAppCaseCommercialActionKey("proposal-reject",caseId) }), "Proposal rejected without altering customer request.")}>Reject proposal</Button>
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {reviewDrafts.length ? (
        <details className="rounded border border-amber-300 bg-amber-50" open>
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-amber-950"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />Reply QA · evidence review required</summary>
          <div className="border-t border-amber-200 p-3 text-xs">
            {reviewDrafts.map((item) => {
              const decisionId = text(item,"id");
              return (
                <div key={decisionId} className="mb-3 rounded border border-amber-200 bg-white p-2">
                  <p className="whitespace-pre-wrap text-slate-700">{text(item,"message_body")}</p>
                  <Input className="mt-2" value={reviewEvidenceReference[decisionId] ?? ""} onChange={(event) => setReviewEvidenceReference((current) => ({...current,[decisionId]:event.target.value}))} placeholder="Evidence reference: approved price sheet / finance verification / stock record / dispatch plan" />
                  <Textarea className="mt-2" value={reviewDecisionBasis[decisionId] ?? ""} onChange={(event) => setReviewDecisionBasis((current) => ({...current,[decisionId]:event.target.value}))} placeholder="Why this reply is factually safe to release" />
                  <Button type="button" size="sm" className="mt-2" disabled={!mayReply || busy !== null || !(reviewEvidenceReference[decisionId] ?? "").trim() || !(reviewDecisionBasis[decisionId] ?? "").trim()}
                    onClick={() => void run(`reviewed-reply-${decisionId}`, () => releaseReviewedWhatsAppCaseReply(supabase, { outboundDecisionId:decisionId, evidenceReference:reviewEvidenceReference[decisionId], decisionBasis:reviewDecisionBasis[decisionId], idempotencyKey:newWhatsAppCaseCommercialActionKey("reviewed-reply",caseId) }), "Evidence-reviewed reply released through WA-5.")}>Release reviewed reply</Button>
                  {!mayDisclose ? <p className="mt-1 text-[11px] text-amber-800">Sensitive commitments additionally require step-up disclosure authority; Core enforces this at release.</p> : null}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">Accountable handoff</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <p className="mb-2 text-slate-600">A transfer is not resolution. The receiving authorised operator accepts ownership and preserves the open-work snapshot.</p>
          <select className="h-9 w-full rounded border border-input bg-background px-2" value={handoffTeam} onChange={(event) => setHandoffTeam(event.target.value)}>
            {TEAMS.map((team) => <option key={team} value={team}>{human(team)}</option>)}
          </select>
          <Input className="mt-2" value={handoffReason} onChange={(event) => setHandoffReason(event.target.value)} placeholder="Why is ownership moving?" />
          <Textarea className="mt-2" value={handoffOpenWork} onChange={(event) => setHandoffOpenWork(event.target.value)} placeholder='Open work snapshot JSON, e.g. {"pending":"finance confirmation"}' />
          <Button type="button" size="sm" className="mt-2" disabled={!mayAssign || busy !== null || !snapshot.communicationCase?.accountable_owner_id || !handoffReason.trim()}
            onClick={() => void run("handoff", () => acceptWhatsAppCaseHandoff(supabase, { caseId, toTeam:handoffTeam, reason:handoffReason, openWorkSnapshot:objectJson(handoffOpenWork,"HANDOFF_OPEN_WORK_JSON_INVALID"), idempotencyKey:newWhatsAppCaseCommercialActionKey("handoff",caseId) }), "Handoff accepted by the new accountable owner.")}>Accept handoff & own case</Button>
        </div>
      </details>

      {busy ? <p className="text-xs text-slate-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Applying governed action…</p> : null}
      {feedback ? <p className="text-xs font-medium text-emerald-800">{feedback}</p> : null}
      {error ? <p className="text-xs text-amber-900" role="alert">{error}</p> : null}
    </div>
  );
}
