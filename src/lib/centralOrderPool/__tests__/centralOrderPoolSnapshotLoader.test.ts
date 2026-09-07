import { describe, expect, it } from "vitest";
import { companyNameFromOrderRelation } from "@/lib/centralOrderPool/centralOrderPoolSnapshotLoader";

describe("centralOrderPoolSnapshotLoader", () => {
  it("projects company_name from the generated collection relation shape", () => {
    expect(companyNameFromOrderRelation([{ business_name: "Oasis Wholesale" }])).toBe("Oasis Wholesale");
    expect(companyNameFromOrderRelation([])).toBeNull();
    expect(companyNameFromOrderRelation(null)).toBeNull();
  });

  it("ignores unsafe object assertions when relation cardinality is singular", () => {
    expect(companyNameFromOrderRelation({ business_name: "Legacy singular row" })).toBe("Legacy singular row");
    expect(companyNameFromOrderRelation({ business_name: null })).toBeNull();
  });
});
