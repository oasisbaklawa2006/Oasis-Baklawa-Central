# Sprint C2C — next authority prep map (post–C2B read-only)

This document is **planning and authority alignment only**. It does not authorize migrations, Edge edits, or new database writes.

## 1. What is complete in the C2B read-only track

- **Operator inbox UI** on `/admin/operator-inbox` with optional URL alias `/admin/whatsapp` (same component, no extra server logic).
- **Read-only panels:** packet health, intent dots, observability aggregates (best-effort, partial failures surfaced), governance bar with disabled actions, failed-message read-only panel (strict outbound `operator_reply` + `failed` / `error` statuses).
- **Client-only features:** saved views, per-packet local notes, CSV export from **already-loaded visible rows** only; UI persistence for filters/toggles where implemented.
- **UX hardening:** keyboard shortcuts with safe ignore rules, insights collapse preference, virtual list remeasure on compact mode, responsive and accessibility polish passes merged from PR #69 / #70 and follow-ups.
- **Documentation:** smoke checklists, local-feature audit, deferred-aria fix, and this C2C prep map.

## 2. Why the write-path is still frozen

- **Migration / repair / db push / db pull** are frozen to avoid schema drift and accidental production shape changes without a controlled repair window.
- **Write-path expansion** is frozen so observability and inbox UX can land without coupling to new RLS policies, audit tables, or Edge auth hardening before those are explicitly approved.
- **TOOL 5** (governed operator tooling) is not yet cleared for persistence or automation; enabling writes without audit, JWT verification, and role gates would increase risk disproportionately to UI value.

## 3. Existing write surfaces (Edge — unchanged inventory)

These are the **current** `supabase.functions.invoke` entry points from the operator inbox UI (no new invokes added in the read-only track):

| Function | Purpose (high level) |
|----------|----------------------|
| `whatsapp-operator-reply` | Send operator reply for a packet (writes path — governed). |
| `whatsapp-classify-intent` | On-demand intent suggestion (Edge — governed). |
| `whatsapp-route-packet` | On-demand routing suggestion (Edge — governed). |

Authority review should confirm JWT configuration, allowed roles, idempotency expectations, and logging for **each** of these before any expansion or new siblings.

## 4. What TOOL 5 will need before implementation

Before turning on governed writes, persistence, or automation from TOOL 5, the program should explicitly satisfy at least:

1. **`verify_jwt`** (or equivalent) on Edge functions that mutate state or trigger side effects — callers must be authenticated and the token validated at the Edge boundary.
2. **`auth.uid()` (or service-role + explicit operator id)** — every mutation traceable to a human operator or system principal; no anonymous writes.
3. **Immutable audit** — append-only or tamper-evident log of who did what, when, and on which packet / message ids.
4. **Optimistic locking** — version columns or comparable conflict tokens so concurrent edits from two tabs do not silently overwrite.
5. **Conflict handling** — defined UX and server behavior when stitcher / realtime updates race operator actions.
6. **Role allowlist** — which `profiles.role` (or equivalent) may invoke which function; enforced in Edge and mirrored in RLS where applicable.
7. **Staging-only pilot** — runbook for first writes in non-production with rollback and monitoring before production promotion.

This list is not exhaustive; security and compliance may add items (PII retention, export controls, etc.).

## 5. What remains blocked (until explicitly lifted)

- **Migrations** and **repair / db push / db pull** outside an approved database change window.
- **New write-oriented Edge functions** or material changes to existing function contracts without review.
- **Queue automation** (scheduled sends, auto-route, auto-close) tied to inbox without operational sign-off.
- **TOOL 5 writes** — no persistence of drafts, assignments, or automations until TOOL 5 checklist and RLS are approved.

## 6. Recommended next safe phase

- **Authority review only:** walk this map with security / backend / ops; attach decisions to the sprint checklist repo docs; **no implementation** in the same breath as “prep.”
- **Browser smoke:** use `docs/OPERATOR_INBOX_BROWSER_SMOKE_RESULTS_TEMPLATE.md` per environment and archive results.
- **Optional UI-only follow-ups:** copy, a11y, and layout tweaks that do not add invokes or database writes — keep merging in small PRs until write thaw is explicit.

When authority signs off on a minimal vertical slice (e.g. audit table + one function hardening), open a **separate** implementation sprint with its own PR, migrations (if allowed then), and deployment plan — do not fold that work into read-only UI PRs.
