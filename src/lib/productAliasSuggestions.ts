/** Generic B2B terms that are unsafe alone as product aliases. */
export const GENERIC_ALIAS_BLOCKLIST = new Set([
  "baklava",
  "baklawa",
  "sweet",
  "sweets",
  "box",
  "tray",
  "kg",
  "1kg",
  "3kg",
  "6kg",
  "assorted",
]);

export function normalizeAliasToken(raw: string): string {
  return raw
    .replace(/^[\s"\-•*\d.]+|["\s]+$/g, "")
    .trim()
    .toLowerCase();
}

export function isGenericAliasOnly(alias: string): boolean {
  const normalized = normalizeAliasToken(alias);
  if (!normalized) return true;
  if (GENERIC_ALIAS_BLOCKLIST.has(normalized)) return true;
  return false;
}

/**
 * Allow generic terms only when paired with a distinctive token from the product name.
 * e.g. "assorted baklawa mix" for product "Premium Assorted Baklawa Mix" is OK.
 */
export function isBlockedAlias(alias: string, productName: string): boolean {
  const normalized = normalizeAliasToken(alias);
  if (!normalized || normalized.length > 40) return true;

  const distinctiveTerms = productName
    .toLowerCase()
    .split(/[\s,/\-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !GENERIC_ALIAS_BLOCKLIST.has(t));

  if (!GENERIC_ALIAS_BLOCKLIST.has(normalized)) return false;
  if (distinctiveTerms.length === 0) return true;

  return !distinctiveTerms.some((term) => normalized.includes(term) || term.includes(normalized));
}

export function filterAndDedupeAliasSuggestions(
  rawSuggestions: string[],
  productName: string,
  existingAliases: string[] = [],
): { accepted: string[]; rejected: string[] } {
  const existing = new Set(existingAliases.map(normalizeAliasToken).filter(Boolean));
  const accepted: string[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>(existing);

  for (const raw of rawSuggestions) {
    const normalized = normalizeAliasToken(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) {
      rejected.push(raw);
      continue;
    }
    if (isBlockedAlias(normalized, productName)) {
      rejected.push(raw);
      continue;
    }
    seen.add(normalized);
    accepted.push(normalized);
  }

  return { accepted, rejected };
}

export function mergeSelectedAliases(existingCsv: string, selected: string[]): string {
  const existing = (existingCsv || "")
    .split(",")
    .map(normalizeAliasToken)
    .filter(Boolean);
  const merged = Array.from(new Set([...existing, ...selected.map(normalizeAliasToken).filter(Boolean)]));
  return merged.join(", ");
}
