/**
 * Point 64 — company-scoped customer health / risk / next-best-action read contract.
 * Advisory projection only — no production mutation, no ML, no invented sentiment.
 */

export type CustomerHealthCategory = "healthy" | "watch" | "at_risk" | "critical" | "indeterminate";

export type CustomerHealthRiskLevel = "none" | "low" | "medium" | "high" | "critical";

export type CustomerHealthSignalAvailability = "available" | "partial" | "unavailable";

/** Authoritative signal identifiers surfaced by Point64 census. */
export type CustomerHealthSignalId =
  | "credit_outstanding_balance"
  | "credit_limit_utilization"
  | "open_support_tickets"
  | "communication_recency"
  | "overdue_crm_tasks"
  | "stuck_order_fulfilment"
  | "finance_ageing_exposure"
  | "customer_sentiment"
  | "repeat_order_expectation"
  | "sales_trajectory";

export type CustomerHealthSignalFact = {
  signalId: CustomerHealthSignalId;
  availability: "available";
  label: string;
  value: string;
  /** ISO timestamp of the underlying authoritative row/event, when known. */
  observedAt: string | null;
  /** Durable source table or slice binding. */
  sourceAuthority: string;
  sourceRecordId: string | null;
  freshness: "fresh" | "aging" | "stale" | "unknown";
  contributesToRisk: boolean;
};

export type CustomerHealthUnavailableSignal = {
  signalId: CustomerHealthSignalId;
  availability: "unavailable";
  programmeOwner: string;
  reason: string;
};

export type CustomerHealthRiskDimension = {
  dimensionId:
    | "commercial_exposure"
    | "support_complaint"
    | "engagement"
    | "task_discipline"
    | "fulfilment";
  label: string;
  level: CustomerHealthRiskLevel;
  score: number;
  contributingFacts: CustomerHealthSignalFact[];
  unavailableInputs: CustomerHealthUnavailableSignal[];
};

/** Advisory only — maps to governed Point62/63 capabilities or explicit unavailable. */
export type CustomerHealthAdvisoryActionCapability =
  | "POINT62_capture_call"
  | "POINT62_capture_note"
  | "POINT62_capture_whatsapp_intent"
  | "POINT62_capture_promise"
  | "POINT63_create_task"
  | "POINT59_view_orders"
  | "POINT59_view_tickets"
  | "POINT77_finance_review"
  | "unavailable_not_governed";

export type CustomerHealthNextBestAction = {
  actionId: string;
  priority: number;
  advisoryLabel: string;
  rationale: string;
  capability: CustomerHealthAdvisoryActionCapability;
  /** Staff route hint when capability exists — never a customer-facing surface. */
  staffRouteHint: string | null;
  availability: "advisory" | "unavailable";
  programmeOwner: string;
};

export type CustomerHealthReadModel = {
  companyId: string;
  projectedAt: string;
  category: CustomerHealthCategory;
  /** 0–100 confidence in the projection; reduced when authoritative inputs are missing. */
  confidence: number;
  riskDimensions: CustomerHealthRiskDimension[];
  availableSignals: CustomerHealthSignalFact[];
  unavailableSignals: CustomerHealthUnavailableSignal[];
  nextBestActions: CustomerHealthNextBestAction[];
};

export type CustomerHealthProjectionInput = {
  companyId: string;
  profile: {
    totalOutstanding: number | null;
    creditLimit: number | null;
    allowCredit: boolean | null;
    currentBalance: number | null;
    observedAt: string | null;
  };
  orders: Array<{
    orderId: string;
    status: string | null;
    createdAt: string | null;
  }>;
  tasks: Array<{
    id: string;
    status: string | null;
    dueDate: string | null;
  }>;
  tickets: Array<{
    id: string;
    status: string;
    issueType: string;
    createdAt: string | null;
  }>;
  communications: Array<{
    entryId: string;
    occurredAt: string;
  }>;
  /** When upstream slices failed, health projection must fail closed. */
  upstreamErrors: string[];
};
