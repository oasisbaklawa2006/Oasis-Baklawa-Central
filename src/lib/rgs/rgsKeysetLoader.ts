/**
 * Fail-closed keyset ("seek") loader for RGS / Factory read models.
 *
 * Why not `.limit(n)` or offset paging: a silent cap drops live demand/custody
 * rows, and offsets over a moving table can skip or duplicate rows. This loader
 * walks a deterministic composite key `(timestamp, id)` and REJECTS the whole
 * snapshot on any error, malformed page, duplicate id, or non-monotonic key.
 * Callers must keep allocation/custody actions disabled unless it resolves.
 *
 * Several Core timestamp columns are nullable (orders/production_jobs/
 * production_rgs_transfers `created_at`). A `ts > cursor` predicate can never
 * reach NULL rows, so they are read in a second, explicit phase ordered by id
 * alone. Nothing is silently skipped.
 *
 * Read-only: this module never writes and never calls a stock RPC.
 */

export const RGS_KEYSET_DEFAULT_PAGE_SIZE = 250;
const MAX_PAGE_SIZE = 1000;
// Hard ceiling against a cursor that never advances (infinite-loop guard).
const MAX_PAGES = 10_000;

export type KeysetPhase = "timestamped" | "null_timestamp";
export type KeysetCursor = { timestamp: string | null; id: string };
export type KeysetRequest = { phase: KeysetPhase; after: KeysetCursor | null; limit: number };
export type KeysetPageResult = { data: unknown; error: { message?: string } | null };

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_TIMESTAMP = /^[0-9TZ:.+-]{10,40}$/;

/** Compare PostgREST timestamptz strings (µs precision, trailing zeros may be dropped). */
export function compareTimestamps(a: string, b: string): number {
  const ms = Date.parse(a) - Date.parse(b);
  if (ms !== 0) return ms < 0 ? -1 : 1;
  const frac = (value: string) => (/\.(\d+)/.exec(value)?.[1] ?? "").padEnd(6, "0").slice(0, 6);
  const fa = frac(a), fb = frac(b);
  return fa === fb ? 0 : fa < fb ? -1 : 1;
}

function compareIds(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function compareKeys(phase: KeysetPhase, a: KeysetCursor, b: KeysetCursor): number {
  if (phase === "timestamped") {
    const byTime = compareTimestamps(a.timestamp as string, b.timestamp as string);
    if (byTime !== 0) return byTime;
  }
  return compareIds(a.id, b.id);
}

// Minimal structural view of the PostgREST filter builder used here.
type KeysetQuery = {
  not: (column: string, operator: string, value: unknown) => KeysetQuery;
  is: (column: string, value: null) => KeysetQuery;
  gt: (column: string, value: string) => KeysetQuery;
  or: (filters: string) => KeysetQuery;
  order: (column: string, options: { ascending: boolean }) => KeysetQuery;
  limit: (count: number) => PromiseLike<KeysetPageResult>;
};

/**
 * Apply the composite keyset window `(column, id)` to a PostgREST select builder.
 * Cursor values are validated before being interpolated into the `or()` filter.
 */
export function applyKeysetWindow(
  query: unknown,
  column: string,
  request: KeysetRequest,
): PromiseLike<KeysetPageResult> {
  if (!/^[a-z_]+$/.test(column)) throw new Error("Invalid keyset column");
  let q = query as KeysetQuery;
  const { after } = request;
  if (after && !SAFE_ID.test(after.id)) throw new Error("Keyset cursor id is malformed");
  if (request.phase === "timestamped") {
    q = q.not(column, "is", null);
    if (after) {
      if (!after.timestamp || !SAFE_TIMESTAMP.test(after.timestamp)) throw new Error("Keyset cursor timestamp is malformed");
      q = q.or(`${column}.gt.${after.timestamp},and(${column}.eq.${after.timestamp},id.gt.${after.id})`);
    }
    q = q.order(column, { ascending: true }).order("id", { ascending: true });
  } else {
    q = q.is(column, null);
    if (after) q = q.gt("id", after.id);
    q = q.order("id", { ascending: true });
  }
  return q.limit(request.limit);
}

export type KeysetLoaderConfig<T> = {
  /** Human label used in error messages, e.g. "inventory_reservations". */
  label: string;
  pageSize?: number;
  getTimestamp: (row: T) => unknown;
  getId: (row: T) => unknown;
  fetchPage: (request: KeysetRequest) => PromiseLike<KeysetPageResult>;
};

export async function loadKeysetPages<T>(config: KeysetLoaderConfig<T>): Promise<T[]> {
  const { label, getTimestamp, getId, fetchPage } = config;
  const pageSize = config.pageSize ?? RGS_KEYSET_DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new Error(`${label}: invalid page size`);
  }
  const all: T[] = [];
  const seen = new Set<string>();
  let phase: KeysetPhase = "timestamped";
  let after: KeysetCursor | null = null;
  let previous: KeysetCursor | null = null;

  for (let page = 0; ; page += 1) {
    if (page >= MAX_PAGES) throw new Error(`${label}: pagination did not terminate; reload required`);
    const result = await fetchPage({ phase, after, limit: pageSize });
    if (result.error) throw new Error(`${label} read failed: ${result.error.message || "Unknown Core error"}`);
    if (!Array.isArray(result.data)) throw new Error(`${label} read returned invalid data`);
    if (result.data.length > pageSize) throw new Error(`${label} read returned an oversized page`);

    for (const row of result.data as T[]) {
      const id = row && typeof row === "object" ? getId(row) : null;
      if (typeof id !== "string" || !SAFE_ID.test(id)) throw new Error(`${label} read returned a malformed row`);
      if (seen.has(id)) throw new Error(`${label} source changed during pagination; reload required`);
      const rawTimestamp = getTimestamp(row);
      let timestamp: string | null = null;
      if (phase === "timestamped") {
        if (typeof rawTimestamp !== "string" || !SAFE_TIMESTAMP.test(rawTimestamp) || Number.isNaN(Date.parse(rawTimestamp))) {
          throw new Error(`${label} read returned a row with an invalid timestamp`);
        }
        timestamp = rawTimestamp;
      } else if (rawTimestamp != null) {
        throw new Error(`${label} source changed during pagination; reload required`);
      }
      const key: KeysetCursor = { timestamp, id };
      if (previous && compareKeys(phase, previous, key) >= 0) {
        throw new Error(`${label} read returned a non-monotonic page; reload required`);
      }
      seen.add(id);
      all.push(row);
      previous = key;
    }

    if (result.data.length < pageSize) {
      if (phase === "timestamped") {
        phase = "null_timestamp";
        after = null;
        previous = null;
        continue;
      }
      return all;
    }
    after = previous;
  }
}

/** Convenience: page a plain table by `(timestampColumn, id)`. */
export function loadTableByKeyset<T extends { id: string }>(
  db: { from: (relation: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  relation: string,
  columns: string,
  timestampColumn: keyof T & string,
  pageSize?: number,
): Promise<T[]> {
  return loadKeysetPages<T>({
    label: relation,
    pageSize,
    getId: (row) => row.id,
    getTimestamp: (row) => row[timestampColumn],
    fetchPage: (request) => applyKeysetWindow(db.from(relation).select(columns), timestampColumn, request),
  });
}
