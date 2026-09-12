import { describe, expect, it } from "vitest";
import {
  assertAgeingBucketParity,
  parseCompanyArAgeingFacts,
  projectAgeingFromCore,
  unavailableAgeingProjection,
} from "../ageingBucketProjection";
import { POINT81_CORE_PREREQUISITES } from "../financeAgeingContracts";

describe("Point81 ageing bucket projection", () => {
  it("parses Core ageing facts with deterministic bucket parity", () => {
    const facts = parseCompanyArAgeingFacts({
      ageing_facts_only: true,
      company_id: "company-a",
      as_of_date: "2026-09-06",
      total_outstanding: 150000,
      buckets: [
        { bucket: "current", amount: 50000 },
        { bucket: "1_30", amount: 40000 },
        { bucket: "31_60", amount: 30000 },
        { bucket: "61_90", amount: 20000 },
        { bucket: "over_90", amount: 10000 },
      ],
    });
    expect(facts.ageing_facts_only).toBe(true);
    assertAgeingBucketParity(facts);
    expect(facts.buckets).toHaveLength(5);
  });

  it("fails closed when bucket sum does not match total_outstanding", () => {
    expect(() =>
      parseCompanyArAgeingFacts({
        ageing_facts_only: true,
        company_id: "company-a",
        as_of_date: "2026-09-06",
        total_outstanding: 100,
        buckets: [{ bucket: "current", amount: 50 }],
      }),
    ).toThrow("bucket sum");
  });

  it("fails closed on duplicate buckets", () => {
    expect(() =>
      parseCompanyArAgeingFacts({
        ageing_facts_only: true,
        company_id: "company-a",
        as_of_date: "2026-09-06",
        total_outstanding: 100,
        buckets: [
          { bucket: "current", amount: 50 },
          { bucket: "current", amount: 50 },
        ],
      }),
    ).toThrow("Duplicate ageing buckets");
  });

  it("returns upstream_unavailable when Core facts are absent or invalid", () => {
    const projection = projectAgeingFromCore({ ageing_facts_only: false });
    expect(projection.availability).toBe("upstream_unavailable");
    expect(projection.bucketParityValid).toBe(false);
    if (projection.availability === "upstream_unavailable") {
      expect(projection.prerequisiteRpc).toBe(POINT81_CORE_PREREQUISITES.arAgeing.rpc);
    }
  });

  it("exposes unavailable projection without inventing buckets", () => {
    const projection = unavailableAgeingProjection();
    expect(projection.availability).toBe("upstream_unavailable");
    expect(projection.bucketParityValid).toBe(false);
  });
});
