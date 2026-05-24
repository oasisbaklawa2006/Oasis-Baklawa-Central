import type { OperationalEventRecord } from "./types";

/** Normalize to ISO UTC or null if invalid / missing */
export function normalizeOperationalTimestamp(input: string | Date | null | undefined): string | null {
  if (input == null) return null;
  const d = typeof input === "string" ? new Date(input.trim()) : input;
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return d.toISOString();
}

/**
 * Sort: authoritative timestamps ascending first; snapshot-derived rows (no time) after,
 * ordered by sortKey then id.
 */
export function compareOperationalEvents(a: OperationalEventRecord, b: OperationalEventRecord): number {
  const aHas = a.occurredAt != null && a.occurredAt.length > 0;
  const bHas = b.occurredAt != null && b.occurredAt.length > 0;
  if (aHas && bHas) {
    const ta = new Date(a.occurredAt!).getTime();
    const tb = new Date(b.occurredAt!).getTime();
    if (ta !== tb) return ta - tb;
  }
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
  return a.id.localeCompare(b.id);
}

/** Last write wins by id; then sort for display */
export function dedupeOperationalEventsById(events: OperationalEventRecord[]): OperationalEventRecord[] {
  const map = new Map<string, OperationalEventRecord>();
  for (const e of events) {
    map.set(e.id, e);
  }
  return [...map.values()].sort(compareOperationalEvents);
}
