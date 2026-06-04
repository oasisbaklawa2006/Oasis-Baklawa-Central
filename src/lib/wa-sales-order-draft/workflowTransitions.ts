import type { SalesOrderDraftStatus } from "./types";

export type WorkflowTransition =
  | "SUBMIT_REVIEW"
  | "APPROVE"
  | "REJECT"
  | "UPDATE_OPERATOR_FINAL";

const TRANSITIONS: Record<
  SalesOrderDraftStatus,
  Partial<Record<WorkflowTransition, SalesOrderDraftStatus>>
> = {
  AI_DRAFT: {
    SUBMIT_REVIEW: "UNDER_REVIEW",
    UPDATE_OPERATOR_FINAL: "AI_DRAFT",
    REJECT: "REJECTED",
  },
  UNDER_REVIEW: {
    APPROVE: "APPROVED_FOR_SO",
    REJECT: "REJECTED",
    UPDATE_OPERATOR_FINAL: "UNDER_REVIEW",
  },
  APPROVED_FOR_SO: {},
  REJECTED: {},
};

export function getNextStatus(
  current: SalesOrderDraftStatus,
  transition: WorkflowTransition,
): SalesOrderDraftStatus | null {
  return TRANSITIONS[current][transition] ?? null;
}

export function isTerminalStatus(status: SalesOrderDraftStatus): boolean {
  return status === "APPROVED_FOR_SO" || status === "REJECTED";
}

export function statusLabel(status: SalesOrderDraftStatus): string {
  switch (status) {
    case "AI_DRAFT":
      return "AI Draft";
    case "UNDER_REVIEW":
      return "Under Review";
    case "APPROVED_FOR_SO":
      return "Approved for SO";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}
