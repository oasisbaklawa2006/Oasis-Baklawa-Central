/**
 * Test-only in-memory PostgREST fake that honours the keyset filters used by
 * rgsKeysetLoader (not-null / is-null / id.gt / or(ts.gt, and(ts.eq, id.gt)) /
 * order / limit / in / eq). Rows are sorted by the fake, so tests can supply
 * them in any (e.g. reverse) order and still prove deterministic paging.
 */
import { compareTimestamps } from "../rgsKeysetLoader";

type Row = Record<string, unknown>;
type Hook = (call: { relation: string; phase: "timestamped" | "null_timestamp"; limit: number; index: number }) =>
  { data: unknown; error: { message: string } | null } | undefined;

export function makeKeysetFakeDb(tables: Record<string, Row[]>, hook?: Hook) {
  const calls: Array<{ relation: string; phase: string; limit: number; orFilter: string | null }> = [];
  const counters: Record<string, number> = {};
  const db = {
    from(relation: string) {
      const st = { notNull: false, isNull: false, idGt: null as string | null, or: null as string | null, in: [] as Array<[string, unknown[]]>, eq: [] as Array<[string, unknown]>, orderCol: "id" };
      const builder: Record<string, unknown> = {};
      const self = () => builder;
      builder.select = self;
      builder.eq = (c: string, v: unknown) => { st.eq.push([c, v]); return builder; };
      builder.in = (c: string, v: unknown[]) => { st.in.push([c, v]); return builder; };
      builder.not = (c: string) => { st.notNull = true; st.orderCol = c; return builder; };
      builder.is = (c: string) => { st.isNull = true; st.orderCol = c; return builder; };
      builder.gt = (_c: string, v: string) => { st.idGt = v; return builder; };
      builder.or = (f: string) => { st.or = f; return builder; };
      builder.order = (c: string) => { if (c !== "id") st.orderCol = c; return builder; };
      builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
      builder.limit = (limit: number) => {
        const phase = st.isNull ? "null_timestamp" : "timestamped";
        calls.push({ relation, phase, limit, orFilter: st.or });
        const index = (counters[relation] = (counters[relation] ?? 0) + 1) - 1;
        const injected = hook?.({ relation, phase, limit, index });
        if (injected) return Promise.resolve(injected);
        const col = st.orderCol;
        let rows = (tables[relation] ?? []).filter((r) => st.in.every(([c, vals]) => vals.includes(r[c])) && st.eq.every(([c, v]) => r[c] === v));
        if (st.notNull) rows = rows.filter((r) => r[col] != null);
        if (st.isNull) rows = rows.filter((r) => r[col] == null);
        if (st.idGt) rows = rows.filter((r) => String(r.id) > st.idGt!);
        if (st.or) {
          const m = /^(\w+)\.gt\.([^,]+),and\(\w+\.eq\.([^,]+),id\.gt\.([^)]+)\)$/.exec(st.or);
          if (!m) throw new Error(`unexpected or() filter: ${st.or}`);
          const [, , ts, ts2, id] = m;
          rows = rows.filter((r) => {
            const c = compareTimestamps(String(r[col]), ts);
            return c > 0 || (c === 0 && ts === ts2 && String(r.id) > id);
          });
        }
        rows = [...rows].sort((a, b) => {
          if (!st.isNull) { const c = compareTimestamps(String(a[col]), String(b[col])); if (c) return c; }
          return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
        });
        return Promise.resolve({ data: rows.slice(0, limit), error: null });
      };
      return builder;
    },
  };
  return { db, calls };
}
