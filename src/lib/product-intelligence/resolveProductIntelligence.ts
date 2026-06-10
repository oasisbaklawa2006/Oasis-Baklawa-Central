import { isGenericFamilyUtterance } from "./genericTerms";
import type {
  ApprovedAliasCatalog,
  IntelligenceCandidate,
  IntelligenceProductRow,
  ProductIntelligenceResolution,
} from "./types";
import { containsWholePhrase, extractUtteranceSignals } from "./utteranceSignals";

const AUTO_RESOLVE_THRESHOLD = 85;
const CLARIFICATION_THRESHOLD = 70;
const AMBIGUITY_MARGIN = 8;

function productWeightGrams(product: IntelligenceProductRow): number[] {
  const grams: number[] = [];
  if (product.net_weight_grams != null && product.net_weight_grams > 0) {
    grams.push(Math.round(product.net_weight_grams));
  }
  const pack = (product.pack_size ?? "").toLowerCase();
  for (const match of pack.matchAll(/(\d+(?:\.\d+)?)\s*(kg|gm|g)\b/gi)) {
    const amount = Number.parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(amount)) continue;
    grams.push(unit.startsWith("k") ? Math.round(amount * 1000) : Math.round(amount));
  }
  return [...new Set(grams)];
}

function weightMatches(product: IntelligenceProductRow, targetGrams: number): boolean {
  const tolerance = Math.max(20, Math.round(targetGrams * 0.1));
  return productWeightGrams(product).some((g) => Math.abs(g - targetGrams) <= tolerance);
}

function scoreProduct(
  product: IntelligenceProductRow,
  utterance: string,
  signals: ReturnType<typeof extractUtteranceSignals>,
  aliasHits: string[],
): IntelligenceCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  const nameLower = product.name.toLowerCase();
  if (containsWholePhrase(utterance, product.name)) {
    score += 0.88;
    reasons.push(`Exact product name match: ${product.name}`);
  }

  for (const alias of aliasHits) {
    if (!containsWholePhrase(utterance, alias)) continue;
    const aliasBoost = Math.min(0.94, 0.72 + alias.length / 28);
    score = Math.max(score, aliasBoost);
    reasons.push(`Approved alias match: "${alias}"`);
  }

  const nameTokens = nameLower.split(/\s+/).filter((t) => t.length > 3);
  const matchedNameTokens = nameTokens.filter((t) => containsWholePhrase(utterance, t));
  if (matchedNameTokens.length > 0 && score < 0.75) {
    score += Math.min(0.35, matchedNameTokens.length * 0.12);
    reasons.push(`Name token overlap: ${matchedNameTokens.join(", ")}`);
  }

  if (product.sku && containsWholePhrase(utterance, product.sku)) {
    score += 0.25;
    reasons.push(`SKU token: ${product.sku}`);
  }

  for (const grams of signals.weight_grams) {
    if (weightMatches(product, grams)) {
      score += 0.1;
      reasons.push(`Weight alignment: ~${grams}g`);
    }
  }

  if (score <= 0) return null;

  const confidence = Math.min(98, Math.round(score * 100));
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    confidence,
    matched_aliases: aliasHits.filter((a) => containsWholePhrase(utterance, a)),
    reasons,
  };
}

function collectAliasHits(
  catalog: ApprovedAliasCatalog,
  utterance: string,
): Map<string, string[]> {
  const hits = new Map<string, string[]>();

  function note(productId: string, alias: string): void {
    if (!containsWholePhrase(utterance, alias)) return;
    const list = hits.get(productId) ?? [];
    if (!list.includes(alias)) list.push(alias);
    hits.set(productId, list);
  }

  for (const row of catalog.aliases) {
    if (row.product_id) note(row.product_id, row.alias_text);
    if (row.canonical_name && row.product_id) note(row.product_id, row.canonical_name);
  }

  for (const product of catalog.products) {
    for (const alias of product.approved_aliases) {
      note(product.id, alias);
    }
  }

  return hits;
}

function buildExplanation(
  utterance: string,
  candidates: IntelligenceCandidate[],
  clarification_required: boolean,
  genericOnly: boolean,
): string {
  if (genericOnly) {
    return `Utterance "${utterance}" uses a generic product family term only. Approved aliases require a specific shape, nut, or pack before auto-resolution.`;
  }
  if (candidates.length === 0) {
    return `No approved alias or product name in the catalogue matched "${utterance}".`;
  }
  const best = candidates[0];
  if (clarification_required) {
    const rivals = candidates.slice(1, 3).map((c) => c.productName);
    const rivalText = rivals.length > 0 ? ` Close rivals: ${rivals.join("; ")}.` : "";
    return `Multiple approved language paths or insufficient confidence for "${utterance}". Best candidate: ${best.productName} (${best.confidence}%).${rivalText}`;
  }
  return `Resolved via approved language to ${best.productName} (${best.confidence}%) — ${best.reasons[0] ?? "alias match"}.`;
}

/**
 * Pure read-only resolver over an in-memory approved alias catalogue.
 * No database writes; safe for prototype and unit tests.
 */
export function resolveProductIntelligence(
  catalog: ApprovedAliasCatalog,
  utterance: string,
): ProductIntelligenceResolution {
  const trimmed = utterance.trim();
  const signals = extractUtteranceSignals(trimmed);
  const genericOnly = isGenericFamilyUtterance(signals.normalized);
  const aliasHitsByProduct = collectAliasHits(catalog, signals.normalized);

  const candidates: IntelligenceCandidate[] = [];
  for (const product of catalog.products) {
    const aliasHits = aliasHitsByProduct.get(product.id) ?? [];
    const scored = scoreProduct(product, signals.normalized, signals, aliasHits);
    if (scored) candidates.push(scored);
  }

  if (genericOnly) {
    for (const candidate of candidates) {
      candidate.confidence = Math.min(candidate.confidence, 55);
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  const best = candidates[0] ?? null;
  const second = candidates[1] ?? null;

  const longestAliasLen = (c: IntelligenceCandidate | null): number =>
    Math.max(0, ...(c?.matched_aliases.map((a) => a.length) ?? [0]));

  let clarification_required = false;

  if (genericOnly) {
    clarification_required = true;
  } else if (!best || best.confidence < CLARIFICATION_THRESHOLD) {
    clarification_required = true;
  } else if (
    second &&
    best.confidence - second.confidence <= AMBIGUITY_MARGIN &&
    second.confidence >= CLARIFICATION_THRESHOLD
  ) {
    const distinctiveLongAlias =
      longestAliasLen(best) >= 10 && longestAliasLen(best) - longestAliasLen(second) >= 6;
    if (!distinctiveLongAlias) clarification_required = true;
  }

  // Single-token family name with multiple strong hits (e.g. "Asiyah")
  const stripped = signals.normalized.replace(/^(need|send|want|order|please)\s+/i, "").trim();
  const tokens = stripped.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && candidates.filter((c) => c.confidence >= CLARIFICATION_THRESHOLD).length > 1) {
    clarification_required = true;
  }

  // Auto-resolve threshold is always enforced — long alias / ambiguity cannot bypass it.
  if (best && best.confidence < AUTO_RESOLVE_THRESHOLD) {
    clarification_required = true;
  }

  return {
    utterance: trimmed,
    candidate_products: candidates.slice(0, 5),
    best_match: best,
    clarification_required,
    explanation: buildExplanation(trimmed, candidates, clarification_required, genericOnly),
  };
}
