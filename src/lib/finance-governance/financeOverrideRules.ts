import { requireOverrideReason } from "./financeEvidenceModel";
import type { FinanceGovernanceWriteContext } from "./financeGovernanceTypes";

export function assertOverrideContext(ctx: FinanceGovernanceWriteContext, actorRole: string): void {
  const role = actorRole.trim().toUpperCase();
  if (role === "SUPER_ADMIN") {
    requireOverrideReason(ctx.overrideReason);
  }
}
