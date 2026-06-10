const WEIGHT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|gm|gms|gram|grams|g)\b/gi;

const LEADING_VERB_PATTERN = /^(need|send|want|order|please)\s+/i;

export interface UtteranceSignals {
  normalized: string;
  weight_grams: number[];
  quantity_phrase: string | null;
}

function weightToGrams(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("k")) return Math.round(value * 1000);
  return Math.round(value);
}

export function extractUtteranceSignals(utterance: string): UtteranceSignals {
  const normalized = utterance.trim().replace(/\s+/g, " ").toLowerCase();
  const weight_grams: number[] = [];
  for (const match of utterance.matchAll(WEIGHT_PATTERN)) {
    const amount = Number.parseFloat(match[1]);
    const unit = match[2];
    if (Number.isFinite(amount) && unit) {
      weight_grams.push(weightToGrams(amount, unit));
    }
  }

  const withoutVerb = normalized.replace(LEADING_VERB_PATTERN, "").trim();
  const quantity_phrase =
    withoutVerb.match(
      /^(\d+(?:\.\d+)?\s*(?:kg|kgs|gm|g|gms|kilogram|kilograms|gram|grams)\s+.+)$/i,
    )?.[1] ?? null;

  return {
    normalized,
    weight_grams: [...new Set(weight_grams)],
    quantity_phrase,
  };
}

export function containsWholePhrase(haystack: string, phrase: string): boolean {
  const p = phrase.trim().replace(/\s+/g, " ").toLowerCase();
  if (!p || p.length < 2) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
}
