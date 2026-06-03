import type {
  QuantityMatchKind,
  QuantityResolutionConfidenceBand,
  QuantityResolutionEntry,
  QuantityResolutionResult,
  QuantityResolutionTextSignals,
  RawQuantityMatch,
} from "./quantityResolutionTypes";

export const QUANTITY_SIGNAL_WEIGHTS = {
  explicitWithUnit: 0.98,
  explicitQtyOnly: 0.78,
  wordQuantity: 0.62,
} as const;

const MAX_SCORE = 0.98;

function weightForKind(kind: QuantityMatchKind): number {
  switch (kind) {
    case "explicit_with_unit":
      return QUANTITY_SIGNAL_WEIGHTS.explicitWithUnit;
    case "explicit_qty_only":
      return QUANTITY_SIGNAL_WEIGHTS.explicitQtyOnly;
    default:
      return QUANTITY_SIGNAL_WEIGHTS.wordQuantity;
  }
}

export function formatQuantityConfidencePercent(score: number): number {
  return Math.round(Math.min(MAX_SCORE, Math.max(0, score)) * 100);
}

export function confidenceBandFromQuantityScore(
  confidence: number,
): QuantityResolutionConfidenceBand {
  if (confidence >= 95) return "auto_highlight";
  if (confidence >= 70) return "suggested";
  return "needs_clarification";
}

function buildReason(match: RawQuantityMatch): string {
  const unitLabel = match.unit ?? "units";
  switch (match.kind) {
    case "explicit_with_unit":
      if (match.productHint) {
        return `Detected "${match.rawText.trim()}" as ${match.value} ${unitLabel} for ${match.productHint}`;
      }
      return `Detected explicit quantity ${match.value} ${unitLabel} in message`;
    case "explicit_qty_only":
      return `Detected explicit quantity ${match.value} without a recognized unit`;
    default:
      return `Interpreted "${match.rawText.trim()}" as ${match.value} ${unitLabel} from word quantity`;
  }
}

function scoreMatch(
  match: RawQuantityMatch,
  scoredSignals: Set<string>,
): QuantityResolutionEntry | null {
  const signalKey = [
    match.kind,
    match.value,
    match.unit ?? "",
    match.productHint ?? "",
  ].join(":");
  if (scoredSignals.has(signalKey)) return null;
  scoredSignals.add(signalKey);

  const score = weightForKind(match.kind);
  const confidence = formatQuantityConfidencePercent(score);
  return {
    rawQuantity: match.value,
    rawUnit: match.unit,
    conversionStatus: "unknown",
    productHint: match.productHint,
    confidence,
    reasons: [buildReason(match)],
    band: confidenceBandFromQuantityScore(confidence),
  };
}

export interface ScoreQuantityResolutionInput {
  signals: QuantityResolutionTextSignals;
}

function sortQuantityEntries(entries: QuantityResolutionEntry[]): QuantityResolutionEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      a.rawQuantity - b.rawQuantity ||
      (a.rawUnit ?? "").localeCompare(b.rawUnit ?? "") ||
      (a.productHint ?? "").localeCompare(b.productHint ?? ""),
  );
}

/**
 * Collapse overlapping parser duplicates for the same quantity+unit.
 * Keeps hint-bearing lines when a bare qty+unit shadow match also exists.
 */
export function collapseDuplicateQuantityEntries(
  entries: QuantityResolutionEntry[],
): QuantityResolutionEntry[] {
  const groups = new Map<string, QuantityResolutionEntry[]>();
  for (const entry of entries) {
    const key = `${entry.rawQuantity}:${entry.rawUnit ?? ""}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const collapsed: QuantityResolutionEntry[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      collapsed.push(group[0]);
      continue;
    }

    const hinted = group.filter((entry) => entry.productHint?.trim());
    if (hinted.length > 0) {
      collapsed.push(...hinted);
      continue;
    }

    collapsed.push(group[0]);
  }

  return sortQuantityEntries(collapsed);
}

export function scoreQuantityResolutionCandidates(
  input: ScoreQuantityResolutionInput,
): QuantityResolutionResult {
  const scoredSignals = new Set<string>();
  const quantities = collapseDuplicateQuantityEntries(
    input.signals.matches
      .map((match) => scoreMatch(match, scoredSignals))
      .filter((entry): entry is QuantityResolutionEntry => entry != null),
  );

  const topConfidence = quantities[0]?.confidence ?? 0;
  return {
    quantities,
    band: confidenceBandFromQuantityScore(topConfidence),
  };
}
