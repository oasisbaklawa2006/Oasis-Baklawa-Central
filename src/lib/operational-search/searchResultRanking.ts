import type { SearchIndexEntry } from "./searchIndexTypes";
import type { ParsedOperationalSearchQuery } from "./searchQueryParser";

const ENTITY_PRIORITY: Record<string, number> = {
  order: 100,
  queue_item: 90,
  scan_record: 85,
  operational_event: 70,
  customer: 65,
  complaint: 60,
  dispatch_reference: 55,
  carton: 50,
};

export function scoreSearchIndexMatch(entry: SearchIndexEntry, parsed: ParsedOperationalSearchQuery): number {
  if (!parsed.tokens.length) return 0;
  let score = ENTITY_PRIORITY[entry.entityType] ?? 40;

  const tokenSet = new Set(entry.normalizedTokens);
  const aliasSet = new Set(entry.aliases.map((a) => a.toLowerCase()));
  const soSet = new Set(entry.soNumbers.map((s) => s.toLowerCase()));
  const barcodeSet = new Set(entry.barcodeValues.map((b) => b.toLowerCase()));

  for (const t of parsed.tokens) {
    if (tokenSet.has(t)) score += 30;
    if (aliasSet.has(t)) score += 25;
    if (soSet.has(t) || [...soSet].some((s) => s.includes(t) || t.includes(s))) score += 40;
    if (barcodeSet.has(t)) score += 45;
    if (entry.publicRef?.toLowerCase() === t) score += 35;
    if (entry.searchTitle.toLowerCase().includes(t)) score += 15;
  }

  if (parsed.barcodeOrSoMode) {
    if (entry.entityType === "scan_record" || entry.entityType === "carton") score += 20;
    if (entry.entityType === "order") score += 15;
  }

  if (entry.sensitivity === "confidential") score -= 5;
  return score;
}

export function rankSearchEntries(
  entries: SearchIndexEntry[],
  parsed: ParsedOperationalSearchQuery,
): Array<SearchIndexEntry & { rankScore: number }> {
  return entries
    .map((e) => ({ ...e, rankScore: scoreSearchIndexMatch(e, parsed) }))
    .filter((e) => e.rankScore > 0)
    .sort((a, b) => b.rankScore - a.rankScore || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}
