import { extractIdentityKeywordHits } from "./productResolutionAliasPolicy";
import type {
  QuantityMatchKind,
  QuantityResolutionTextSignals,
  RawQuantityMatch,
} from "./quantityResolutionTypes";

const SIMPLE_QTY_UNIT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s+(boxes?|box|tins?|tin|trays?|tray|pcs?|pc|pieces?|piece|cartons?|carton|ctns?|ctn|cases?|case|units?|unit|packs?|pack)\b/gi;

const QTY_PRODUCT_UNIT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s+([A-Za-z][A-Za-z\s-]{2,40})\s+(boxes?|box|tins?|tin|trays?|tray|pcs?|pc|pieces?|piece|cartons?|carton|ctns?|ctn|cases?|case|units?|unit|packs?|pack)\b/gi;

const QTY_UNIT_THEN_PRODUCT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s+(cartons?|carton|ctns?|ctn|cases?|case|boxes?|box|packs?|pack)\s+([A-Za-z][A-Za-z\s-]{2,40})\b/gi;

const WEIGHT_ORDER_PATTERN =
  /\b(?:need|send|want|order|qty|quantity)\s+(?:me\s+)?(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|gm|gms|grams?|g)\b/gi;

const EXPLICIT_QTY_ONLY_PATTERN =
  /\b(?:need|send|want|order|qty|quantity)\s+(?:me\s+)?(\d+(?:\.\d+)?)\b(?!\s*(?:\/|\d))(?!\s+(?:[A-Za-z][A-Za-z\s-]{0,40}\s+)?(?:boxes?|box|tins?|tin|trays?|tray|pcs?|pc|pieces?|piece|cartons?|carton|ctns?|ctn|cases?|case|units?|unit|packs?|pack|kg|kgs|gm|gms|grams?|g)\b)(?:\s*(?:please|confirm|total|only|[,.!]|$))?/gi;

const DOZEN_PATTERN = /\b(\d+(?:\.\d+)?)\s+dozen\b/gi;
const HALF_DOZEN_PATTERN = /\bhalf\s+dozen\b/gi;
const PAIR_PATTERN = /\b(\d+(?:\.\d+)?)\s+pairs?\b|\bpair\b/gi;

const EXCLUDED_SPAN_PATTERNS = [
  /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g,
  /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/gi,
  /\bSO[-\s#][0-9A-Z-]{4,18}\b/gi,
  /\bORD(?:ER)?[-\s#][0-9A-Z-]{4,18}\b/gi,
  /\border\s*(?:#|no\.?|number)\s*[:\-]?\s*[0-9A-Z-]{4,18}\b/gi,
  /\b(?:client\s*code|code)\s*[:\-]?\s*\d{3,8}\b/gi,
] as const;

const UNIT_NORMALIZATION: Record<string, string> = {
  box: "boxes",
  boxes: "boxes",
  tin: "tins",
  tins: "tins",
  tray: "trays",
  trays: "trays",
  pc: "pcs",
  pcs: "pcs",
  piece: "pieces",
  pieces: "pieces",
  carton: "cartons",
  cartons: "cartons",
  ctn: "cartons",
  ctns: "cartons",
  case: "cases",
  cases: "cases",
  pack: "packs",
  packs: "packs",
  unit: "units",
  units: "units",
  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  gm: "gm",
  gms: "gm",
  gram: "gm",
  grams: "gm",
  g: "gm",
};

export function buildQuantityResolutionCombinedText(
  messageText: string,
  stitchedPlainText?: string,
): string {
  return [messageText, stitchedPlainText].filter(Boolean).join("\n").trim();
}

export function normalizeQuantityUnit(rawUnit: string | null): string | null {
  if (!rawUnit) return null;
  const key = rawUnit.trim().toLowerCase();
  return UNIT_NORMALIZATION[key] ?? key;
}

function collectExcludedRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const pattern of EXCLUDED_SPAN_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match.index == null) continue;
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}

function overlapsExcludedSpan(
  start: number,
  end: number,
  excluded: Array<{ start: number; end: number }>,
): boolean {
  return excluded.some((range) => start < range.end && end > range.start);
}

function titleCaseHint(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function extractProductHintFromPhrase(phrase: string): string | null {
  const hits = extractIdentityKeywordHits(phrase);
  return hits[0] ? titleCaseHint(hits[0]) : null;
}

function extractMiddleProductHint(middle: string | undefined): string | null {
  if (!middle) return null;
  const cleaned = middle.trim().replace(/\b(and|of|assorted|mixed)\b/gi, " ").trim();
  if (!cleaned) return null;
  return extractProductHintFromPhrase(cleaned);
}

function pushMatch(
  matches: RawQuantityMatch[],
  seen: Set<string>,
  excluded: Array<{ start: number; end: number }>,
  candidate: Omit<RawQuantityMatch, "sourceSpan"> & { sourceSpan: { start: number; end: number } },
): void {
  const { start, end } = candidate.sourceSpan;
  if (overlapsExcludedSpan(start, end, excluded)) return;

  const dedupeKey = [
    candidate.kind,
    candidate.value,
    candidate.unit ?? "",
    candidate.productHint ?? "",
  ].join(":");
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  matches.push(candidate);
}

export function extractQuantityResolutionTextSignals(
  messageText: string,
  stitchedPlainText?: string,
): QuantityResolutionTextSignals {
  const combinedText = buildQuantityResolutionCombinedText(messageText, stitchedPlainText);
  const excluded = collectExcludedRanges(combinedText);
  const matches: RawQuantityMatch[] = [];
  const seen = new Set<string>();

  for (const match of combinedText.matchAll(SIMPLE_QTY_UNIT_PATTERN)) {
    const value = Number.parseFloat(match[1]);
    const rawUnit = match[2];
    if (!Number.isFinite(value) || !rawUnit || match.index == null) continue;

    const start = match.index;
    const end = start + match[0].length;
    pushMatch(matches, seen, excluded, {
      value,
      unit: normalizeQuantityUnit(rawUnit),
      productHint: null,
      kind: "explicit_with_unit",
      sourceSpan: { start, end },
      rawText: match[0],
    });
  }

  for (const match of combinedText.matchAll(QTY_PRODUCT_UNIT_PATTERN)) {
    const value = Number.parseFloat(match[1]);
    const middle = match[2]?.trim();
    const rawUnit = match[3];
    if (!Number.isFinite(value) || !rawUnit || match.index == null) continue;

    const start = match.index;
    const end = start + match[0].length;
    pushMatch(matches, seen, excluded, {
      value,
      unit: normalizeQuantityUnit(rawUnit),
      productHint: extractMiddleProductHint(middle),
      kind: "explicit_with_unit",
      sourceSpan: { start, end },
      rawText: match[0],
    });
  }

  for (const match of combinedText.matchAll(QTY_UNIT_THEN_PRODUCT_PATTERN)) {
    const value = Number.parseFloat(match[1]);
    const rawUnit = match[2];
    const productPhrase = match[3]?.trim();
    if (!Number.isFinite(value) || !rawUnit || match.index == null) continue;

    const start = match.index;
    const end = start + match[0].length;
    pushMatch(matches, seen, excluded, {
      value,
      unit: normalizeQuantityUnit(rawUnit),
      productHint: extractProductHintFromPhrase(productPhrase ?? ""),
      kind: "explicit_with_unit",
      sourceSpan: { start, end },
      rawText: match[0],
    });
  }

  for (const match of combinedText.matchAll(WEIGHT_ORDER_PATTERN)) {
    const value = Number.parseFloat(match[1]);
    const rawUnit = match[2];
    if (!Number.isFinite(value) || !rawUnit || match.index == null) continue;

    const start = match.index;
    const end = start + match[0].length;
    pushMatch(matches, seen, excluded, {
      value,
      unit: normalizeQuantityUnit(rawUnit),
      productHint: null,
      kind: "explicit_with_unit",
      sourceSpan: { start, end },
      rawText: match[0],
    });
  }

  for (const match of combinedText.matchAll(EXPLICIT_QTY_ONLY_PATTERN)) {
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value) || match.index == null) continue;

    const start = match.index;
    const end = start + match[0].length;
    if (matches.some((existing) => start < existing.sourceSpan.end && end > existing.sourceSpan.start)) {
      continue;
    }
    pushMatch(matches, seen, excluded, {
      value,
      unit: null,
      productHint: null,
      kind: "explicit_qty_only",
      sourceSpan: { start, end },
      rawText: match[0],
    });
  }

  for (const match of combinedText.matchAll(DOZEN_PATTERN)) {
    const multiplier = match[1] ? Number.parseFloat(match[1]) : 1;
    if (!Number.isFinite(multiplier) || match.index == null) continue;

    const start = match.index;
    const end = start + match[0].length;
    pushMatch(matches, seen, excluded, {
      value: Math.round(multiplier * 12),
      unit: "pcs",
      productHint: null,
      kind: "word_quantity",
      sourceSpan: { start, end },
      rawText: match[0],
    });
  }

  for (const match of combinedText.matchAll(HALF_DOZEN_PATTERN)) {
    if (match.index == null) continue;
    const start = match.index;
    const end = start + match[0].length;
    pushMatch(matches, seen, excluded, {
      value: 6,
      unit: "pcs",
      productHint: null,
      kind: "word_quantity",
      sourceSpan: { start, end },
      rawText: match[0],
    });
  }

  for (const match of combinedText.matchAll(PAIR_PATTERN)) {
    if (match.index == null) continue;
    const multiplier = match[1] ? Number.parseFloat(match[1]) : 1;
    if (!Number.isFinite(multiplier)) continue;

    const start = match.index;
    const end = start + match[0].length;
    pushMatch(matches, seen, excluded, {
      value: Math.round(multiplier * 2),
      unit: "pcs",
      productHint: null,
      kind: "word_quantity",
      sourceSpan: { start, end },
      rawText: match[0],
    });
  }

  matches.sort((a, b) => a.sourceSpan.start - b.sourceSpan.start);
  return { combinedText, matches };
}
