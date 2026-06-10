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

/** Utterance is only a generic family request (e.g. "Need Baklava", "Pyramid"). */
export function isGenericFamilyUtterance(normalizedUtterance: string): boolean {
  const stripped = normalizedUtterance
    .replace(/^(need|send|want|order|please)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return false;
  const tokens = stripped.split(" ").filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => GENERIC_FAMILY_TERMS.has(token.toLowerCase()));
}
