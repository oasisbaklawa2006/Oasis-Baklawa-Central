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

export const CONFIDENCE_THRESHOLD = 0.85;

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
  const matches = new Map<string, number>(); // canonical → max confidence

  const record = (canonical: string, score: number) => {
    const prev = matches.get(canonical) ?? 0;
    if (score > prev) matches.set(canonical, score);
  };

  // 1. Exact substring hits → 1.0
  for (const alias of dbAliases) {
    const a = (alias.alias_text || "").toLowerCase();
    if (a && lower.includes(a)) record(alias.canonical_name, 1.0);
  }
  for (const [key, canonical] of Object.entries(SHORTHAND_MAP)) {
    if (lower.includes(key)) record(canonical, 1.0);
  }

  // 2. Fuzzy hits on word tokens — only if no exact hit covers them
  if (matches.size === 0) {
    const tokens = lower.split(/[^a-z]+/i).filter((t) => t.length >= 4);
    const candidates = [
      ...dbAliases.map((a) => ({ key: a.alias_text, canonical: a.canonical_name })),
      ...Object.entries(SHORTHAND_MAP).map(([key, canonical]) => ({ key, canonical })),
    ];
    for (const tok of tokens) {
      let best: { canonical: string; score: number } | null = null;
      for (const c of candidates) {
        const s = diceCoefficient(tok, c.key);
        if (s >= 0.5 && (!best || s > best.score)) best = { canonical: c.canonical, score: s };
      }
      // Cap fuzzy confidence at 0.84 to force clarification gate
      if (best) record(best.canonical, Math.min(0.84, best.score));
    }
  }

  const matchedSKUs: SKUMatch[] = Array.from(matches.entries())
    .map(([name, confidence]) => ({ name, confidence }))
    .sort((a, b) => b.confidence - a.confidence);

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
