export type ApprovalKind =
  | "finance_release"
  | "stock_override"
  | "dispatch_override"
  | "reservation_approval"
  | "cancellation"
  | "pricing_override";

export interface ApprovalRequirement {
  kind: ApprovalKind;
  minApprovers: number;
  requiresCmd: boolean;
}

export const APPROVAL_REQUIREMENTS: ApprovalRequirement[] = [
  { kind: "finance_release", minApprovers: 1, requiresCmd: false },
  { kind: "stock_override", minApprovers: 2, requiresCmd: true },
  { kind: "dispatch_override", minApprovers: 2, requiresCmd: true },
  { kind: "reservation_approval", minApprovers: 1, requiresCmd: false },
  { kind: "cancellation", minApprovers: 2, requiresCmd: true },
  { kind: "pricing_override", minApprovers: 2, requiresCmd: true },
];
