import { extractUtteranceSignals } from "@/lib/product-intelligence/utteranceSignals";
import type { GoldenExpectedOutcome, GoldenUtteranceCase } from "./types";

export function normalizeGoldenUtterance(utterance: string): string {
  return extractUtteranceSignals(utterance).normalized;
}

export interface NormalizedOracleConflict {
  normalizedUtterance: string;
  cases: Array<{
    id: string;
    expected: GoldenExpectedOutcome;
    utterance: string;
  }>;
}

/** Detect identical normalized utterances with differing expected outcomes. */
export function findNormalizedOracleConflicts(
  matrix: GoldenUtteranceCase[],
): NormalizedOracleConflict[] {
  const byNormalized = new Map<
    string,
    Array<{ id: string; expected: GoldenExpectedOutcome; utterance: string }>
  >();

  for (const row of matrix) {
    const normalized = normalizeGoldenUtterance(row.utterance);
    const bucket = byNormalized.get(normalized) ?? [];
    bucket.push({ id: row.id, expected: row.expected, utterance: row.utterance });
    byNormalized.set(normalized, bucket);
  }

  const conflicts: NormalizedOracleConflict[] = [];
  for (const [normalizedUtterance, cases] of byNormalized) {
    const expectedSet = new Set(cases.map((c) => c.expected));
    if (expectedSet.size > 1) {
      conflicts.push({ normalizedUtterance, cases });
    }
  }

  return conflicts.sort((a, b) => a.normalizedUtterance.localeCompare(b.normalizedUtterance));
}

export function assertGoldenMatrixOracleConsistency(matrix: GoldenUtteranceCase[]): void {
  const conflicts = findNormalizedOracleConflicts(matrix);
  if (conflicts.length === 0) return;

  const detail = conflicts
    .map(
      (c) =>
        `"${c.normalizedUtterance}": ${c.cases.map((row) => `${row.id}→${row.expected}`).join(", ")}`,
    )
    .join("; ");

  throw new Error(`Golden matrix oracle conflicts: ${detail}`);
}
