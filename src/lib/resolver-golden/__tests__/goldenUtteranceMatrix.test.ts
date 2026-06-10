import { describe, expect, it } from "vitest";
import { GOLDEN_UTTERANCE_MATRIX, goldenMatrixStats } from "../goldenUtteranceMatrix";

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
});
