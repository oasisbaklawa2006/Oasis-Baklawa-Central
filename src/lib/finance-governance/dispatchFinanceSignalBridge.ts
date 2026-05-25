import type { FinanceDispatchSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import { projectFinanceRelease } from "./financeReleaseEligibility";
import type { FinanceGovernanceInput } from "./financeGovernanceTypes";

/** Derives dispatch finance signal from Phase 4C governance — ready ≠ dispatched. */
export function deriveDispatchFinanceSignalFromGovernance(
  input: FinanceGovernanceInput,
): FinanceDispatchSignal {
  return projectFinanceRelease(input).dispatchFinanceSignal;
}
