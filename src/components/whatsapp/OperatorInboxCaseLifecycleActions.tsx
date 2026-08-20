import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppPermissions } from "@/hooks/useWhatsAppPermissions";
import {
  PACKET_AI_DEPARTMENTS,
  type PacketAiDepartment,
} from "@/lib/wa-governance/packetContentInterpretation";
import {
  WHATSAPP_CASE_TYPES,
  WHATSAPP_DISCLOSURE_SCOPES,
  WHATSAPP_LEARNING_TYPES,
  WHATSAPP_MILESTONES,
  WHATSAPP_REPLY_PURPOSES,
  askWhatsAppCustomer,
  captureWhatsAppLearningCandidate,
  closeWhatsAppCase,
  completeWhatsAppCaseTask,
  confirmWhatsAppCaseIdentity,
  confirmWhatsAppClarificationAnswer,
  escalateWhatsAppCase,
  fetchWhatsAppCaseDraftCandidates,
  fetchWhatsAppCaseInboundMessages,
  fetchWhatsAppCaseLearningCandidates,
  fetchWhatsAppLegacyRetirements,
  fetchWhatsAppReconciliationRun,
  linkWhatsAppCaseSalesOrderDraft,
  newCaseActionIdempotencyKey,
  recordWhatsAppAiCaseDecision,
  recordWhatsAppCaseMilestone,
  recordWhatsAppLegacyRetirement,
  releaseWhatsAppCaseReply,
  resolveWhatsAppCaseEscalation,
  resolveWhatsAppReconciliationException,
  reviewWhatsAppLearningCandidate,
  runWhatsAppShiftReconciliation,
  searchWhatsAppB2BCompanies,
  signoffWhatsAppReconciliation,
  type B2BCompanyCandidate,
  type CaseInboundMessage,
  type SalesOrderDraftCandidate,
  type WhatsAppCaseDecisionSnapshot,
} from "@/lib/wa-governance/caseDecisionDesk";

function value(item: Record<string, unknown>, key: string): string {
  const candidate = item[key];
  return typeof candidate === "string" ? candidate : "";
}

function bool(item: Record<string, unknown>, key: string): boolean {
  return item[key] === true;
}

function human(value: string): string {
  return value ? value.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : "—";
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function parseObject(text: string): Record<string, unknown> {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON must be an object.");
  return parsed as Record<string, unknown>;
}

function ScopeChecklist({
  value: selected,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {WHATSAPP_DISCLOSURE_SCOPES.map((scope) => {
        const checked = selected.includes(scope);
        return (
          <label key={scope} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700">
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) => onChange(next === true ? [...selected, scope] : selected.filter((item) => item !== scope))}
            />
            {human(scope)}
          </label>
        );
      })}
    </div>
  );
}

function ActionNotice({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <p className={error ? "mt-2 text-xs text-amber-900" : "mt-2 text-xs font-medium text-emerald-800"} role={error ? "alert" : undefined}>
      {text}
    </p>
  );
}

export function OperatorInboxCaseLifecycleActions({
  packetId,
  snapshot,
  aiDraftReply,
  onReload,
}: {
  packetId: string;
  snapshot: WhatsAppCaseDecisionSnapshot;
  aiDraftReply: string;
  onReload: () => Promise<void>;
}) {
  const authority = useWhatsAppPermissions();
  const communicationCase = snapshot.communicationCase;
  const caseId = communicationCase?.id ?? "";
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [companyQuery, setCompanyQuery] = useState("");
  const [companies, setCompanies] = useState<B2BCompanyCandidate[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"CRM_MATCH" | "GST_MATCH" | "CALLBACK" | "OPERATOR_VERIFIED" | "CUSTOMER_NOMINATED">("OPERATOR_VERIFIED");
  const [identityEvidence, setIdentityEvidence] = useState("");
  const [identityScopes, setIdentityScopes] = useState<string[]>([]);
  const [identityValidUntil, setIdentityValidUntil] = useState("");
  const [mayConfirmCommercialScope, setMayConfirmCommercialScope] = useState(false);

  const [aiDecisionReason, setAiDecisionReason] = useState("");
  const [modifiedCaseType, setModifiedCaseType] = useState(communicationCase?.case_type ?? "UNCLASSIFIED");
  const [modifiedNextAction, setModifiedNextAction] = useState(communicationCase?.next_action ?? "");

  const activeAuthorizations = useMemo(
    () => snapshot.recipientAuthorizations.filter((item) => !value(item, "revoked_at")),
    [snapshot.recipientAuthorizations],
  );
  const defaultAuthorizationId = value(activeAuthorizations[0] ?? {}, "id");

  const [clarificationAuthorizationId, setClarificationAuthorizationId] = useState(defaultAuthorizationId);
  const [clarificationField, setClarificationField] = useState("");
  const [clarificationQuestion, setClarificationQuestion] = useState("");
  const [clarificationDueAt, setClarificationDueAt] = useState("");
  const [clarificationScopes, setClarificationScopes] = useState<string[]>([]);

  const [replyAuthorizationId, setReplyAuthorizationId] = useState(defaultAuthorizationId);
  const [replyPurpose, setReplyPurpose] = useState("CASE_UPDATE");
  const [replyBody, setReplyBody] = useState(aiDraftReply);
  const [replyScopes, setReplyScopes] = useState<string[]>([]);
  const [replyMilestoneId, setReplyMilestoneId] = useState("");

  const [taskResponse, setTaskResponse] = useState<Record<string, string>>({});
  const [escalationLevel, setEscalationLevel] = useState(1);
  const [escalationTeam, setEscalationTeam] = useState<PacketAiDepartment>("SALES");
  const [escalationReason, setEscalationReason] = useState("");
  const [escalationDueAt, setEscalationDueAt] = useState("");
  const [escalationTaskId, setEscalationTaskId] = useState("");
  const [escalationResolution, setEscalationResolution] = useState<Record<string, string>>({});

  const [draftCandidates, setDraftCandidates] = useState<SalesOrderDraftCandidate[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [inboundMessages, setInboundMessages] = useState<CaseInboundMessage[]>([]);

  const openClarifications = useMemo(
    () => snapshot.clarifications.filter((item) => value(item, "status") === "OPEN"),
    [snapshot.clarifications],
  );
  const [answerClarificationId, setAnswerClarificationId] = useState("");
  const [answerMessageId, setAnswerMessageId] = useState("");
  const [answerText, setAnswerText] = useState("");

  const [milestoneType, setMilestoneType] = useState("REQUEST_RECEIVED");
  const [milestoneRelevance, setMilestoneRelevance] = useState<"SILENT" | "OPTIONAL" | "REQUIRED">("SILENT");
  const [milestoneNote, setMilestoneNote] = useState("");

  const [closureType, setClosureType] = useState<"RESOLVED" | "CANCELLED" | "DUPLICATE" | "NO_RESPONSE">("RESOLVED");
  const [closureSummary, setClosureSummary] = useState("");
  const [customerNotified, setCustomerNotified] = useState(false);
  const closureDecisions = useMemo(
    () => snapshot.outboundDecisions.filter((item) => value(item, "message_purpose") === "CASE_CLOSURE" && value(item, "status") === "RELEASED"),
    [snapshot.outboundDecisions],
  );
  const [closureDecisionId, setClosureDecisionId] = useState("");

  const [reconciliationStart, setReconciliationStart] = useState("");
  const [reconciliationEnd, setReconciliationEnd] = useState("");
  const [reconciliationShift, setReconciliationShift] = useState("");
  const [reconciliationDueAt, setReconciliationDueAt] = useState("");
  const [reconciliation, setReconciliation] = useState<Record<string, unknown> | null>(null);
  const [reconciliationResolution, setReconciliationResolution] = useState<Record<string, string>>({});

  const [learningCandidates, setLearningCandidates] = useState<Record<string, unknown>[]>([]);
  const [learningType, setLearningType] = useState("PRODUCT_ALIAS");
  const [learningObserved, setLearningObserved] = useState("");
  const [learningMapping, setLearningMapping] = useState("{}");
  const [learningEvidence, setLearningEvidence] = useState("");
  const [learningSourceMessageId, setLearningSourceMessageId] = useState("");
  const [learningReviewReason, setLearningReviewReason] = useState<Record<string, string>>({});
  const [learningObjectType, setLearningObjectType] = useState<Record<string, string>>({});
  const [learningObjectId, setLearningObjectId] = useState<Record<string, string>>({});

  const [legacyRetirements, setLegacyRetirements] = useState<Record<string, unknown>[]>([]);
  const [retirementCapability, setRetirementCapability] = useState("");
  const [retirementSurface, setRetirementSurface] = useState("");
  const [retirementDisposition, setRetirementDisposition] = useState("RETIRED");
  const [retirementDestination, setRetirementDestination] = useState("");
  const [retirementEvidence, setRetirementEvidence] = useState("");

  useEffect(() => {
    setSelectedCompanyId(communicationCase?.company_id ?? "");
    setModifiedCaseType(communicationCase?.case_type ?? "UNCLASSIFIED");
    setModifiedNextAction(communicationCase?.next_action ?? "");
    setClarificationAuthorizationId(defaultAuthorizationId);
    setReplyAuthorizationId(defaultAuthorizationId);
    setReplyBody(aiDraftReply);
    setAnswerClarificationId(value(openClarifications[0] ?? {}, "id"));
  }, [packetId, communicationCase?.company_id, communicationCase?.case_type, communicationCase?.next_action, defaultAuthorizationId, aiDraftReply, openClarifications]);

  useEffect(() => {
    let cancelled = false;
    if (!caseId) {
      setDraftCandidates([]);
      setInboundMessages([]);
      setLearningCandidates([]);
      return () => { cancelled = true; };
    }
    void Promise.allSettled([
      fetchWhatsAppCaseDraftCandidates(supabase, packetId),
      fetchWhatsAppCaseInboundMessages(supabase, packetId),
      fetchWhatsAppCaseLearningCandidates(supabase, caseId),
      fetchWhatsAppLegacyRetirements(supabase),
    ]).then((results) => {
      if (cancelled) return;
      const [drafts, messages, learning, retirements] = results;
      setDraftCandidates(drafts.status === "fulfilled" ? drafts.value : []);
      setInboundMessages(messages.status === "fulfilled" ? messages.value : []);
      setLearningCandidates(learning.status === "fulfilled" ? learning.value : []);
      setLegacyRetirements(retirements.status === "fulfilled" ? retirements.value : []);
    });
    return () => { cancelled = true; };
  }, [caseId, packetId]);

  const run = async (name: string, operation: () => Promise<unknown>, success: string, reload = true) => {
    setBusy(name);
    setError(null);
    setFeedback(null);
    try {
      await operation();
      setFeedback(success);
      if (reload) await onReload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${name} failed`);
    } finally {
      setBusy(null);
    }
  };

  if (!communicationCase) return null;

  const mayTriage = authority.has("wa.intake.triage");
  const mayAssign = authority.has("wa.intake.assign");
  const mayClose = authority.has("wa.intake.close");
  const mayReply = authority.has("wa.reply.send");
  const mayDraft = authority.has("wa.draft.manage");
  const mayDisclose = authority.has("wa.disclosure.authorize");
  const activeTasks = snapshot.departmentTasks.filter((item) => !["COMPLETED", "CANCELLED"].includes(value(item, "status")));
  const activeEscalations = snapshot.escalations.filter((item) => !value(item, "resolved_at"));
  const latestMilestoneId = value(snapshot.milestones.at(-1) ?? {}, "id");
  const selectedAnswerMessage = inboundMessages.find((item) => item.id === answerMessageId) ?? null;
  const reconciliationRoot = reconciliation ? (reconciliation.run && typeof reconciliation.run === "object" ? reconciliation.run as Record<string, unknown> : null) : null;
  const reconciliationExceptions = reconciliation && Array.isArray(reconciliation.exceptions)
    ? reconciliation.exceptions.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
  const openReconciliationExceptions = reconciliationExceptions.filter((item) => !value(item, "resolved_at"));
  const unresolvedClosureItems: Record<string, unknown>[] = [
    ...openClarifications.map((item) => ({
      type: "CLARIFICATION",
      id: value(item, "id"),
      field_name: value(item, "field_name"),
      status: value(item, "status") || "OPEN",
    })),
    ...activeTasks.map((item) => ({
      type: "DEPARTMENT_TASK",
      id: value(item, "id"),
      department: value(item, "department"),
      task_type: value(item, "task_type"),
      status: value(item, "status") || "OPEN",
    })),
    ...activeEscalations.map((item) => ({
      type: "ESCALATION",
      id: value(item, "id"),
      team: value(item, "escalated_to_team"),
      level: item.escalation_level ?? null,
      status: "OPEN",
    })),
  ];
  const resolvedClosureBlocked = closureType === "RESOLVED" && unresolvedClosureItems.length > 0;

  const searchCompanies = async () => {
    setBusy("company-search"); setError(null); setFeedback(null);
    try { setCompanies(await searchWhatsAppB2BCompanies(supabase, companyQuery)); }
    catch (caught) { setCompanies([]); setError(caught instanceof Error ? caught.message : "Company search failed"); }
    finally { setBusy(null); }
  };

  const refreshAuxiliary = async () => {
    const [drafts, messages, learning, retirements] = await Promise.all([
      fetchWhatsAppCaseDraftCandidates(supabase, packetId),
      fetchWhatsAppCaseInboundMessages(supabase, packetId),
      fetchWhatsAppCaseLearningCandidates(supabase, caseId),
      fetchWhatsAppLegacyRetirements(supabase),
    ]);
    setDraftCandidates(drafts); setInboundMessages(messages); setLearningCandidates(learning); setLegacyRetirements(retirements);
  };

  return (
    <div className="mt-3 space-y-2" data-operator-inbox-interactive>
      <details className="rounded border border-slate-200 bg-white" open={!communicationCase.company_id}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">1. Customer identity & disclosure authority</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <p className="mb-2 text-slate-600">Selecting a company is a human authority action. Commercial disclosure scopes require step-up permission and expire.</p>
          <div className="flex gap-2">
            <Input value={companyQuery} onChange={(event) => setCompanyQuery(event.target.value)} placeholder="Search company / phone / GST" />
            <Button type="button" variant="outline" size="sm" disabled={busy !== null || companyQuery.trim().length < 2} onClick={searchCompanies}>
              {busy === "company-search" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}Search
            </Button>
          </div>
          {companies.length ? (
            <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded border border-slate-200 p-1">
              {companies.map((company) => (
                <button key={company.id} type="button" className={`w-full rounded px-2 py-1.5 text-left text-xs ${selectedCompanyId === company.id ? "bg-emerald-50 ring-1 ring-emerald-300" : "hover:bg-slate-50"}`} onClick={() => setSelectedCompanyId(company.id)}>
                  <span className="font-medium">{company.business_name}</span>
                  <span className="ml-2 text-slate-500">{company.phone || "No phone"}{company.gst_number ? ` · ${company.gst_number}` : ""}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label>Verification method<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={verificationMethod} onChange={(event) => setVerificationMethod(event.target.value as typeof verificationMethod)} disabled={!mayTriage}><option>OPERATOR_VERIFIED</option><option>CRM_MATCH</option><option>GST_MATCH</option><option>CALLBACK</option><option>CUSTOMER_NOMINATED</option></select></label>
            <label>Commercial authority expires<input type="datetime-local" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={identityValidUntil} onChange={(event) => setIdentityValidUntil(event.target.value)} disabled={!mayDisclose || identityScopes.length === 0} /></label>
          </div>
          <label className="mt-2 block">Identity verification evidence<Textarea className="mt-1 min-h-16" value={identityEvidence} onChange={(event) => setIdentityEvidence(event.target.value)} placeholder="What was checked: CRM account, GST, callback, nominated sender…" /></label>
          <div className="mt-2"><p className="mb-1 font-medium">Allowed commercial disclosure</p><ScopeChecklist value={identityScopes} onChange={setIdentityScopes} disabled={!mayDisclose} /></div>
          <label className="mt-2 flex items-center gap-2"><Checkbox checked={mayConfirmCommercialScope} disabled={!mayDisclose} onCheckedChange={(checked) => setMayConfirmCommercialScope(checked === true)} />Sender may confirm commercial scope</label>
          <Button type="button" size="sm" className="mt-3" disabled={busy !== null || !mayTriage || !selectedCompanyId || identityEvidence.trim().length < 3 || (identityScopes.length > 0 && (!mayDisclose || !identityValidUntil))} onClick={() => void run("identity", () => confirmWhatsAppCaseIdentity(supabase,{caseId,companyId:selectedCompanyId,verificationMethod,disclosureScope:identityScopes,mayReceiveClarification:true,mayConfirmCommercialScope,validUntil:identityValidUntil || null,identityEvidence:{note:identityEvidence.trim(),packet_id:packetId},idempotencyKey:newCaseActionIdempotencyKey("identity",caseId)}), "Customer identity confirmed through Case + WA-3 authority.")}>Confirm / re-authorise customer</Button>
          {!mayDisclose && identityScopes.length > 0 ? <ActionNotice error text="AAL2 / disclosure authorization is required for commercial scopes." /> : null}
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">2. Human decision over AI conclusion</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <label>Decision reason<Textarea className="mt-1 min-h-16" value={aiDecisionReason} onChange={(event) => setAiDecisionReason(event.target.value)} placeholder="Why the AI conclusion is accepted, modified or rejected" /></label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label>Case type<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={modifiedCaseType} onChange={(event) => setModifiedCaseType(event.target.value)}>{WHATSAPP_CASE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Modified next action<Input className="mt-1" value={modifiedNextAction} onChange={(event) => setModifiedNextAction(event.target.value)} /></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["ACCEPT","MODIFY","REJECT"] as const).map((decision) => <Button key={decision} type="button" size="sm" variant={decision === "ACCEPT" ? "default" : "outline"} disabled={busy !== null || !mayTriage || aiDecisionReason.trim().length < 5} onClick={() => void run(`ai-${decision}`,() => recordWhatsAppAiCaseDecision(supabase,{caseId,decision,reason:aiDecisionReason,caseType:decision === "MODIFY" ? modifiedCaseType : null,nextAction:decision === "MODIFY" ? modifiedNextAction : null,idempotencyKey:newCaseActionIdempotencyKey(`ai-${decision.toLowerCase()}`,caseId)}),`AI conclusion ${decision.toLowerCase()} decision recorded by authorised operator.`)}>{decision}</Button>)}
          </div>
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white" open={openClarifications.length > 0}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">3. Ask Customer / confirm clarification answer</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <p className="mb-2 text-slate-600">A clarification is sent only through the governed outbound decision + WA-5 path.</p>
          <label>Authorised recipient<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={clarificationAuthorizationId} onChange={(event) => setClarificationAuthorizationId(event.target.value)}><option value="">Choose active authorization</option>{activeAuthorizations.map((item) => <option key={value(item,"id")} value={value(item,"id")}>{value(item,"verification_method")} · {shortId(value(item,"id"))}</option>)}</select></label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><label>Target field<Input className="mt-1" value={clarificationField} onChange={(event) => setClarificationField(event.target.value)} placeholder="quantity / product / delivery address…" /></label><label>Response due<input type="datetime-local" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={clarificationDueAt} onChange={(event) => setClarificationDueAt(event.target.value)} /></label></div>
          <label className="mt-2 block">Targeted question<Textarea className="mt-1 min-h-16" value={clarificationQuestion} onChange={(event) => setClarificationQuestion(event.target.value)} /></label>
          <div className="mt-2"><p className="mb-1 font-medium">Disclosure in question</p><ScopeChecklist value={clarificationScopes} onChange={setClarificationScopes} /></div>
          <Button type="button" size="sm" className="mt-3" disabled={busy !== null || !mayTriage || !mayReply || !clarificationAuthorizationId || clarificationField.trim().length === 0 || clarificationQuestion.trim().length < 8 || !clarificationDueAt} onClick={() => void run("ask-customer",() => askWhatsAppCustomer(supabase,{caseId,recipientAuthorizationId:clarificationAuthorizationId,fieldName:clarificationField,question:clarificationQuestion,dueAt:clarificationDueAt,disclosureScope:clarificationScopes,idempotencyKey:newCaseActionIdempotencyKey("ask-customer",caseId)}),"Targeted clarification released through governed WA-5 outbound.")}>Release clarification via WhatsApp</Button>

          {openClarifications.length ? <div className="mt-4 border-t border-slate-100 pt-3"><p className="font-semibold">Confirm an incoming answer</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><label>Open clarification<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={answerClarificationId} onChange={(event) => setAnswerClarificationId(event.target.value)}>{openClarifications.map((item) => <option key={value(item,"id")} value={value(item,"id")}>{value(item,"field_name")} · {value(item,"question").slice(0,60)}</option>)}</select></label><label>Inbound source message<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={answerMessageId} onChange={(event) => { const id=event.target.value; setAnswerMessageId(id); const message=inboundMessages.find((item)=>item.id===id); setAnswerText(message?.content ?? ""); }}><option value="">Select customer message</option>{inboundMessages.map((message) => <option key={message.id} value={message.id}>#{message.packet_sequence ?? "?"} · {(message.content || message.message_type || "media").slice(0,80)}</option>)}</select></label></div><label className="mt-2 block">Confirmed answer<Textarea className="mt-1 min-h-16" value={answerText} onChange={(event) => setAnswerText(event.target.value)} /></label>{selectedAnswerMessage && !selectedAnswerMessage.content ? <p className="mt-1 text-amber-800">Media-only answer requires the operator to enter the explicit confirmed answer; the source message remains linked.</p> : null}<Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy !== null || !mayTriage || !answerClarificationId || !answerMessageId || answerText.trim().length === 0} onClick={() => void run("confirm-answer",() => confirmWhatsAppClarificationAnswer(supabase,{clarificationId:answerClarificationId,answerSourceMessageId:answerMessageId,answerText,answerPayload:{operator_confirmed:true,packet_id:packetId},idempotencyKey:newCaseActionIdempotencyKey("clarification-answer",answerClarificationId)}),"Customer clarification answer linked to its inbound evidence and confirmed.")}>Confirm customer answer</Button></div> : null}
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">4. Governed customer reply</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-900"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />This action releases a real WhatsApp message through WA-5. Commercial wording is re-checked by WA-6.</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><label>Recipient authorization<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={replyAuthorizationId} onChange={(event) => setReplyAuthorizationId(event.target.value)}><option value="">Choose authorization</option>{activeAuthorizations.map((item) => <option key={value(item,"id")} value={value(item,"id")}>{value(item,"verification_method")} · {shortId(value(item,"id"))}</option>)}</select></label><label>Purpose<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={replyPurpose} onChange={(event) => setReplyPurpose(event.target.value)}>{WHATSAPP_REPLY_PURPOSES.map((item) => <option key={item}>{item}</option>)}</select></label></div>
          {replyPurpose === "OPERATIONAL_MILESTONE" ? <label className="mt-2 block">Milestone<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={replyMilestoneId} onChange={(event) => setReplyMilestoneId(event.target.value)}><option value="">Choose recorded milestone</option>{snapshot.milestones.map((item) => <option key={value(item,"id")} value={value(item,"id")}>{value(item,"milestone_type")} · {shortId(value(item,"id"))}</option>)}</select></label> : null}
          <label className="mt-2 block">Message<Textarea className="mt-1 min-h-24" value={replyBody} onChange={(event) => setReplyBody(event.target.value)} /></label>
          <div className="mt-2"><p className="mb-1 font-medium">Declared disclosure</p><ScopeChecklist value={replyScopes} onChange={setReplyScopes} /></div>
          <Button type="button" size="sm" className="mt-3" disabled={busy !== null || !mayReply || !replyAuthorizationId || replyBody.trim().length === 0 || (replyPurpose === "OPERATIONAL_MILESTONE" && !replyMilestoneId)} onClick={() => void run("case-reply",() => releaseWhatsAppCaseReply(supabase,{caseId,recipientAuthorizationId:replyAuthorizationId,purpose:replyPurpose,messageBody:replyBody,disclosureScope:replyScopes,relatedMilestoneEventId:replyPurpose === "OPERATIONAL_MILESTONE" ? replyMilestoneId : null,idempotencyKey:newCaseActionIdempotencyKey("case-reply",caseId)}),"Governed reply released to the WA-5 outbox. Provider status remains separately reconciled.")}>Release governed reply</Button>
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white" open={activeTasks.length > 0 || activeEscalations.length > 0}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">5. Department work & escalation</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          {activeTasks.length ? <div className="space-y-2"><p className="font-semibold">Open department tasks</p>{activeTasks.map((task) => { const id=value(task,"id"); return <div key={id} className="rounded border border-slate-200 p-2"><p className="font-medium">{value(task,"department")} · {value(task,"task_type")} · {human(value(task,"status"))}</p><p className="mt-1 text-slate-600">{value(task,"instructions")}</p><Input className="mt-2" value={taskResponse[id] ?? ""} onChange={(event) => setTaskResponse((current)=>({...current,[id]:event.target.value}))} placeholder="Department response / evidence" /><Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy !== null || !mayTriage || (taskResponse[id]??"").trim().length < 2} onClick={() => void run(`task-${id}`,()=>completeWhatsAppCaseTask(supabase,{taskId:id,responsePayload:{note:(taskResponse[id]??"").trim(),packet_id:packetId},idempotencyKey:newCaseActionIdempotencyKey("task-complete",id)}),"Department task completed with attributable response.")}>Complete task</Button></div>; })}</div> : <p className="text-slate-500">No open department tasks.</p>}
          <div className="mt-4 border-t border-slate-100 pt-3"><p className="font-semibold">Escalate case</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><label>Level<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={escalationLevel} onChange={(event) => setEscalationLevel(Number(event.target.value))}>{[1,2,3,4,5].map((level)=><option key={level}>{level}</option>)}</select></label><label>Team<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={escalationTeam} onChange={(event)=>setEscalationTeam(event.target.value as PacketAiDepartment)}>{PACKET_AI_DEPARTMENTS.map((department)=><option key={department}>{department}</option>)}</select></label><label>Related task<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={escalationTaskId} onChange={(event)=>setEscalationTaskId(event.target.value)}><option value="">Case-level escalation</option>{activeTasks.map((task)=><option key={value(task,"id")} value={value(task,"id")}>{value(task,"department")} · {shortId(value(task,"id"))}</option>)}</select></label><label>Due<input type="datetime-local" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={escalationDueAt} onChange={(event)=>setEscalationDueAt(event.target.value)} /></label></div><label className="mt-2 block">Reason<Textarea className="mt-1 min-h-16" value={escalationReason} onChange={(event)=>setEscalationReason(event.target.value)} /></label><Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy!==null||!mayAssign||escalationReason.trim().length<5||!escalationDueAt} onClick={()=>void run("escalate",()=>escalateWhatsAppCase(supabase,{caseId,level:escalationLevel,reason:escalationReason,team:escalationTeam,dueAt:escalationDueAt,departmentTaskId:escalationTaskId||null,idempotencyKey:newCaseActionIdempotencyKey("escalate",caseId)}),"Case escalated with accountable team and due time.")}>Escalate</Button></div>
          {activeEscalations.length ? <div className="mt-4 border-t border-slate-100 pt-3"><p className="font-semibold">Open escalations</p>{activeEscalations.map((item)=>{const id=value(item,"id");return <div key={id} className="mt-2 rounded border border-amber-200 bg-amber-50 p-2"><p>{value(item,"escalated_to_team")} · level {String(item.escalation_level ?? "?")}</p><p className="text-amber-900">{value(item,"reason")}</p><Input className="mt-2" value={escalationResolution[id]??""} onChange={(event)=>setEscalationResolution((current)=>({...current,[id]:event.target.value}))} placeholder="Resolution" /><Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy!==null||!mayAssign||(escalationResolution[id]??"").trim().length<5} onClick={()=>void run(`resolve-escalation-${id}`,()=>resolveWhatsAppCaseEscalation(supabase,{escalationId:id,resolution:escalationResolution[id]??"",idempotencyKey:newCaseActionIdempotencyKey("resolve-escalation",id)}),"Escalation resolved with attributable evidence.")}>Resolve escalation</Button></div>;})}</div> : null}
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">6. Governed Sales Order Draft</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <p className="mb-2 text-slate-600">Linking a draft never promotes or creates a live Sales Order.</p>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2" value={selectedDraftId} onChange={(event)=>setSelectedDraftId(event.target.value)}><option value="">Choose draft for this packet</option>{draftCandidates.map((draft)=><option key={draft.id} value={draft.id}>{draft.status} · {draft.company_name || draft.company_id || "customer unresolved"} · readiness {draft.readiness_overall_score ?? "—"}{draft.promoted_order_id ? " · already promoted" : ""}</option>)}</select>
          <Button type="button" size="sm" className="mt-2" disabled={busy!==null||!mayDraft||!selectedDraftId} onClick={()=>void run("link-draft",()=>linkWhatsAppCaseSalesOrderDraft(supabase,{caseId,draftId:selectedDraftId,idempotencyKey:newCaseActionIdempotencyKey("link-draft",caseId)}),"Governed Sales Order Draft linked to the communication case.")}>Link draft</Button>
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">7. Lifecycle milestone & closure</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <p className="font-semibold">Record milestone</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><label>Milestone<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={milestoneType} onChange={(event)=>setMilestoneType(event.target.value)}>{WHATSAPP_MILESTONES.map((item)=><option key={item}>{item}</option>)}</select></label><label>Customer relevance<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={milestoneRelevance} onChange={(event)=>setMilestoneRelevance(event.target.value as typeof milestoneRelevance)}><option>SILENT</option><option>OPTIONAL</option><option>REQUIRED</option></select></label></div><Input className="mt-2" value={milestoneNote} onChange={(event)=>setMilestoneNote(event.target.value)} placeholder="Verified milestone facts / note" /><Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy!==null||!mayTriage||milestoneNote.trim().length<2} onClick={()=>void run("milestone",()=>recordWhatsAppCaseMilestone(supabase,{caseId,milestoneType,customerRelevance:milestoneRelevance,facts:{note:milestoneNote.trim(),packet_id:packetId},sourceEventKey:newCaseActionIdempotencyKey("milestone",caseId)}),"Lifecycle milestone appended; no customer message was sent automatically.")}>Record milestone</Button>
          <div className="mt-4 border-t border-slate-100 pt-3"><p className="font-semibold">Close case</p><label className="mt-2 block">Closure type<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={closureType} onChange={(event)=>setClosureType(event.target.value as typeof closureType)}><option>RESOLVED</option><option>CANCELLED</option><option>DUPLICATE</option><option>NO_RESPONSE</option></select></label>{unresolvedClosureItems.length > 0 ? <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">{unresolvedClosureItems.length} unresolved case item(s) remain. RESOLVED closure is blocked; non-resolved closure types will record these items in the immutable closure evidence.</p> : null}<label className="mt-2 block">Resolution summary<Textarea className="mt-1 min-h-20" value={closureSummary} onChange={(event)=>setClosureSummary(event.target.value)} /></label><label className="mt-2 flex items-center gap-2"><Checkbox checked={customerNotified} onCheckedChange={(checked)=>setCustomerNotified(checked===true)} />Customer was notified through a released CASE_CLOSURE decision</label>{customerNotified ? <select className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2" value={closureDecisionId} onChange={(event)=>setClosureDecisionId(event.target.value)}><option value="">Choose released closure reply</option>{closureDecisions.map((item)=><option key={value(item,"id")} value={value(item,"id")}>{shortId(value(item,"id"))} · {value(item,"provider_status") || "provider pending"}</option>)}</select> : null}<Button type="button" size="sm" className="mt-3" disabled={busy!==null||!mayClose||closureSummary.trim().length<10||(customerNotified&&!closureDecisionId)||resolvedClosureBlocked} onClick={()=>void run("close-case",()=>closeWhatsAppCase(supabase,{caseId,closureType,resolutionSummary:closureSummary,unresolvedItems:unresolvedClosureItems,customerNotified,closureOutboundDecisionId:customerNotified?closureDecisionId:null,idempotencyKey:newCaseActionIdempotencyKey("close-case",caseId)}),"Communication case closed with unresolved work recorded in immutable closure evidence.")}>Close case</Button></div>
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">8. Zero-loss shift reconciliation</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2"><label>Window start<input type="datetime-local" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={reconciliationStart} onChange={(event)=>setReconciliationStart(event.target.value)} /></label><label>Window end<input type="datetime-local" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={reconciliationEnd} onChange={(event)=>setReconciliationEnd(event.target.value)} /></label><label>Shift code<Input className="mt-1" value={reconciliationShift} onChange={(event)=>setReconciliationShift(event.target.value)} placeholder="e.g. NIGHT-2026-08-18" /></label><label>Exception due<input type="datetime-local" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={reconciliationDueAt} onChange={(event)=>setReconciliationDueAt(event.target.value)} /></label></div>
          <Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy!==null||!mayClose||!reconciliationStart||!reconciliationEnd||!reconciliationShift.trim()||!reconciliationDueAt} onClick={()=>void run("reconciliation",async()=>{const created=await runWhatsAppShiftReconciliation(supabase,{windowStart:reconciliationStart,windowEnd:reconciliationEnd,shiftCode:reconciliationShift,exceptionDueAt:reconciliationDueAt,idempotencyKey:newCaseActionIdempotencyKey("reconciliation",reconciliationShift)});const runId=value(created,"id");if(runId)setReconciliation(await fetchWhatsAppReconciliationRun(supabase,runId));},"Reconciliation completed. Every zero-loss exception is explicitly listed.",false)}>Run reconciliation</Button>
          {reconciliationRoot ? <div className="mt-3 rounded border border-slate-200 p-2"><p className="font-semibold">{value(reconciliationRoot,"status")} · run {shortId(value(reconciliationRoot,"id"))}</p><p className="mt-1 text-slate-600">Raw {String(reconciliationRoot.raw_message_count??0)} · fragments {String(reconciliationRoot.packet_fragment_count??0)} · cases {String(reconciliationRoot.case_source_count??0)} · orphan {String(reconciliationRoot.orphan_message_count??0)} · unresolved {String(reconciliationRoot.unresolved_count??0)} · duplicate {String(reconciliationRoot.duplicate_count??0)}</p>{reconciliationExceptions.map((item)=>{const id=value(item,"id");return <div key={id} className={`mt-2 rounded border p-2 ${value(item,"resolved_at")?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}><p>{value(item,"exception_type")} · {value(item,"business_object_type")}</p>{!value(item,"resolved_at") ? <><Input className="mt-2" value={reconciliationResolution[id]??""} onChange={(event)=>setReconciliationResolution((current)=>({...current,[id]:event.target.value}))} placeholder="Resolution evidence" /><Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy!==null||(reconciliationResolution[id]??"").trim().length<5} onClick={()=>void run(`recon-resolve-${id}`,async()=>{await resolveWhatsAppReconciliationException(supabase,id,reconciliationResolution[id]??"");setReconciliation(await fetchWhatsAppReconciliationRun(supabase,value(reconciliationRoot,"id")));},"Reconciliation exception resolved.",false)}>Resolve exception</Button></>:<p className="text-emerald-800">Resolved: {value(item,"resolution")}</p>}</div>;})}<Button type="button" size="sm" className="mt-3" disabled={busy!==null||openReconciliationExceptions.length>0||value(reconciliationRoot,"status")==="SIGNED_OFF"} onClick={()=>void run("recon-signoff",async()=>{const id=value(reconciliationRoot,"id");await signoffWhatsAppReconciliation(supabase,id);setReconciliation(await fetchWhatsAppReconciliationRun(supabase,id));},"Reconciliation signed off with zero open exceptions.",false)}>Sign off reconciliation</Button></div> : null}
        </div>
      </details>

      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">9. Governed learning</summary>
        <div className="border-t border-slate-100 p-3 text-xs">
          <p className="mb-2 text-slate-600">Learning proposals are evidence only. Approval requires an already-created canonical object reference; this screen never changes product/customer master data.</p>
          <div className="grid gap-2 sm:grid-cols-2"><label>Type<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={learningType} onChange={(event)=>setLearningType(event.target.value)}>{WHATSAPP_LEARNING_TYPES.map((item)=><option key={item}>{item}</option>)}</select></label><label>Source message<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={learningSourceMessageId} onChange={(event)=>setLearningSourceMessageId(event.target.value)}><option value="">Case-level observation</option>{inboundMessages.map((message)=><option key={message.id} value={message.id}>#{message.packet_sequence??"?"} · {(message.content||message.message_type||"media").slice(0,70)}</option>)}</select></label></div><Input className="mt-2" value={learningObserved} onChange={(event)=>setLearningObserved(event.target.value)} placeholder="Observed alias / pattern" /><Textarea className="mt-2 min-h-16 font-mono text-[11px]" value={learningMapping} onChange={(event)=>setLearningMapping(event.target.value)} placeholder='{"canonical":"..."}' /><Input className="mt-2" value={learningEvidence} onChange={(event)=>setLearningEvidence(event.target.value)} placeholder="Evidence / why this is a candidate" /><Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy!==null||!mayTriage||learningObserved.trim().length===0||learningEvidence.trim().length===0} onClick={()=>void run("learning-capture",async()=>{await captureWhatsAppLearningCandidate(supabase,{caseId,sourceMessageId:learningSourceMessageId||null,candidateType:learningType,observedValue:learningObserved,proposedMapping:parseObject(learningMapping),evidence:{note:learningEvidence.trim(),packet_id:packetId},idempotencyKey:newCaseActionIdempotencyKey("learning",caseId)});setLearningCandidates(await fetchWhatsAppCaseLearningCandidates(supabase,caseId));},"Learning candidate captured for human review.",false)}>Capture candidate</Button>
          {learningCandidates.filter((item)=>value(item,"status")==="PENDING_REVIEW").map((item)=>{const id=value(item,"id");return <div key={id} className="mt-3 rounded border border-slate-200 p-2"><p className="font-medium">{value(item,"candidate_type")} · {value(item,"observed_value")}</p><p className="mt-1 text-slate-500">Proposed mapping: {JSON.stringify(item.proposed_mapping)}</p><Input className="mt-2" value={learningReviewReason[id]??""} onChange={(event)=>setLearningReviewReason((current)=>({...current,[id]:event.target.value}))} placeholder="Review reason" /><div className="mt-2 grid gap-2 sm:grid-cols-2"><Input value={learningObjectType[id]??""} onChange={(event)=>setLearningObjectType((current)=>({...current,[id]:event.target.value}))} placeholder="Existing canonical object type" /><Input value={learningObjectId[id]??""} onChange={(event)=>setLearningObjectId((current)=>({...current,[id]:event.target.value}))} placeholder="Existing canonical object UUID" /></div><div className="mt-2 flex flex-wrap gap-2">{(["REJECT","SUPERSEDE"] as const).map((decision)=><Button key={decision} type="button" size="sm" variant="outline" disabled={busy!==null||!mayAssign||(learningReviewReason[id]??"").trim().length<5} onClick={()=>void run(`learning-${decision}-${id}`,async()=>{await reviewWhatsAppLearningCandidate(supabase,{candidateId:id,decision,reason:learningReviewReason[id]??""});setLearningCandidates(await fetchWhatsAppCaseLearningCandidates(supabase,caseId));},`Learning candidate ${decision.toLowerCase()} recorded.`,false)}>{decision}</Button>)}<Button type="button" size="sm" disabled={busy!==null||!mayAssign||(learningReviewReason[id]??"").trim().length<5||!(learningObjectType[id]??"").trim()||!(learningObjectId[id]??"").trim()} onClick={()=>void run(`learning-approve-${id}`,async()=>{await reviewWhatsAppLearningCandidate(supabase,{candidateId:id,decision:"APPROVE_REFERENCE",reason:learningReviewReason[id]??"",promotedObjectType:learningObjectType[id],promotedObjectId:learningObjectId[id]});setLearningCandidates(await fetchWhatsAppCaseLearningCandidates(supabase,caseId));},"Learning candidate approved as a reference to an existing canonical object; no master mutation was performed.",false)}>APPROVE REFERENCE</Button></div></div>;})}
        </div>
      </details>

      {(mayAssign && mayClose) ? <details className="rounded border border-slate-200 bg-white"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">10. Legacy runtime retirement sign-off</summary><div className="border-t border-slate-100 p-3 text-xs"><p className="mb-2 text-slate-600">Append-only technical evidence. This does not delete code or grant write authority.</p><div className="grid gap-2 sm:grid-cols-2"><Input value={retirementCapability} onChange={(event)=>setRetirementCapability(event.target.value)} placeholder="Capability key" /><select className="h-9 rounded-md border border-input bg-background px-2" value={retirementDisposition} onChange={(event)=>setRetirementDisposition(event.target.value)}><option>RETIRED</option><option>MIGRATED_READ_ONLY</option><option>MIGRATED_SUGGESTION_ONLY</option><option>RETAINED_INGRESS_ONLY</option></select></div><Input className="mt-2" value={retirementSurface} onChange={(event)=>setRetirementSurface(event.target.value)} placeholder="Legacy surface" /><Input className="mt-2" value={retirementDestination} onChange={(event)=>setRetirementDestination(event.target.value)} placeholder="Canonical destination" /><Textarea className="mt-2 min-h-16" value={retirementEvidence} onChange={(event)=>setRetirementEvidence(event.target.value)} placeholder="Verification evidence" /><Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy!==null||retirementCapability.trim().length===0||retirementSurface.trim().length<3||retirementDestination.trim().length<3||retirementEvidence.trim().length<3} onClick={()=>void run("legacy-retirement",async()=>{await recordWhatsAppLegacyRetirement(supabase,{capabilityKey:retirementCapability,legacySurface:retirementSurface,disposition:retirementDisposition,canonicalDestination:retirementDestination,evidence:{note:retirementEvidence.trim(),packet_id:packetId}});setLegacyRetirements(await fetchWhatsAppLegacyRetirements(supabase));},"Legacy retirement evidence appended with commercial_write_authority=false.",false)}>Record retirement sign-off</Button>{legacyRetirements.length ? <div className="mt-3 space-y-1">{legacyRetirements.slice(0,12).map((item)=><div key={`${value(item,"capability_key")}:${String(item.revision_number??1)}`} className="rounded border border-slate-200 px-2 py-1.5"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-700" />{value(item,"capability_key")} r{String(item.revision_number??1)} · {value(item,"disposition")} → {value(item,"canonical_destination")}</div>)}</div> : null}</div></details> : null}

      {busy ? <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Governed action in progress: {human(busy)}</p> : null}
      {feedback ? <ActionNotice text={feedback} /> : null}
      {error ? <ActionNotice error text={error} /> : null}
      {!authority.loading && authority.error ? <ActionNotice error text={authority.error} /> : null}
      {communicationCase.closed_at ? <p className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900"><CheckCircle2 className="h-3.5 w-3.5" />Case closed at {communicationCase.closed_at}.</p> : null}
      {latestMilestoneId ? <p className="text-[10px] text-slate-400">Latest lifecycle evidence: {shortId(latestMilestoneId)}</p> : null}
    </div>
  );
}
