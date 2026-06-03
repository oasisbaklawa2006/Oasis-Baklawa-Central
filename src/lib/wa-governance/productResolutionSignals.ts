import type { ProductResolutionTextSignals } from "./productResolutionTypes";

const PRODUCT_KEYWORDS = [
  "baklava",
  "baklawa",
  "mamoul",
  "maamoul",
  "turkish delight",
  "lokum",
  "dates",
  "kunefe",
  "kunafa",
  "dragees",
  "chocolate",
  "gift box",
  "tin pack",
  "acrylic box",
  "basbousa",
  "namoura",
  "barfi",
  "peda",
  "halwa",
  "rasgulla",
  "gulab jamun",
  "sandesh",
  "motichoor",
  "laddu",
  "pistachio",
  "kaju",
  "assorted",
  "mixed",
  "tray",
  "carton",
  "tin",
  "acrylic",
];

const PACK_FORMAT_TOKENS = [
  "tin",
  "tins",
  "carton",
  "cartons",
  "box",
  "boxes",
  "tray",
  "trays",
  "acrylic",
  "gift box",
  "tin pack",
  "case",
  "cases",
  "pack",
  "packs",
];

const WEIGHT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|gm|gms|gram|grams|g)\b/gi;
const PIECE_COUNT_PATTERN = /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/gi;
const QUANTITY_PATTERN =
  /\b(\d+(?:\.\d+)?)\s+(?:(?:[A-Za-z]+\s+){0,3})?(boxes?|box|pcs?|pieces?|cartons?|ctns?|cases?|units?|tins?|trays?|packs?)\b/gi;

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value || value.length < 2) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normalizeWeightToGrams(value: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("k")) return Math.round(value * 1000);
  return Math.round(value);
}

export function buildProductResolutionCombinedText(
  messageText: string,
  stitchedPlainText?: string,
): string {
  return [messageText, stitchedPlainText].filter(Boolean).join("\n").trim();
}

function extractKeywordHits(text: string): string[] {
  const lower = text.toLowerCase();
  return PRODUCT_KEYWORDS.filter((keyword) => lower.includes(keyword)).map((keyword) =>
    keyword.replace(/\b\w/g, (char) => char.toUpperCase()),
  );
}

function extractQuotedProductNames(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(/["'“”‘’]([^"'“”‘’\n]{2,48})["'“”‘’]/g)) {
    if (match[1]) names.push(match[1].trim());
  }
  return names;
}

function extractProductPhraseCandidates(text: string): string[] {
  const phrases: string[] = [];
  const patterns = [
    /\bneed\s+\d+(?:\.\d+)?\s+([A-Za-z][A-Za-z0-9\s-]{2,40})/gi,
    /\bsend\s+\d+(?:\.\d+)?\s+([A-Za-z][A-Za-z0-9\s-]{2,40})/gi,
    /\b(\d+(?:\.\d+)?\s*(?:kg|gm|g|pc|pcs|boxes?|cartons?)\s+[A-Za-z][A-Za-z0-9\s-]{2,40})/gi,
    /\b([A-Za-z][A-Za-z0-9\s-]{2,40})\s+(?:tin|tins|box|boxes|carton|cartons|tray|trays)\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = (match[1] ?? match[0]).trim();
      if (candidate.length >= 3) phrases.push(candidate);
    }
  }
  return phrases;
}

export function extractWeightTokens(text: string): { tokens: string[]; grams: number[] } {
  const tokens: string[] = [];
  const grams: number[] = [];
  for (const match of text.matchAll(WEIGHT_PATTERN)) {
    const amount = Number.parseFloat(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount) || !unit) continue;
    tokens.push(`${match[1]}${unit}`.toLowerCase());
    grams.push(normalizeWeightToGrams(amount, unit));
  }
  return { tokens: uniqueStrings(tokens), grams: [...new Set(grams)] };
}

export function extractPieceCountTokens(text: string): { tokens: string[]; counts: number[] } {
  const tokens: string[] = [];
  const counts: number[] = [];
  for (const match of text.matchAll(PIECE_COUNT_PATTERN)) {
    const count = Number.parseInt(match[1], 10);
    if (!Number.isFinite(count)) continue;
    tokens.push(`${count}pc`);
    counts.push(count);
  }
  return { tokens: uniqueStrings(tokens), counts: [...new Set(counts)] };
}

export function extractQuantityReferences(
  text: string,
): Array<{ quantity: number; unit: string }> {
  const refs: Array<{ quantity: number; unit: string }> = [];
  for (const match of text.matchAll(QUANTITY_PATTERN)) {
    const quantity = Number.parseFloat(match[1]);
    const unit = match[2]?.toLowerCase() ?? "";
    if (!Number.isFinite(quantity) || !unit) continue;
    refs.push({ quantity, unit });
  }
  return refs;
}

export function extractPackFormatTokens(text: string): string[] {
  const lower = text.toLowerCase();
  return uniqueStrings(PACK_FORMAT_TOKENS.filter((token) => lower.includes(token)));
}

export function productNameMatchesTerm(productName: string, term: string): boolean {
  const name = productName.toLowerCase();
  const needle = term.toLowerCase();
  if (name === needle) return true;
  if (name.includes(needle)) return true;
  return needle.split(/\s+/).every((part) => part.length >= 3 && name.includes(part));
}

export function extractProductResolutionTextSignals(
  messageText: string,
  stitchedPlainText?: string,
): ProductResolutionTextSignals {
  const combinedText = buildProductResolutionCombinedText(messageText, stitchedPlainText);
  const keywordHits = extractKeywordHits(combinedText);
  const quotedNames = extractQuotedProductNames(combinedText);
  const phraseCandidates = extractProductPhraseCandidates(combinedText);
  const weight = extractWeightTokens(combinedText);
  const pieceCounts = extractPieceCountTokens(combinedText);

  const productNameCandidates = uniqueStrings([
    ...quotedNames,
    ...phraseCandidates,
    ...keywordHits,
  ]).slice(0, 10);

  return {
    combinedText,
    productNameCandidates,
    aliasCandidates: uniqueStrings([...keywordHits, ...quotedNames, ...phraseCandidates]).slice(
      0,
      12,
    ),
    weightTokens: weight.tokens,
    weightGrams: weight.grams,
    pieceCountTokens: pieceCounts.tokens,
    pieceCounts: pieceCounts.counts,
    packFormatTokens: extractPackFormatTokens(combinedText),
    catalogKeywords: keywordHits,
    quantityReferences: extractQuantityReferences(combinedText),
  };
}
