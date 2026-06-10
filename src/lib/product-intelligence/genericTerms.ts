/**
 * Family-level terms that are valid product language but too broad to auto-resolve
 * without a distinguishing alias (shape, nut, pack, or weight).
 */
export const GENERIC_FAMILY_TERMS = new Set([
  "baklava",
  "baklawa",
  "sweet",
  "sweets",
  "assorted",
  "mixed",
  "mithai",
  "dessert",
  "desserts",
]);

/** Utterance is only a generic family request (e.g. "Need Baklava"). */
export function isGenericFamilyUtterance(normalizedUtterance: string): boolean {
  const stripped = normalizedUtterance
    .replace(/^(need|send|want|order|please)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return false;
  const tokens = stripped.split(" ").filter(Boolean);
  if (tokens.length > 2) return false;
  const core = tokens.join(" ");
  return GENERIC_FAMILY_TERMS.has(core) || GENERIC_FAMILY_TERMS.has(tokens[tokens.length - 1] ?? "");
}
