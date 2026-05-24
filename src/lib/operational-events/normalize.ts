import type { OperationalEventRecord } from "./types";

export function normalizeOperationalTimestamp(input: string | Date | null | undefined): string | null {
  if (input == null) return null;
  const d = typeof input === "string" ? new Date(input.trim()) : input;
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return d.toISOString();
}

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

export function dedupeOperationalEventsById(events: OperationalEventRecord[]): OperationalEventRecord[] {
  const map = new Map<string, OperationalEventRecord>();
  for (const e of events) {
    map.set(e.id, e);
  }
  return [...map.values()].sort(compareOperationalEvents);
}

/** Sort + dedupe WhatsApp-derived rows (same rules as global feed). */
export function normalizeWhatsAppEvents(events: OperationalEventRecord[]): OperationalEventRecord[] {
  return dedupeOperationalEventsById(events);
}

export function mergeOperationalEventFeeds(feeds: OperationalEventRecord[][]): OperationalEventRecord[] {
  return dedupeOperationalEventsById(feeds.flat());
}
