import type { ApprovalKind } from "./approvalMatrix";

export interface OverrideRule {
  kind: ApprovalKind;
  rule: string;
  reversible: boolean;
}

export const OVERRIDE_RULES: OverrideRule[] = [
  { kind: "dispatch_override", rule: "Dual control + finance note required", reversible: false },
  { kind: "stock_override", rule: "Inventory controller + CMD acknowledgement", reversible: true },
  { kind: "pricing_override", rule: "Finance head + commercial audit trail", reversible: false },
];
