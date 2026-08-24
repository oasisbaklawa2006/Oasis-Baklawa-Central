import type { SupabaseClient } from "@supabase/supabase-js";

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

export type OperatorExceptionNarrative = {
  who: string;
  whatTheyWant: string;
  whatAiUnderstood: string;
  whatIsBlocked: string;
  whatHappensNext: string;
  queueLabel: string;
};

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

export function packetRequiresOperatorAttention(decision: WhatsAppOrderAutonomyDecision | null): boolean {
  if (!decision) return true;
  if (decision.outcome === "AUTO_ELIGIBLE") {
    if (decision.draftStatus === "PROMOTION_BLOCKED" || decision.draftStatus === "REJECTED_NOT_ELIGIBLE") {
      return true;
    }
    return false;
  }
  return true;
}

export function requiresHumanAiConclusionDecision(decision: WhatsAppOrderAutonomyDecision | null): boolean {
  if (!decision) return true;
  return (
    decision.outcome === "POLICY_APPROVAL_REQUIRED" ||
    decision.outcome === "HUMAN_EXCEPTION_REQUIRED" ||
    decision.outcome === "FAILED_INTERPRETATION"
  );
}

export function requiresAcceptRouting(decision: WhatsAppOrderAutonomyDecision | null): boolean {
  if (!decision) return true;
  return decision.outcome !== "AUTO_ELIGIBLE";
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
  decision: WhatsAppOrderAutonomyDecision | null,
  aiSummary?: string | null,
): OperatorExceptionNarrative {
  if (!decision) {
    return {
      who: "Not yet resolved by Core",
      whatTheyWant: "Waiting for Core autonomy evaluation",
      whatAiUnderstood: aiSummary?.trim() || "AI has not produced a usable conclusion yet",
      whatIsBlocked: "No Core autonomy decision is available for this packet",
      whatHappensNext: "Keep the packet visible. Do not invent customer, SKU, or quantity in the browser.",
      queueLabel: "Awaiting Core decision",
    };
  }

  const blocked = decision.blockingReasons.map(labelBlockingReason);
  if (decision.draftBlockingReason) blocked.push(labelBlockingReason(decision.draftBlockingReason));
  const uniqueBlocked = [...new Set(blocked)];

  let whatHappensNext = "Operator exception — resolve the blocker, then Core can continue.";
  let queueLabel = "Needs operator";
  if (decision.outcome === "AUTO_ELIGIBLE" && decision.draftStatus === "PROMOTED") {
    whatHappensNext = "No operator action. Sales Order already progressed under Core authority.";
    queueLabel = "Auto success";
  } else if (decision.outcome === "AUTO_ELIGIBLE" && decision.draftStatus === "DRAFT_CREATED") {
    whatHappensNext = "No operator action for capture. Draft exists; promotion continues only as far as Core permits.";
    queueLabel = "Auto draft";
  } else if (decision.outcome === "AUTO_ELIGIBLE" && decision.draftStatus === "PROMOTION_BLOCKED") {
    whatHappensNext = "Draft exists. A later commercial/finance/ops gate blocked promotion — handle that gate only.";
    queueLabel = "Promotion blocked";
  } else if (decision.outcome === "CLARIFICATION_REQUIRED") {
    whatHappensNext = "Core should ask the smallest missing fact. Confirm an answer only if the automatic loop did not bind it.";
    queueLabel = "Clarification waiting";
  } else if (decision.outcome === "POLICY_APPROVAL_REQUIRED") {
    whatHappensNext = "Sensitive commercial approval is required. Do not invent a price, discount, or credit decision.";
    queueLabel = "Commercial approval";
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

function parseDecisionRow(row: Record<string, unknown>): WhatsAppOrderAutonomyDecision | null {
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
    governedFacts: asRecord(row.governed_facts),
    readinessSnapshot: asRecord(row.readiness_snapshot),
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
    return bt - at;
  });
  for (const decision of sorted) {
    if (!map.has(decision.packetId)) map.set(decision.packetId, decision);
  }
  return map;
}

export async function fetchWhatsAppOrderAutonomyDecisions(
  supabase: SupabaseClient,
  packetIds: string[],
): Promise<Map<string, WhatsAppOrderAutonomyDecision>> {
  const ids = [...new Set(packetIds.filter(Boolean))].slice(0, 200);
  if (ids.length === 0) return new Map();

  // Generated types lag CORE-A/B tables; inbox remains read-only here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decisionQuery = supabase.from("whatsapp_order_autonomy_decisions" as any)
    .select("id,packet_id,case_id,potential_order_id,interpretation_id,autonomy_outcome,decision_reasons,blocking_reasons,governed_facts,readiness_snapshot,evaluated_at")
    .in("packet_id", ids)
    .order("evaluated_at", { ascending: false });
  const { data: decisionRows, error: decisionError } = await decisionQuery;
  if (decisionError) {
    console.warn("[OperatorInbox] autonomy decision lookup failed", decisionError.message);
    return new Map();
  }

  const parsed = (Array.isArray(decisionRows) ? decisionRows : [])
    .map((row) => parseDecisionRow(asRecord(row)))
    .filter((row): row is WhatsAppOrderAutonomyDecision => row !== null);
  const byPacket = latestAutonomyByPacket(parsed);
  const decisionIds = [...byPacket.values()].map((row) => row.id);
  if (decisionIds.length === 0) return byPacket;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: executionRows, error: executionError } = await supabase
    .from("whatsapp_order_autonomy_draft_executions" as any)
    .select("autonomy_decision_id,execution_status,blocking_reason,sales_order_draft_id,promoted_order_id")
    .in("autonomy_decision_id", decisionIds);
  if (executionError) {
    console.warn("[OperatorInbox] autonomy draft execution lookup failed", executionError.message);
    return byPacket;
  }

  const executions = new Map<string, Record<string, unknown>>();
  for (const row of Array.isArray(executionRows) ? executionRows : []) {
    const rec = asRecord(row);
    const id = text(rec.autonomy_decision_id, 80);
    if (id) executions.set(id, rec);
  }
  for (const [packetId, decision] of byPacket) {
    const execution = executions.get(decision.id);
    if (!execution) continue;
    const status = text(execution.execution_status, 80);
    byPacket.set(packetId, {
      ...decision,
      draftStatus: isDraftStatus(status) ? status : null,
      draftBlockingReason: text(execution.blocking_reason, 400),
      salesOrderDraftId: text(execution.sales_order_draft_id, 80),
      promotedOrderId: text(execution.promoted_order_id, 80),
    });
  }
  return byPacket;
}
