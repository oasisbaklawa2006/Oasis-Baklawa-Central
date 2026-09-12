import {
  ArAgeingBucket,
  ArAgeingBucketAmount,
  AgeingFactsAvailability,
  CompanyArAgeingFacts,
  STANDARD_AR_AGEING_BUCKETS,
  POINT81_CORE_PREREQUISITES,
} from "./financeAgeingContracts";

export class FinanceAgeingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceAgeingError";
  }
}

export type AgeingProjection =
  | {
      availability: "core_facts";
      facts: CompanyArAgeingFacts;
      bucketParityValid: true;
    }
  | {
      availability: "upstream_unavailable";
      prerequisiteRpc: string;
      reason: string;
      bucketParityValid: false;
    };

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FinanceAgeingError(`Invalid ${field} from Core ageing authority`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) throw new FinanceAgeingError(`Invalid ${field} from Core ageing authority`);
  return n;
}

function row<T>(data: unknown, operation: string): T {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") throw new FinanceAgeingError(`${operation} returned no governed result`);
  return value as T;
}

function parseBucket(value: unknown): ArAgeingBucketAmount {
  if (!value || typeof value !== "object") throw new FinanceAgeingError("Invalid ageing bucket from Core");
  const bucket = (value as Record<string, unknown>).bucket;
  if (typeof bucket !== "string" || !STANDARD_AR_AGEING_BUCKETS.includes(bucket as ArAgeingBucket)) {
    throw new FinanceAgeingError(`Unknown ageing bucket: ${String(bucket)}`);
  }
  return {
    bucket: bucket as ArAgeingBucket,
    amount: requiredNumber((value as Record<string, unknown>).amount, "bucket amount"),
  };
}

export function parseCompanyArAgeingFacts(value: unknown): CompanyArAgeingFacts {
  const facts = row<Record<string, unknown>>(value, "getCompanyArAgeingFacts");
  if (facts.ageing_facts_only !== true) {
    throw new FinanceAgeingError("Core ageing response is not factual-only");
  }
  const bucketsRaw = facts.buckets;
  if (!Array.isArray(bucketsRaw)) throw new FinanceAgeingError("Core ageing buckets are missing");
  const buckets = bucketsRaw.map(parseBucket);
  const factsOut: CompanyArAgeingFacts = {
    company_id: requiredString(facts.company_id, "company id"),
    as_of_date: requiredString(facts.as_of_date, "as-of date"),
    ageing_facts_only: true,
    buckets,
    total_outstanding: requiredNumber(facts.total_outstanding, "total outstanding"),
  };
  assertAgeingBucketParity(factsOut);
  return factsOut;
}

/** Deterministic parity: bucket sum must equal total_outstanding within 0.01 INR. */
export function assertAgeingBucketParity(facts: CompanyArAgeingFacts): void {
  const sum = facts.buckets.reduce((acc, b) => acc + b.amount, 0);
  if (Math.abs(sum - facts.total_outstanding) > 0.01) {
    throw new FinanceAgeingError("Ageing bucket sum does not match total_outstanding");
  }
  const seen = new Set(facts.buckets.map((b) => b.bucket));
  if (seen.size !== facts.buckets.length) {
    throw new FinanceAgeingError("Duplicate ageing buckets in Core facts");
  }
}

export function projectAgeingFromCore(value: unknown): AgeingProjection {
  try {
    const facts = parseCompanyArAgeingFacts(value);
    return { availability: "core_facts", facts, bucketParityValid: true };
  } catch {
    return {
      availability: "upstream_unavailable",
      prerequisiteRpc: POINT81_CORE_PREREQUISITES.arAgeing.rpc,
      reason: POINT81_CORE_PREREQUISITES.arAgeing.blocker,
      bucketParityValid: false,
    };
  }
}

export function unavailableAgeingProjection(): AgeingProjection {
  return {
    availability: "upstream_unavailable",
    prerequisiteRpc: POINT81_CORE_PREREQUISITES.arAgeing.rpc,
    reason: POINT81_CORE_PREREQUISITES.arAgeing.blocker,
    bucketParityValid: false,
  };
}

export function ageingAvailabilityLabel(availability: AgeingFactsAvailability): string {
  return availability === "core_facts" ? "Core ageing facts" : "Ageing unavailable — Core RPC required";
}
