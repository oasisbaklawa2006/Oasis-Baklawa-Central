import type { GovernedWriteAvailability, LedgerDisputeResolutionInput } from "./financeAgeingContracts";
import { POINT81_CORE_PREREQUISITES } from "./financeAgeingContracts";

export class LedgerDisputeWriteBlockedError extends Error {
  readonly prerequisiteRpc: string;

  constructor(message: string, prerequisiteRpc: string) {
    super(message);
    this.name = "LedgerDisputeWriteBlockedError";
    this.prerequisiteRpc = prerequisiteRpc;
  }
}

const FORBIDDEN_LEDGER_DISPUTE_TABLES = ["ledger_disputes", "bi_monthly_ledgers"] as const;

export function isGovernedWriteUnavailable(
  availability: GovernedWriteAvailability,
): availability is { available: false; prerequisiteRpc: string; reason: string } {
  return availability.available === false;
}

export function ledgerDisputeResolutionAvailability(): GovernedWriteAvailability {
  return {
    available: false,
    prerequisiteRpc: POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.rpc,
    reason: POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.blocker,
  };
}

export function assertNoDirectLedgerDisputeTableWrite(table: string): void {
  if (FORBIDDEN_LEDGER_DISPUTE_TABLES.includes(table as (typeof FORBIDDEN_LEDGER_DISPUTE_TABLES)[number])) {
    throw new LedgerDisputeWriteBlockedError(
      `Direct ${table} mutation is forbidden in Central — use ${POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.rpc}`,
      POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.rpc,
    );
  }
}

/**
 * Governed dispute resolution entry point.
 * Fails closed until Core exposes resolve_ledger_dispute_v1.
 */
export async function resolveLedgerDispute(_input: LedgerDisputeResolutionInput): Promise<never> {
  const availability = ledgerDisputeResolutionAvailability();
  if (isGovernedWriteUnavailable(availability)) {
    throw new LedgerDisputeWriteBlockedError(availability.reason, availability.prerequisiteRpc);
  }
  throw new LedgerDisputeWriteBlockedError(
    POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.blocker,
    POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.rpc,
  );
}

export function ledgerDisputeGuardMessage(): string {
  const pre = POINT81_CORE_PREREQUISITES.ledgerDisputeResolve;
  return `${pre.rpc} required — ${pre.blocker}`;
}
