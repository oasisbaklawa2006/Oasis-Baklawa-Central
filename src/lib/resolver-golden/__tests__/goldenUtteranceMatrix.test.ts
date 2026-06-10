import { describe, expect, it } from "vitest";
import { extractUtteranceSignals } from "@/lib/product-intelligence/utteranceSignals";
import { GOLDEN_UTTERANCE_MATRIX, goldenMatrixStats } from "../goldenUtteranceMatrix";
import {
  assertGoldenMatrixOracleConsistency,
  findNormalizedOracleConflicts,
} from "../goldenMatrixValidation";

describe("goldenUtteranceMatrix", () => {
  it("contains 100+ utterance cases with unique ids", () => {
    const stats = goldenMatrixStats();
    expect(stats.total).toBeGreaterThanOrEqual(100);

    const ids = GOLDEN_UTTERANCE_MATRIX.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers required categories", () => {
    const stats = goldenMatrixStats();
    expect(stats.byCategory.batch001_specific).toBeGreaterThanOrEqual(50);
    expect(stats.byCategory.ambiguous_family).toBeGreaterThanOrEqual(10);
    expect(stats.byCategory.generic_only).toBeGreaterThanOrEqual(8);
    expect(stats.byCategory.multilingual).toBeGreaterThanOrEqual(8);
    expect(stats.byCategory.typo_tolerance).toBeGreaterThanOrEqual(6);
    expect(stats.byCategory.batch001_quantity).toBeGreaterThanOrEqual(10);
  });

  it("resolve cases include expectedSku", () => {
    for (const row of GOLDEN_UTTERANCE_MATRIX.filter((c) => c.expected === "resolve")) {
      expect(row.expectedSku, row.id).toBeTruthy();
    }
  });

  it("has no conflicting oracle expectations for identical normalized utterances", () => {
    expect(() => assertGoldenMatrixOracleConsistency(GOLDEN_UTTERANCE_MATRIX)).not.toThrow();
    expect(findNormalizedOracleConflicts(GOLDEN_UTTERANCE_MATRIX)).toEqual([]);
  });

  it("applies square baklawa family oracle: bare phrase clarifies, specific phrases resolve", () => {
    const rowsFor = (normalized: string) =>
      GOLDEN_UTTERANCE_MATRIX.filter(
        (row) => extractUtteranceSignals(row.utterance).normalized === normalized,
      );

    const squareRows = rowsFor("square baklawa");
    expect(squareRows.length).toBeGreaterThan(0);
    expect(squareRows.every((row) => row.expected === "clarify")).toBe(true);

    for (const normalized of ["plain square baklawa", "regular square baklawa"] as const) {
      const rows = rowsFor(normalized);
      expect(rows.length).toBe(1);
      expect(rows[0]?.expected).toBe("resolve");
      expect(rows[0]?.expectedSku).toBe("OAS-AS-BKL-0002");
    }

    const specialRows = rowsFor("special square baklawa");
    expect(specialRows.length).toBeGreaterThan(0);
    expect(specialRows.every((row) => row.expected === "resolve" && row.expectedSku === "OAS-AS-BKL-0009")).toBe(
      true,
    );
  });
});
