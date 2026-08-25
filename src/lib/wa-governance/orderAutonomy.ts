import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhatsAppCaseDecisionSnapshot } from "@/lib/wa-governance/caseDecisionDesk";

export const WHATSAPP_AUTONOMY_OUTCOMES = [
  "AUTO_ELIGIBLE",
  "CLARIFICATION_REQUIRED",
  "POLICY_APPROVAL_REQUIRED",
  "HUMAN_EXCEPTION_REQUIRED",
  "FAILED_INTERPRETATION",
] as const;

export type WhatsAppAutonomyOutcome = (typeof WHATSAPP_AUTONOMY_OUTCOMES)[number];

export const WHATSAPP_AUTONOMY_DRAFT_STATUSES = [
  "DRAFT_CREATED",
  "PROMOTED",
  "PROMOTION_BLOCKED",
  "REJECTED_NOT_ELIGIBLE",
] as const;

export type WhatsAppAutonomyDraftStatus = (typeof WHATSAPP_AUTONOMY_DRAFT_STATUSES)[number];

export type AutonomyReadState = "LOADING" | "READY" | "FAILED";
export type ExecutionReadState = "LOADING" | "READY" | "FAILED" | "NOT_APPLICABLE";
export type ClarificationHealth = "UNKNOWN" | "AUTOMATION_ACTIVE" | "BLOCKED";

export type WhatsAppOrderAutonomyDecision = {
  id: string;
  packetId: string;
  caseId: string | null;
  potentialOrderId: string | null;
  interpretationId: string;
  outcome: WhatsAppAutonomyOutcome;
  decisionReasons: string[];
  blockingReasons: string[];
  governedFacts: Record<string, unknown>;
  readinessSnapshot: Record<string, unknown>;
  evaluatedAt: string | null;
  draftStatus: WhatsAppAutonomyDraftStatus | null;
  draftBlockingReason: string | null;
  salesOrderDraftId: string | null;
  promotedOrderId: string | null;
};

export type PacketAutonomyView = {
  packetId: string;
  readState: AutonomyReadState;
  executionReadState: ExecutionReadState;
  decision: WhatsAppOrderAutonomyDecision | null;
  readError: string | null;
  executionReadError: string | null;
  clarificationHealth: ClarificationHealth;
};

export type OperatorExceptionNarrative = {
  who: string;
  whatTheyWant: string;
  whatAiUnderstood: string;
  whatIsBlocked: string;
  whatHappensNext: string;
  queueLabel: string;
};

/** Core exposes no canonical latest-autonomy RPC/view; Central batches ledger rows and picks latest deterministically. */
export const AUTONOMY_PACKET_BATCH_SIZE = 100;

const LIST_DECISION_SELECT =
  "id,packet_id,case_id,potential_order_id,interpretation_id,autonomy_outcome,decision_reasons,blocking_reasons,evaluated_at";
const DETAIL_DECISION_SELECT = `${LIST_DECISION_SELECT},governed_facts,readiness_snapshot`;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, max = 400): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function texts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function isOutcome(value: string | null): value is WhatsAppAutonomyOutcome {
  return WHATSAPP_AUTONOMY_OUTCOMES.includes(value as WhatsAppAutonomyOutcome);
}

function isDraftStatus(value: string | null): value is WhatsAppAutonomyDraftStatus {
  return WHATSAPP_AUTONOMY_DRAFT_STATUSES.includes(value as WhatsAppAutonomyDraftStatus);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function uniqueSortedPacketIds(packetIds: string[]): string[] {
  return [...new Set(packetIds.filter(Boolean))].sort();
}

export function createLoadingAutonomyView(packetId: string): PacketAutonomyView {
  return {
    packetId,
    readState: "LOADING",
    executionReadState: "LOADING",
    decision: null,
    readError: null,
    executionReadError: null,
    clarificationHealth: "UNKNOWN",
  };
}

export function createFailedAutonomyView(packetId: string, readError: string): PacketAutonomyView {
  return {
    packetId,
    readState: "FAILED",
    executionReadState: "FAILED",
    decision: null,
    readError,
    executionReadError: null,
    clarificationHealth: "UNKNOWN",
  };
}

export function createReadyAutonomyView(
  packetId: string,
  decision: WhatsAppOrderAutonomyDecision | null,
  executionReadState: ExecutionReadState = decision?.outcome === "AUTO_ELIGIBLE" ? "LOADING" : "NOT_APPLICABLE",
): PacketAutonomyView {
  return {
    packetId,
    readState: "READY",
    executionReadState,
    decision,
    readError: null,
    executionReadError: null,
    clarificationHealth: "UNKNOWN",
  };
}

const BLOCKING_LABELS: Record<string, string> = {
  unresolved_customer: "Customer is not uniquely identified",
  ambiguous_customer_match: "More than one possible customer",
  unresolved_branch: "Branch is not uniquely identified",
  ambiguous_branch_match: "More than one possible branch",
  no_order_lines_extracted: "Product lines are missing",
  unclear_intent: "The request is not clearly understood",
  intent_is_not_commercial_order: "This is not a new order",
  intent_requires_human_support: "This needs a named department, not auto-order",
  order_change_requires_human_verification: "Order change needs verification",
  customer_company_credit_frozen: "Credit is frozen — Finance must act",
  branch_requires_customer: "Branch cannot be resolved without the customer",
};

export function labelBlockingReason(reason: string): string {
  const exact = BLOCKING_LABELS[reason];
  if (exact) return exact;
  if (reason.startsWith("missing_explicit_quantity_line_")) return "A line is missing an explicit quantity";
  if (reason.startsWith("ambiguous_product_line_")) return "A product name matches more than one SKU";
  if (reason.startsWith("unresolved_product_line_")) return "A product could not be uniquely resolved";
  if (reason.startsWith("unresolved_unit_line_")) return "Packaging / unit is not unique";
  if (reason.startsWith("below_moq_line_")) return "Quantity is below the governed minimum";
  if (reason.startsWith("missing_b2b_product_authority_line_")) return "SKU is not on the governed B2B list";
  if (reason.includes("conflict") || reason.includes("cross_customer")) return "Conflicting corrections";
  return reason.replace(/_/g, " ");
}

export function classifyClarificationHealth(input: {
  caseStatus: string | null;
  clarifications: Record<string, unknown>[];
  escalations: Record<string, unknown>[];
  outboundDecisions: Record<string, unknown>[];
}): ClarificationHealth {
  const openClarifications = input.clarifications.filter((row) => text(row.status, 40) === "OPEN");
  const unresolvedEscalation = input.escalations.some((row) => !text(row.resolved_at, 120));
  if (unresolvedEscalation) return "BLOCKED";

  const overdueOpen = openClarifications.some((row) => {
    const dueAt = text(row.due_at, 120);
    return dueAt ? Date.parse(dueAt) < Date.now() : false;
  });
  if (overdueOpen) return "BLOCKED";

  const governedOutbound = input.outboundDecisions.some((row) => {
    if (!text(row.related_clarification_id, 80)) return false;
    const status = text(row.status, 40)?.toUpperCase();
    return status === "RELEASED" || status === "VALIDATED" || status === "PENDING";
  });

  if (input.caseStatus === "AWAITING_CUSTOMER" && openClarifications.length > 0) {
    return governedOutbound || openClarifications.length > 0 ? "AUTOMATION_ACTIVE" : "UNKNOWN";
  }

  if (openClarifications.length > 0 && input.caseStatus !== "AWAITING_CUSTOMER") {
    return "BLOCKED";
  }

  return "UNKNOWN";
}

export function enrichClarificationHealthFromSnapshot(
  snapshot: WhatsAppCaseDecisionSnapshot | null,
  decision: WhatsAppOrderAutonomyDecision | null,
): ClarificationHealth {
  if (!snapshot || decision?.outcome !== "CLARIFICATION_REQUIRED") return "UNKNOWN";
  return classifyClarificationHealth({
    caseStatus: snapshot.communicationCase?.status ?? null,
    clarifications: snapshot.clarifications,
    escalations: snapshot.escalations,
    outboundDecisions: snapshot.outboundDecisions,
  });
}

function coreStateUnavailable(view: PacketAutonomyView | null): boolean {
  if (!view) return true;
  return view.readState === "LOADING" || view.readState === "FAILED";
}

function executionStateUnavailable(view: PacketAutonomyView | null): boolean {
  if (!view) return true;
  return view.executionReadState === "LOADING" || view.executionReadState === "FAILED";
}

export function packetRequiresOperatorAttention(view: PacketAutonomyView | null): boolean {
  if (!view || coreStateUnavailable(view)) return true;
  if (view.readState === "READY" && !view.decision) return true;

  const decision = view.decision;
  if (!decision) return true;

  if (decision.outcome === "AUTO_ELIGIBLE") {
    if (executionStateUnavailable(view)) return true;
    if (decision.draftStatus === "PROMOTION_BLOCKED" || decision.draftStatus === "REJECTED_NOT_ELIGIBLE") {
      return true;
    }
    if (decision.draftStatus === "PROMOTED" || decision.draftStatus === "DRAFT_CREATED") return false;
    return true;
  }

  if (decision.outcome === "CLARIFICATION_REQUIRED") {
    if (view.clarificationHealth === "AUTOMATION_ACTIVE") return false;
    return true;
  }

  return true;
}

export function allowsCommercialMutation(view: PacketAutonomyView | null): boolean {
  if (!view || coreStateUnavailable(view) || executionStateUnavailable(view)) return false;
  return requiresHumanAiConclusionDecision(view);
}

export function requiresHumanAiConclusionDecision(view: PacketAutonomyView | null): boolean {
  if (!view || view.readState !== "READY" || !view.decision) return false;
  const decision = view.decision;
  if (decision.outcome === "AUTO_ELIGIBLE") return false;
  if (decision.outcome === "CLARIFICATION_REQUIRED") return false;
  return (
    decision.outcome === "POLICY_APPROVAL_REQUIRED" ||
    decision.outcome === "HUMAN_EXCEPTION_REQUIRED" ||
    decision.outcome === "FAILED_INTERPRETATION"
  );
}

export function requiresAcceptRouting(view: PacketAutonomyView | null): boolean {
  return requiresHumanAiConclusionDecision(view);
}

function governedWho(facts: Record<string, unknown>): string | null {
  const customer = asRecord(facts.customer);
  return (
    text(customer.business_name) ||
    text(customer.company_name) ||
    text(customer.display_label) ||
    text(facts.customer_name)
  );
}

function governedWant(facts: Record<string, unknown>, outcome: WhatsAppAutonomyOutcome): string {
  const lines = Array.isArray(facts.lines) ? facts.lines : Array.isArray(facts.order_lines) ? facts.order_lines : [];
  const rendered = lines
    .map((line) => {
      const row = asRecord(line);
      const sku = text(row.sku) || text(row.product_name) || "product";
      const qty = row.quantity == null ? null : String(row.quantity);
      const unit = text(row.unit) || text(row.uom);
      return [qty, unit, sku].filter(Boolean).join(" ");
    })
    .filter(Boolean);
  if (rendered.length > 0) return rendered.join("; ");
  if (outcome === "AUTO_ELIGIBLE") return "Clear order — Core already holds the governed lines";
  return "See blocking notes — the request is not a clear governed order yet";
}

export function buildOperatorExceptionNarrative(
  view: PacketAutonomyView | null,
  aiSummary?: string | null,
): OperatorExceptionNarrative {
  if (!view || view.readState === "LOADING") {
    return {
      who: "Loading Core state",
      whatTheyWant: "Waiting for Core autonomy evaluation",
      whatAiUnderstood: aiSummary?.trim() || "AI has not produced a usable conclusion yet",
      whatIsBlocked: "Core autonomy state is loading",
      whatHappensNext: "Keep the packet visible. Do not invent customer, SKU, or quantity in the browser.",
      queueLabel: "Core state loading",
    };
  }

  if (view.readState === "FAILED") {
    return {
      who: "Core state unavailable",
      whatTheyWant: "Waiting for Core autonomy evaluation",
      whatAiUnderstood: aiSummary?.trim() || "AI conclusion is advisory only until Core validates it",
      whatIsBlocked: "Core autonomy state unavailable",
      whatHappensNext: "Keep the packet visible. No commercial action is permitted until Core state can be read.",
      queueLabel: "Core state unavailable",
    };
  }

  const decision = view.decision;
  if (!decision) {
    return {
      who: "Not yet resolved by Core",
      whatTheyWant: "Waiting for Core autonomy evaluation",
      whatAiUnderstood: aiSummary?.trim() || "AI has not produced a usable conclusion yet",
      whatIsBlocked: "No Core autonomy decision exists for this packet after a successful read",
      whatHappensNext: "Keep the packet visible. Escalate or retry governed intake — do not invent commercial truth.",
      queueLabel: "Missing Core decision",
    };
  }

  if (decision.outcome === "AUTO_ELIGIBLE" && executionStateUnavailable(view)) {
    return {
      who: governedWho(decision.governedFacts) || "Customer not uniquely resolved",
      whatTheyWant: governedWant(decision.governedFacts, decision.outcome),
      whatAiUnderstood: aiSummary?.trim() || "AI conclusion is advisory only until Core validates it",
      whatIsBlocked: "Core execution state unavailable",
      whatHappensNext: "Keep the packet visible. Do not treat this as auto-success until Core execution truth is readable.",
      queueLabel: "Core state unavailable",
    };
  }

  const blocked = decision.blockingReasons.map(labelBlockingReason);
  if (decision.draftBlockingReason) blocked.push(labelBlockingReason(decision.draftBlockingReason));
  const uniqueBlocked = [...new Set(blocked)];

  let whatHappensNext = "Operator exception — resolve the blocker, then Core can continue.";
  let queueLabel = "Needs operator";
  if (decision.outcome === "AUTO_ELIGIBLE" && decision.draftStatus === "PROMOTED") {
    whatHappensNext = "No operator action. Sales Order already progressed under Core authority.";
    queueLabel = "Automation active";
  } else if (decision.outcome === "AUTO_ELIGIBLE" && decision.draftStatus === "DRAFT_CREATED") {
    whatHappensNext = "No operator action for capture. Draft exists; promotion continues only as far as Core permits.";
    queueLabel = "Automation active";
  } else if (decision.outcome === "AUTO_ELIGIBLE" && decision.draftStatus === "PROMOTION_BLOCKED") {
    whatHappensNext = "Draft exists. A later commercial/finance/ops gate blocked promotion — handle that gate only.";
    queueLabel = "Promotion blocked";
  } else if (decision.outcome === "CLARIFICATION_REQUIRED" && view.clarificationHealth === "AUTOMATION_ACTIVE") {
    whatHappensNext = "Core automation is waiting for the customer to answer the governed clarification.";
    queueLabel = "Waiting for customer";
  } else if (decision.outcome === "CLARIFICATION_REQUIRED" && view.clarificationHealth === "BLOCKED") {
    whatHappensNext = "Core clarification is blocked or escalated — a named team must recover the loop.";
    queueLabel = "Clarification blocked";
  } else if (decision.outcome === "CLARIFICATION_REQUIRED") {
    whatHappensNext = "Core should ask the smallest missing fact. Confirm an answer only if the automatic loop did not bind it.";
    queueLabel = "Clarification waiting";
  } else if (decision.outcome === "POLICY_APPROVAL_REQUIRED") {
    whatHappensNext = "Sensitive commercial approval is required. Do not invent a price, discount, or credit decision.";
    queueLabel = "Policy approval";
  } else if (decision.outcome === "FAILED_INTERPRETATION") {
    whatHappensNext = "Interpretation failed. Keep the packet; do not let it disappear. Retry or escalate.";
    queueLabel = "Failed interpretation";
  } else if (decision.outcome === "HUMAN_EXCEPTION_REQUIRED") {
    whatHappensNext = "This is an exception path (complaint, amend, mixed, or contradictory evidence).";
    queueLabel = "Human exception";
  }

  return {
    who: governedWho(decision.governedFacts) || "Customer not uniquely resolved",
    whatTheyWant: governedWant(decision.governedFacts, decision.outcome),
    whatAiUnderstood: aiSummary?.trim() || "AI conclusion is advisory only until Core validates it",
    whatIsBlocked: uniqueBlocked.length > 0 ? uniqueBlocked.join("; ") : "Nothing material is blocked",
    whatHappensNext,
    queueLabel,
  };
}

function parseDecisionRow(
  row: Record<string, unknown>,
  includeGovernedDetail: boolean,
): WhatsAppOrderAutonomyDecision | null {
  const id = text(row.id, 80);
  const packetId = text(row.packet_id, 80);
  const interpretationId = text(row.interpretation_id, 80);
  const outcomeRaw = text(row.autonomy_outcome, 80);
  if (!id || !packetId || !interpretationId || !isOutcome(outcomeRaw)) return null;
  return {
    id,
    packetId,
    caseId: text(row.case_id, 80),
    potentialOrderId: text(row.potential_order_id, 80),
    interpretationId,
    outcome: outcomeRaw,
    decisionReasons: texts(row.decision_reasons),
    blockingReasons: texts(row.blocking_reasons),
    governedFacts: includeGovernedDetail ? asRecord(row.governed_facts) : {},
    readinessSnapshot: includeGovernedDetail ? asRecord(row.readiness_snapshot) : {},
    evaluatedAt: text(row.evaluated_at, 80),
    draftStatus: null,
    draftBlockingReason: null,
    salesOrderDraftId: null,
    promotedOrderId: null,
  };
}

export function latestAutonomyByPacket(
  decisions: WhatsAppOrderAutonomyDecision[],
): Map<string, WhatsAppOrderAutonomyDecision> {
  const map = new Map<string, WhatsAppOrderAutonomyDecision>();
  const sorted = [...decisions].sort((a, b) => {
    const at = a.evaluatedAt ? Date.parse(a.evaluatedAt) : 0;
    const bt = b.evaluatedAt ? Date.parse(b.evaluatedAt) : 0;
    if (bt !== at) return bt - at;
    return b.id.localeCompare(a.id);
  });
  for (const decision of sorted) {
    if (!map.has(decision.packetId)) map.set(decision.packetId, decision);
  }
  return map;
}

async function fetchDecisionRows(
  supabase: SupabaseClient,
  packetIds: string[],
  includeGovernedDetail: boolean,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const ids = uniqueSortedPacketIds(packetIds);
  if (ids.length === 0) return { rows: [], error: null };

  const select = includeGovernedDetail ? DETAIL_DECISION_SELECT : LIST_DECISION_SELECT;
  const rows: Record<string, unknown>[] = [];
  for (const batch of chunk(ids, AUTONOMY_PACKET_BATCH_SIZE)) {
    const decisionQuery = supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("whatsapp_order_autonomy_decisions" as any)
      .select(select)
      .in("packet_id", batch)
      .order("evaluated_at", { ascending: false });
    const { data, error } = await decisionQuery;
    if (error) return { rows: [], error: error.message || "AUTONOMY_DECISION_LOOKUP_FAILED" };
    for (const row of Array.isArray(data) ? data : []) rows.push(asRecord(row));
  }
  return { rows, error: null };
}

async function fetchExecutionRows(
  supabase: SupabaseClient,
  decisionIds: string[],
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const ids = [...new Set(decisionIds.filter(Boolean))].sort();
  if (ids.length === 0) return { rows: [], error: null };

  const rows: Record<string, unknown>[] = [];
  for (const batch of chunk(ids, AUTONOMY_PACKET_BATCH_SIZE)) {
    const { data, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("whatsapp_order_autonomy_draft_executions" as any)
      .select("autonomy_decision_id,execution_status,blocking_reason,sales_order_draft_id,promoted_order_id")
      .in("autonomy_decision_id", batch);
    if (error) return { rows: [], error: error.message || "AUTONOMY_EXECUTION_LOOKUP_FAILED" };
    for (const row of Array.isArray(data) ? data : []) rows.push(asRecord(row));
  }
  return { rows, error: null };
}

type ClarificationContext = {
  caseStatus: string | null;
  clarifications: Record<string, unknown>[];
  escalations: Record<string, unknown>[];
  outboundDecisions: Record<string, unknown>[];
};

async function fetchClarificationContextByPacket(
  supabase: SupabaseClient,
  packetIds: string[],
): Promise<Map<string, ClarificationContext>> {
  const ids = uniqueSortedPacketIds(packetIds);
  const result = new Map<string, ClarificationContext>();
  if (ids.length === 0) return result;

  const casesByPacket = new Map<string, { caseId: string; status: string | null }>();
  for (const batch of chunk(ids, AUTONOMY_PACKET_BATCH_SIZE)) {
    const { data, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("whatsapp_communication_cases" as any)
      .select("id,packet_id,status")
      .in("packet_id", batch);
    if (error) {
      console.warn("[OperatorInbox] clarification case lookup failed", error.message);
      continue;
    }
    for (const row of Array.isArray(data) ? data : []) {
      const rec = asRecord(row);
      const packetId = text(rec.packet_id, 80);
      const caseId = text(rec.id, 80);
      if (packetId && caseId) casesByPacket.set(packetId, { caseId, status: text(rec.status, 80) });
    }
  }

  const caseIds = [...new Set([...casesByPacket.values()].map((item) => item.caseId))];
  const clarificationsByCase = new Map<string, Record<string, unknown>[]>();
  const escalationsByCase = new Map<string, Record<string, unknown>[]>();
  const outboundByCase = new Map<string, Record<string, unknown>[]>();

  for (const batch of chunk(caseIds, AUTONOMY_PACKET_BATCH_SIZE)) {
    const [clarificationResult, escalationResult, outboundResult] = await Promise.all([
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_case_clarifications" as any)
        .select("case_id,status,due_at")
        .in("case_id", batch),
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_case_escalations" as any)
        .select("case_id,resolved_at")
        .in("case_id", batch),
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_case_outbound_decisions" as any)
        .select("case_id,status,related_clarification_id")
        .in("case_id", batch),
    ]);

    for (const row of Array.isArray(clarificationResult.data) ? clarificationResult.data : []) {
      const rec = asRecord(row);
      const caseId = text(rec.case_id, 80);
      if (!caseId) continue;
      const bucket = clarificationsByCase.get(caseId) ?? [];
      bucket.push(rec);
      clarificationsByCase.set(caseId, bucket);
    }
    for (const row of Array.isArray(escalationResult.data) ? escalationResult.data : []) {
      const rec = asRecord(row);
      const caseId = text(rec.case_id, 80);
      if (!caseId) continue;
      const bucket = escalationsByCase.get(caseId) ?? [];
      bucket.push(rec);
      escalationsByCase.set(caseId, bucket);
    }
    for (const row of Array.isArray(outboundResult.data) ? outboundResult.data : []) {
      const rec = asRecord(row);
      const caseId = text(rec.case_id, 80);
      if (!caseId) continue;
      const bucket = outboundByCase.get(caseId) ?? [];
      bucket.push(rec);
      outboundByCase.set(caseId, bucket);
    }
  }

  for (const packetId of ids) {
    const caseRow = casesByPacket.get(packetId);
    if (!caseRow) {
      result.set(packetId, {
        caseStatus: null,
        clarifications: [],
        escalations: [],
        outboundDecisions: [],
      });
      continue;
    }
    result.set(packetId, {
      caseStatus: caseRow.status,
      clarifications: clarificationsByCase.get(caseRow.caseId) ?? [],
      escalations: escalationsByCase.get(caseRow.caseId) ?? [],
      outboundDecisions: outboundByCase.get(caseRow.caseId) ?? [],
    });
  }

  return result;
}

function applyExecutionRows(
  byPacket: Map<string, PacketAutonomyView>,
  executionRows: Record<string, unknown>[],
): void {
  const executions = new Map<string, Record<string, unknown>>();
  for (const row of executionRows) {
    const id = text(row.autonomy_decision_id, 80);
    if (id) executions.set(id, row);
  }

  for (const [packetId, view] of byPacket) {
    const decision = view.decision;
    if (!decision || decision.outcome !== "AUTO_ELIGIBLE") continue;
    const execution = executions.get(decision.id);
    if (!execution) {
      view.executionReadState = "READY";
      continue;
    }
    const status = text(execution.execution_status, 80);
    view.decision = {
      ...decision,
      draftStatus: isDraftStatus(status) ? status : null,
      draftBlockingReason: text(execution.blocking_reason, 400),
      salesOrderDraftId: text(execution.sales_order_draft_id, 80),
      promotedOrderId: text(execution.promoted_order_id, 80),
    };
    view.executionReadState = "READY";
  }
}

export async function fetchPacketAutonomyViews(
  supabase: SupabaseClient,
  packetIds: string[],
  options?: { includeGovernedDetail?: boolean },
): Promise<Map<string, PacketAutonomyView>> {
  const includeGovernedDetail = Boolean(options?.includeGovernedDetail);
  const ids = uniqueSortedPacketIds(packetIds);
  const byPacket = new Map<string, PacketAutonomyView>();
  if (ids.length === 0) return byPacket;

  for (const packetId of ids) byPacket.set(packetId, createLoadingAutonomyView(packetId));

  const { rows: decisionRows, error: decisionError } = await fetchDecisionRows(
    supabase,
    ids,
    includeGovernedDetail,
  );
  if (decisionError) {
    console.warn("[OperatorInbox] autonomy decision lookup failed", decisionError);
    for (const packetId of ids) byPacket.set(packetId, createFailedAutonomyView(packetId, decisionError));
    return byPacket;
  }

  const parsed = decisionRows
    .map((row) => parseDecisionRow(row, includeGovernedDetail))
    .filter((row): row is WhatsAppOrderAutonomyDecision => row !== null);
  const latestByPacket = latestAutonomyByPacket(parsed);

  for (const packetId of ids) {
    const decision = latestByPacket.get(packetId) ?? null;
    const executionReadState: ExecutionReadState =
      decision?.outcome === "AUTO_ELIGIBLE" ? "LOADING" : "NOT_APPLICABLE";
    byPacket.set(packetId, createReadyAutonomyView(packetId, decision, executionReadState));
  }

  const autoEligibleDecisionIds = [...latestByPacket.values()]
    .filter((decision) => decision.outcome === "AUTO_ELIGIBLE")
    .map((decision) => decision.id);

  if (autoEligibleDecisionIds.length > 0) {
    const { rows: executionRows, error: executionError } = await fetchExecutionRows(
      supabase,
      autoEligibleDecisionIds,
    );
    if (executionError) {
      console.warn("[OperatorInbox] autonomy draft execution lookup failed", executionError);
      for (const [packetId, view] of byPacket) {
        if (view.decision?.outcome === "AUTO_ELIGIBLE") {
          view.executionReadState = "FAILED";
          view.executionReadError = executionError;
        }
      }
    } else {
      applyExecutionRows(byPacket, executionRows);
    }
  }

  const clarificationPacketIds = [...byPacket.values()]
    .filter((view) => view.decision?.outcome === "CLARIFICATION_REQUIRED")
    .map((view) => view.packetId);
  if (clarificationPacketIds.length > 0) {
    const clarificationContext = await fetchClarificationContextByPacket(supabase, clarificationPacketIds);
    for (const packetId of clarificationPacketIds) {
      const view = byPacket.get(packetId);
      const context = clarificationContext.get(packetId);
      if (!view || !context) continue;
      view.clarificationHealth = classifyClarificationHealth(context);
    }
  }

  return byPacket;
}

/** @deprecated Use fetchPacketAutonomyViews — kept for transitional imports during CENTRAL-A closure. */
export async function fetchWhatsAppOrderAutonomyDecisions(
  supabase: SupabaseClient,
  packetIds: string[],
): Promise<Map<string, WhatsAppOrderAutonomyDecision | null>> {
  const views = await fetchPacketAutonomyViews(supabase, packetIds, { includeGovernedDetail: true });
  const legacy = new Map<string, WhatsAppOrderAutonomyDecision | null>();
  for (const [packetId, view] of views) {
    legacy.set(packetId, view.readState === "READY" ? view.decision : null);
  }
  return legacy;
}

export async function fetchWhatsAppOrderAutonomyGovernedDetail(
  supabase: SupabaseClient,
  packetId: string,
): Promise<WhatsAppOrderAutonomyDecision | null> {
  const views = await fetchPacketAutonomyViews(supabase, [packetId], { includeGovernedDetail: true });
  const view = views.get(packetId);
  if (!view || view.readState !== "READY") return null;
  return view.decision;
}
