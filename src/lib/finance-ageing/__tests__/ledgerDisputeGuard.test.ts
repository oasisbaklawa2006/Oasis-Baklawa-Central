import { describe, expect, it } from "vitest";
import {
  assertNoDirectLedgerDisputeTableWrite,
  isGovernedWriteUnavailable,
  ledgerDisputeGuardMessage,
  ledgerDisputeResolutionAvailability,
  LedgerDisputeWriteBlockedError,
  resolveLedgerDispute,
} from "../ledgerDisputeGuard";
import { POINT81_CORE_PREREQUISITES } from "../financeAgeingContracts";

describe("Point81 ledger dispute guard", () => {
  it("declares resolve_ledger_dispute_v1 as unavailable prerequisite", () => {
    const availability = ledgerDisputeResolutionAvailability();
    expect(availability.available).toBe(false);
    expect(isGovernedWriteUnavailable(availability)).toBe(true);
    if (isGovernedWriteUnavailable(availability)) {
      expect(availability.prerequisiteRpc).toBe(POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.rpc);
    }
  });

  it("blocks direct ledger_disputes and bi_monthly_ledgers mutations", () => {
    expect(() => assertNoDirectLedgerDisputeTableWrite("ledger_disputes")).toThrow(LedgerDisputeWriteBlockedError);
    expect(() => assertNoDirectLedgerDisputeTableWrite("bi_monthly_ledgers")).toThrow(LedgerDisputeWriteBlockedError);
    expect(() => assertNoDirectLedgerDisputeTableWrite("orders")).not.toThrow();
  });

  it("fails closed on resolveLedgerDispute without shadow implementation", async () => {
    await expect(
      resolveLedgerDispute({
        disputeId: "dispute-1",
        ledgerId: "ledger-1",
        companyId: "company-1",
        resolutionNotes: "Settled via CN",
        actorId: "actor-1",
        correlationId: "corr-1",
        idempotencyKey: "idem-1",
      }),
    ).rejects.toMatchObject({ prerequisiteRpc: POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.rpc });
  });

  it("surfaces operator-facing guard message", () => {
    expect(ledgerDisputeGuardMessage()).toContain(POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.rpc);
  });
});
