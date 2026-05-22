# Sprint C2B — next read-only implementation slice (plan)

**Purpose:** Plan the **next safe** work after PR **#66** (observability + inbox UX on `main`), staying inside **C2B read-only** guardrails. **Planning only** — no code in this file.

**Frozen:** migrations, `migration repair`, `db push` / `db pull`, Supabase CLI apply, Edge function edits, new `functions.invoke`, new DB writes, TOOL 5.

---

## Goals (candidate backlog)

Pick **1–2** items per PR to keep review small.

| Theme | Idea | Constraints |
|-------|------|-------------|
| **Keyboard** | Richer **operator keyboard shortcuts** (e.g. `j`/`k` list nav beyond arrows, `Esc` clear detail on narrow) | Must not add invokes; focus management only. |
| **Local preferences** | Extra **localStorage / sessionStorage** keys (e.g. observability strip collapsed, column widths) | **Never** store secrets; **no** sync to DB. |
| **Empty states** | Clearer copy / illustration when **no packets**, **no filter matches**, or **observability partial failure** | Copy + layout only unless reusing existing data. |
| **Failed messages panel** | Read-only panel surfacing **failed / error** outbound rows already in `messages` | `select`-only or reuse loaded thread; no new Edge. |
| **Customer activity** | Polish **OperatorInboxCustomerActivitySummary** (formatting, edge cases for missing `created_at`) | Pure functions + presentational. |
| **SLA buckets** | Read-only **packet SLA** labels (e.g. time-since-last-inbound tiers) using `last_message_at` + loaded messages | No new tables; document formula in PR. |

---

## Explicit out of scope

- **TOOL 5** overrides, `whatsapp_override_log` writes, packet mutation RPCs.
- **New Edge** slugs or edits to `verify_jwt` / handler logic.
- **Analytics persistence** to `whatsapp_suggestions_log` or similar without governance sign-off.
- **Broad `select('*')`** on hot paths without review.

---

## Verification (when implementing)

- `npm run typecheck`
- `npm run build`
- Manual pass against **`docs/POST_MERGE_PR66_SMOKE_TEST_CHECKLIST.md`**
- Grep: no new `.insert` / `.update` / `.delete` / `rpc(` / `functions.invoke` unless explicitly approved as a separate “authority” change.

---

## Suggested first slice (recommended)

**Operator keyboard shortcuts + empty-state polish** — smallest diff, no data model risk, improves daily operator use without touching Supabase beyond existing reads.

---

*End of plan.*
