/**
 * Foreign-repository prerequisites for Point23 realtime-channel standards.
 * Central owns client subscription discipline only; Core/Buyer/AI/Trace must
 * publish RLS-aligned filters and channel namespaces before runtime enablement.
 */
export const POINT23_FOREIGN_REPO_PREREQUISITES = {
  "oasis-supabase-core": [
    "Publish RLS-aligned postgres_changes filters per domain (company_id, user_id, order_id).",
    "Declare realtime publication allowlist matching REALTIME_DOMAIN_ALLOWED_SCOPES.",
    "Expose channel namespace contract in deploy manifest (App-Verse Point 14).",
    "Never treat realtime payloads as authoritative — Core remains mutation/event truth (Point 20).",
  ],
  "oasis-baklawa": [
    "Adopt Central channel naming prefix `central:{domain}:{scopeType}:{scopeKey}`.",
    "Require tenant scope on buyer order/notification subscriptions — no global channels.",
    "Snapshot-first + scoped delta-second lifecycle on tracking and cart surfaces.",
  ],
  "oasis-ai-studio": [
    "Scope catalogue draft subscriptions to studio workspace / company context.",
    "Use refetch-on-delta; do not merge partial realtime payloads as product truth.",
  ],
  "oasis-trace": [
    "Scope scan/custody subscriptions to device + consignment context.",
    "Coordinate reconnect snapshot with DPL/PI carton membership queries.",
  ],
} as const;

export type Point23ForeignRepo = keyof typeof POINT23_FOREIGN_REPO_PREREQUISITES;
