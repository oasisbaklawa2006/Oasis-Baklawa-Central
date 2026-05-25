import { expandSearchAliases } from "./searchQueryParser";

/** Collapse whitespace and lowercase for deterministic tokenization. */
export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Strip non-alphanumeric except hyphen for SO/barcode tokens. */
export function normalizeReferenceToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\-+#]/gi, "");
}

export function tokenizeForIndex(parts: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const norm = normalizeSearchText(part);
    if (!norm) continue;
    tokens.add(norm);
    for (const chunk of norm.split(/[\s,;/|]+/)) {
      const t = normalizeReferenceToken(chunk);
      if (t.length >= 2) tokens.add(t);
    }
    const soMatch = norm.match(/so[-#]?(\d{4,})/i);
    if (soMatch) tokens.add(`so${soMatch[1]}`);
    if (/^[0-9a-f-]{36}$/.test(norm)) tokens.add(norm);
  }
  return [...tokens];
}

/** Typo-tolerant: also index partial SO numeric suffix (min 4 digits). */
export function expandSoPartialTokens(soNumbers: string[]): string[] {
  const out = new Set<string>();
  for (const so of soNumbers) {
    const norm = normalizeReferenceToken(so);
    if (!norm) continue;
    out.add(norm);
    const digits = norm.replace(/^so[-#]?/i, "");
    if (digits.length >= 4) {
      out.add(digits);
      for (let len = 4; len <= digits.length; len++) {
        out.add(digits.slice(-len));
      }
    }
  }
  return [...out];
}

export function buildNormalizedTokenSet(input: {
  title: string;
  subtitle?: string | null;
  body?: string | null;
  aliases?: string[];
  barcodeValues?: string[];
  soNumbers?: string[];
  phoneTokens?: string[];
  emailTokens?: string[];
}): string[] {
  const base = tokenizeForIndex([
    input.title,
    input.subtitle,
    input.body,
    ...(input.aliases ?? []),
    ...(input.barcodeValues ?? []),
    ...(input.soNumbers ?? []),
    ...(input.phoneTokens ?? []),
    ...(input.emailTokens ?? []),
  ]);
  const aliasExpanded = expandSearchAliases(input.title).map(normalizeReferenceToken);
  const soExpanded = expandSoPartialTokens(input.soNumbers ?? []);
  return [...new Set([...base, ...aliasExpanded.filter(Boolean), ...soExpanded])];
}

export function queryTokensFromText(text: string): string[] {
  const norm = normalizeSearchText(text);
  if (!norm) return [];
  const tokens = tokenizeForIndex([norm, ...expandSearchAliases(text)]);
  return [...new Set(tokens)];
}

export function barcodeQueryTokens(text: string): string[] {
  const norm = normalizeReferenceToken(text);
  return norm ? [norm, ...tokenizeForIndex([text])] : tokenizeForIndex([text]);
}
