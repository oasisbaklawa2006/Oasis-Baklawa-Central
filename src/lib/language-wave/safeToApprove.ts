import { GENERIC_FAMILY_TERMS } from "@/lib/product-intelligence/genericTerms";
import type {
  ClassifiedLanguageTerm,
  LanguageTermProposal,
  SafeToApproveClassification,
} from "./types";

function normalizeTerm(term: string): string {
  return term.trim().replace(/\s+/g, " ").toLowerCase();
}

function tokenize(term: string): string[] {
  return normalizeTerm(term).split(" ").filter(Boolean);
}

function isUnsafeGenericOnly(term: string): boolean {
  const tokens = tokenize(term);
  if (tokens.length === 0) return true;
  return tokens.every((t) => GENERIC_FAMILY_TERMS.has(t));
}

function isAmbiguousSingleToken(term: string): boolean {
  const tokens = tokenize(term);
  return tokens.length === 1 && GENERIC_FAMILY_TERMS.has(tokens[0]!);
}

export function classifyLanguageTerm(
  proposal: LanguageTermProposal,
  existingNormalizedToSkus: Map<string, Set<string>>,
  packNormalizedToSkus: Map<string, Set<string>>,
): ClassifiedLanguageTerm {
  const reasons: string[] = [];
  let classification: SafeToApproveClassification = "SAFE_TO_APPROVE";

  if (!proposal.productId || !proposal.canonicalName.trim()) {
    classification = "BLOCKED_MISSING_PRODUCT";
    reasons.push("Missing product_id or canonical_name");
    return { ...proposal, classification, reasons };
  }

  const norm = normalizeTerm(proposal.term);
  if (!norm) {
    classification = "BLOCKED_MISSING_PRODUCT";
    reasons.push("Empty term");
    return { ...proposal, classification, reasons };
  }

  if (isUnsafeGenericOnly(proposal.term)) {
    classification = "BLOCKED_GENERIC";
    reasons.push("Term is generic-family only");
  } else if (isAmbiguousSingleToken(proposal.term)) {
    classification = "BLOCKED_AMBIGUOUS_TOKEN";
    reasons.push("Single-token generic family nickname");
  }

  const packSkus = packNormalizedToSkus.get(norm);
  if (packSkus && packSkus.size > 1) {
    classification = "BLOCKED_DUPLICATE_IN_PACK";
    reasons.push(`Duplicate in wave pack across SKUs: ${[...packSkus].join(", ")}`);
  }

  const liveSkus = existingNormalizedToSkus.get(norm);
  if (liveSkus && liveSkus.size > 0) {
    const foreign = [...liveSkus].filter((sku) => sku !== proposal.sku);
    if (foreign.length > 0) {
      classification = "BLOCKED_CROSS_SKU_COLLISION";
      reasons.push(`Collides with live aliases on: ${foreign.join(", ")}`);
    }
  }

  const packForeign = packSkus ? [...packSkus].filter((sku) => sku !== proposal.sku) : [];
  if (packForeign.length > 0 && classification === "SAFE_TO_APPROVE") {
    classification = "BLOCKED_CROSS_SKU_COLLISION";
    reasons.push(`Cross-SKU collision inside wave pack: ${packForeign.join(", ")}`);
  }

  return { ...proposal, classification, reasons };
}

export function classifyLanguagePack(
  proposals: LanguageTermProposal[],
  existingNormalizedToSkus: Map<string, Set<string>> = new Map(),
): ClassifiedLanguageTerm[] {
  const packNormalizedToSkus = new Map<string, Set<string>>();

  for (const proposal of proposals) {
    const norm = normalizeTerm(proposal.term);
    const set = packNormalizedToSkus.get(norm) ?? new Set<string>();
    set.add(proposal.sku);
    packNormalizedToSkus.set(norm, set);
  }

  return proposals.map((p) => classifyLanguageTerm(p, existingNormalizedToSkus, packNormalizedToSkus));
}

export function filterSafeToApprove(terms: ClassifiedLanguageTerm[]): ClassifiedLanguageTerm[] {
  return terms.filter((t) => t.classification === "SAFE_TO_APPROVE");
}
