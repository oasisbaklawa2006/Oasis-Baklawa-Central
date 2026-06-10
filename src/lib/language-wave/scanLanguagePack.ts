import type { ClassifiedLanguageTerm, LanguageScanIssue, LanguageScanResult, LanguageTermProposal } from "./types";
import { classifyLanguagePack, filterSafeToApprove } from "./safeToApprove";

function issueFromTerm(
  term: ClassifiedLanguageTerm,
): LanguageScanIssue | null {
  if (term.classification === "SAFE_TO_APPROVE") return null;

  const code =
    term.classification === "BLOCKED_GENERIC"
      ? "unsafe_generic"
      : term.classification === "BLOCKED_DUPLICATE_IN_PACK"
        ? "duplicate_in_pack"
        : term.classification === "BLOCKED_CROSS_SKU_COLLISION"
          ? "cross_sku_collision"
          : "ambiguous_token";

  return {
    code,
    severity: "error",
    term: term.term,
    skus: [term.sku],
    message: term.reasons.join("; ") || term.classification,
  };
}

export function scanLanguagePack(
  wave: string,
  proposals: LanguageTermProposal[],
  existingNormalizedToSkus: Map<string, Set<string>> = new Map(),
): LanguageScanResult {
  const classified = classifyLanguagePack(proposals, existingNormalizedToSkus);
  const safe_terms = filterSafeToApprove(classified);
  const issues: LanguageScanIssue[] = [];

  for (const term of classified) {
    const issue = issueFromTerm(term);
    if (issue) issues.push(issue);
  }

  return {
    wave,
    term_count: classified.length,
    safe_count: safe_terms.length,
    blocked_count: classified.length - safe_terms.length,
    issues,
    safe_terms,
  };
}

export function buildExistingAliasIndex(
  rows: Array<{ alias_text: string; sku: string }>,
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const row of rows) {
    const norm = row.alias_text.trim().replace(/\s+/g, " ").toLowerCase();
    const set = index.get(norm) ?? new Set<string>();
    set.add(row.sku);
    index.set(norm, set);
  }
  return index;
}
