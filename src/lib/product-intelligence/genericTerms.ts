/**
 * Family-level terms that are valid product language but too broad to auto-resolve
 * without a distinguishing alias (shape, nut, pack, or weight).
 */
export const GENERIC_FAMILY_TERMS = new Set([
  "asiyah",
  "assiyah",
  "baklava",
  "baklawa",
  "durum",
  "pyramid",
  "ring",
  "sweet",
  "sweets",
  "assorted",
  "mixed",
  "mithai",
  "dessert",
  "desserts",
  "tart",
]);

/** Polite / imperative prefixes stripped repeatedly before generic-family check. */
const LEADING_POLITE_PREFIX = /^(please|kindly|need|send|want|order|give|share)\s+/i;

export function stripLeadingPolitePrefixes(normalizedUtterance: string): string {
  let stripped = normalizedUtterance.replace(/\s+/g, " ").trim();
  while (LEADING_POLITE_PREFIX.test(stripped)) {
    stripped = stripped.replace(LEADING_POLITE_PREFIX, "").trim();
  }
  return stripped;
}

/** Utterance is only a generic family request (e.g. "Need Baklava", "Pyramid"). */
export function isGenericFamilyUtterance(normalizedUtterance: string): boolean {
  const stripped = stripLeadingPolitePrefixes(normalizedUtterance);
  if (!stripped) return false;
  const tokens = stripped.split(" ").filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => GENERIC_FAMILY_TERMS.has(token.toLowerCase()));
}
