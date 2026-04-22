/**
 * Banyan Parser — alias map, confidence scoring, contextual entity mapping.
 *
 * Confidence rules (Oasis 2.0):
 *   - Exact alias match (DB or hardcoded shorthand) → 1.0
 *   - Fuzzy match (Dice coefficient ≥ 0.5)         → 0.5–0.84  (NEEDS CLARIFICATION)
 *   - No match                                      → omitted
 *
 * Any SKU below 0.85 → order is flagged `needs_clarification` and shown ORANGE.
 */

// Anti-hallucination: any token below 0.95 with no exact alias hit is dropped entirely.
// Tokens with exact alias hits remain at confidence 1.0; fuzzy is no longer trusted.
// STRICT MAPPING: an exact alias from products.aliases[] or product_aliases ALWAYS wins
// over inferred matches. Below threshold → UNRECOGNIZED → triggers Teach SKU.
export const CONFIDENCE_THRESHOLD = 0.95;

// Hard-coded shorthand map (supplements DB product_aliases)
export const SHORTHAND_MAP: Record<string, string> = {
  asabi: "Asabi Finger Baklawa",
  pyramid: "Pyramid Special Sweet",
  burma: "Burma Baklawa",
  kaju: "Kaju Katli",
  katli: "Kaju Katli",
  pistachio: "Pistachio Baklawa",
  baklava: "Mixed Baklawa",
  kunafa: "Kunafa",
  maamoul: "Maamoul",
  basbousa: "Basbousa",
  namoura: "Namoura",
  laddu: "Besan Laddu",
  motichoor: "Motichoor Laddu",
  barfi: "Kaju Barfi",
  peda: "Kesar Peda",
  halwa: "Gajar Halwa",
  rasgulla: "Rasgulla",
  gulab: "Gulab Jamun",
  chamcham: "Cham Cham",
  sandesh: "Bengal Sandesh",
};

const INVOICE_PATTERN = /(?:voucher\s*no|invoice\s*no|inv\s*no|tcf)\s*[:/]?\s*[\w\-\/]+/gi;

export interface SKUMatch {
  name: string;
  confidence: number; // 0–1
  quantity?: number | null;
  unit?: string | null;
  /** The exact alias token that triggered this match (for UI "Reasoning" badge). */
  matchedAlias?: string | null;
}

const QTY_UNIT_RE = /(\d+(?:\.\d+)?)\s*(kgs?|kilograms?|gms?|grams?|gm|pcs?|pieces?|boxes?|box|cartons?|ctns?|units?)\b/i;
// Goldware / non-food: dimensional sizes like "12-inch", "10 in", "8 inch".
const SIZE_DIM_RE = /(\d+(?:\.\d+)?)\s*[-\s]?\s*(inch|inches|in|cm|mm|ft|feet)\b/i;
// Metadata patterns to BLACKLIST — wa_id / user_id / phone / wamid digits must never become quantities.
const METADATA_NUMBER_RE = /(?:wa[_\s-]?id|user[_\s-]?id|wamid|phone|mobile|order[_\s-]?id|ref|#)\s*[:=]?\s*\d+/i;

/**
 * Strict quantity extraction:
 * 1. Search a 60-char window around the alias for a number ADJACENT to a unit (kg/gm/box/pcs/etc).
 * 2. Reject any candidate that sits inside a metadata phrase like "wa_id: 4558718".
 * 3. NEVER fall back to a bare number — silence > guessing.
 */
function extractQtyForAlias(fullText: string, aliasHit: string): { quantity: number | null; unit: string | null } {
  if (!aliasHit) return { quantity: null, unit: null };
  const lower = fullText.toLowerCase();
  const aliasLower = aliasHit.toLowerCase();
  const idx = lower.indexOf(aliasLower);
  if (idx < 0) return { quantity: null, unit: null };
  const start = Math.max(0, idx - 30);
  const end = Math.min(fullText.length, idx + aliasHit.length + 40);
  const window = fullText.slice(start, end);
  // Reject window if it is dominated by metadata
  if (METADATA_NUMBER_RE.test(window)) return { quantity: null, unit: null };
  const m = window.match(QTY_UNIT_RE);
  if (m) {
    return { quantity: parseFloat(m[1]), unit: m[2].toLowerCase() };
  }
  // Goldware path: a dimensional size (12-inch) IS the quantity descriptor — qty defaults to 1.
  const dim = window.match(SIZE_DIM_RE);
  if (dim) {
    return { quantity: 1, unit: `${dim[1]}-${dim[2].toLowerCase()}` };
  }
  // Strict mode: no unit → no quantity. Prevents 'Asabi 4558718' from becoming "× 4558718".
  return { quantity: null, unit: null };
}

export interface ParsedIntent {
  /** Back-compat: list of canonical SKU names with confidence ≥ threshold. */
  detectedSKUs: string[];
  /** Full match list including ambiguous fuzzy hits. */
  matchedSKUs: SKUMatch[];
  invoiceRefs: string[];
  missingQty: boolean;
  missingPhone: boolean;
  /** True when any matched SKU is below CONFIDENCE_THRESHOLD. */
  needsClarification: boolean;
  /** Min confidence across all matched SKUs (1.0 if none). */
  overallConfidence: number;
  /** Optional company name extracted from message text. */
  candidateCompanyName: string | null;
}

/** Dice coefficient on character bigrams — fast deterministic similarity. */
function diceCoefficient(a: string, b: string): number {
  const x = a.toLowerCase().replace(/\s+/g, "");
  const y = b.toLowerCase().replace(/\s+/g, "");
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const setA = bigrams(x);
  const setB = bigrams(y);
  let intersect = 0;
  for (const bg of setA) if (setB.has(bg)) intersect++;
  return (2 * intersect) / (setA.size + setB.size);
}

/** Scan message for a "from / company / m/s ..." pattern. */
function extractCompanyName(text: string): string | null {
  const patterns = [
    /(?:from|for|m\/s\.?|client|company)\s*[:\-]?\s*([A-Z][A-Za-z0-9 &.\-]{2,40})/i,
    /([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\s+(?:traders|enterprises|sweets|foods|catering|hotel|restaurant|stores)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export function parseBanyanMessage(
  text: string,
  dbAliases: { alias_text: string; canonical_name: string }[],
  senderPhone: string | null,
): ParsedIntent {
  const lower = (text || "").toLowerCase();
  // Multi-SKU aggregation: collect EVERY occurrence of EVERY alias across the entire message body.
  type Hit = { canonical: string; aliasHit: string; index: number; confidence: number };
  const hits: Hit[] = [];

  const findAll = (haystack: string, needle: string): number[] => {
    const out: number[] = [];
    if (!needle) return out;
    let from = 0;
    while (true) {
      const i = haystack.indexOf(needle, from);
      if (i < 0) break;
      out.push(i);
      from = i + needle.length;
    }
    return out;
  };

  // 1. Exact alias scans (DB + shorthand) — every occurrence becomes a hit.
  //    WINNER-TAKES-ALL: build a unified candidate list, sort by alias length DESC,
  //    then mask consumed character ranges so a longer match (e.g. "pyramid kaju")
  //    blocks a shorter overlapping match (e.g. "pyramid").
  type Cand = { canonical: string; aliasHit: string; key: string; confidence: number };
  const candidates: Cand[] = [
    ...dbAliases
      .filter((a) => a.alias_text)
      .map((a) => ({ canonical: a.canonical_name, aliasHit: a.alias_text, key: a.alias_text.toLowerCase(), confidence: 1.0 })),
    ...Object.entries(SHORTHAND_MAP).map(([key, canonical]) => ({
      canonical, aliasHit: key, key: key.toLowerCase(), confidence: 1.0,
    })),
  ].sort((a, b) => b.key.length - a.key.length);

  const consumed = new Array(lower.length).fill(false);
  const isFree = (s: number, e: number) => {
    for (let i = s; i < e; i++) if (consumed[i]) return false;
    return true;
  };
  const mark = (s: number, e: number) => { for (let i = s; i < e; i++) consumed[i] = true; };

  for (const c of candidates) {
    for (const idx of findAll(lower, c.key)) {
      const end = idx + c.key.length;
      if (!isFree(idx, end)) continue; // a longer alias already claimed this span
      mark(idx, end);
      hits.push({ canonical: c.canonical, aliasHit: c.aliasHit, index: idx, confidence: c.confidence });
    }
  }

  // 2. ANTI-HALLUCINATION: fuzzy matching DISABLED.
  //    If we cannot find an EXACT alias hit, we do NOT guess. The token is silently
  //    dropped (UNRECOGNIZED) and the operator gets "No SKU matches found — manual review needed".
  //    Adding a new shorthand requires inserting into product_aliases or SHORTHAND_MAP.

  // De-dupe per (canonical + ~line band) so multi-line orders keep separate items but a single canonical isn't doubled.
  const matchedSKUs: SKUMatch[] = [];
  const seen = new Set<string>();
  const sortedHits = hits.sort((a, b) => b.aliasHit.length - a.aliasHit.length);
  for (const h of sortedHits) {
    const lineKey = `${h.canonical}@${Math.floor(h.index / 40)}`;
    if (seen.has(lineKey)) continue;
    seen.add(lineKey);
    const { quantity, unit } = extractQtyForAlias(text || "", h.aliasHit);
    matchedSKUs.push({ name: h.canonical, confidence: h.confidence, quantity, unit });
  }
  matchedSKUs.sort((a, b) => {
    const ai = lower.indexOf(a.name.toLowerCase()) >>> 0;
    const bi = lower.indexOf(b.name.toLowerCase()) >>> 0;
    return ai - bi;
  });

  const detectedSKUs = matchedSKUs.map((m) => m.name);
  const overallConfidence = matchedSKUs.length === 0 ? 1 : Math.min(...matchedSKUs.map((m) => m.confidence));
  const needsClarification = matchedSKUs.length > 0 && overallConfidence < CONFIDENCE_THRESHOLD;

  const invoiceRefs = ((text || "").match(INVOICE_PATTERN) || []).map((r) => r.trim());

  const hasQty = /\d+\s*(kg|pcs|pc|box|boxes|carton|cartons|unit|units|pieces|gm|gms|gram)/i.test(text || "");
  const hasAnyNumber = /\b\d+\b/.test(text || "");
  const missingQty = matchedSKUs.length > 0 && !hasQty && !hasAnyNumber;

  const phoneDigits = (senderPhone || "").replace(/\D/g, "");
  const missingPhone = phoneDigits.length < 10;

  return {
    detectedSKUs,
    matchedSKUs,
    invoiceRefs,
    missingQty,
    missingPhone,
    needsClarification,
    overallConfidence,
    candidateCompanyName: extractCompanyName(text || ""),
  };
}
