# Phase 1 Remaining Build Extraction

Generated: 2026-07-07
Scope: `oasisbaklawa2006/Oasis-Baklawa-Central`, Central admin surface only.
Method: Read-only synthesis of `.ai-intent/FEATURE_REGISTRY.md`, `.ai-intent/SCREEN_REGISTRY.md` (including the Central Admin Route Reconciliation section), `.ai-intent/PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md`, `.ai-intent/QUALITY_GATES_AND_DEFINITION_OF_DONE.md`, `.ai-intent/FINAL_E2E_EVIDENCE.md`, and `src/App.tsx` after four merged hygiene PRs. No source files were changed to produce this document.

## Current Completed Hygiene PRs

| PR | Title | What it did |
|---|---|---|
| #205 | `fix(admin): disable unavailable print actions` | Removed 6 dead-end "coming soon" print buttons (`AdminOrders.tsx`, `AdminAccountsRelease.tsx`, `OrderManagement.tsx`), replaced with clearly disabled + tooltipped buttons. |
| #206 | `fix(admin): label stub and preview routes safely` (+ 2 Bugbot follow-up commits) | Labeled `AssemblyTV`/`DispatchTV` as Coming Soon with a working return link (now pointed at `/admin/cmd-war-room` after a Bugbot fix), added a "Retired" badge to `VerificationWarRoom`, reworded static-preview badges on `CartonExplorer`/`ScanTimeline`/`InventoryRiskBoard`/`InventoryCommandCenter` to say "not live data", added "(Soon)" tags to the Display Management TV tabs, and appended "(preview)" to four sidebar nav labels. |
| #207 | `fix(admin): avoid stub screen as default landing route` | `TV_DISPLAY`/`TV_ASSEMBLY` no longer default-land on the `/admin/assembly-tv` stub after login; both now land on `/admin/cmd-war-room`. `TV_READY` (real, `/admin/rgs-tv`) unchanged. |
| #208 | `fix(admin): add scoped route error boundaries` (+ 1 Bugbot follow-up commit) | Added a single pathless `AdminRouteBoundary` layout route in `src/App.tsx` wrapping all `/admin` child routes in the existing `ErrorBoundary`, keyed on `location.pathname + location.search` so it resets between navigations. A crash in one admin screen no longer blanks the whole app or the whole admin shell. |

Net effect: the three "P0 Must Fix" items and the three "coming-soon dead-end button" P1 items from the Phase 1 audit are now closed. What remains is real build work, evidence capture, and a small number of lower-priority hygiene items the audit deliberately deferred.

## Remaining P0 Items

None outstanding. All three original P0 items (Display Management stub tabs, VerificationWarRoom registry mismatch, global-only ErrorBoundary) are resolved by the PRs above. The table below is intentionally empty to reflect that — do not re-open these without new evidence.

| Item | Route/component | Why it blocks Phase 1 | Evidence source | Exact recommended implementation | Files likely touched | Risk level | Suggested PR size | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| _(none open)_ | — | — | — | — | — | — | — | — |

## Remaining P1 Items

| Item | Route/component | Why it blocks Phase 1 | Evidence source | Exact recommended implementation | Files likely touched | Risk level | Suggested PR size | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| VerificationWarRoom hard redirect | `/admin/verification` → `VerificationWarRoom.tsx` | Screen self-documents as retired and now carries a "Retired" badge, but is still a full rendered screen rather than an instant redirect like the other legacy-bookmark routes (`customers`, `assembly`, `crm`, `roles`) in `src/App.tsx`. Inconsistent with the established pattern; audit's own "Batch 4" was proposed but never executed. | `PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md` Batch 4; `VerificationWarRoom.tsx` header comment | Change `<Route path="verification" element={<VerificationWarRoom />} />` to `<Route path="verification" element={<Navigate to="/admin/cmd-war-room" replace />} />` in `src/App.tsx`, matching the existing legacy-redirect block. Confirm no other file imports `VerificationWarRoom` before deleting the now-unused component. | `src/App.tsx` (1 line), optionally delete `VerificationWarRoom.tsx` | Low | XS | Visiting `/admin/verification` redirects immediately to `/admin/cmd-war-room`; no other route/import breaks. |
| Registry status accuracy for 3 static-preview screens | `/admin/scan-timeline`, `/admin/inventory-risk-board`, `/admin/inventory-command-center` | Registry (`SCREEN_REGISTRY.md` rows #96, #97, #93) marks these `BUILT_NEEDS_EVIDENCE`, but direct code read confirms all three use hardcoded/no-feed inputs by design ("Feed pending", static literal risk flags). Status overstates readiness. | `PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md` P1 #5 and #4; source comments in the three files | Docs-only edit to `SCREEN_REGISTRY.md`: change status to `PARTIAL` or `NOT_BUILT` for these 3 rows with a note referencing the static-input evidence. Requires explicit approval to touch the registry (this document's own scope forbids it). | `.ai-intent/SCREEN_REGISTRY.md` | None (docs only) | XS | Registry status for these 3 rows matches what direct code reading shows. |
| Mobile/responsive spot-check on flagged screens | `TargetVsActual.tsx` (fixed `grid-cols-4` summary row), `OrderManagement.tsx` (table without confirmed `overflow-x-auto`) | Quality Gates §6 requires "mobile/narrow screen is acceptable for operators"; these two were flagged as genuine candidates (not shared-shell false positives) in the audit. | `PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md` P1 #6 | Visually test both screens at a narrow viewport; if broken, change `grid-cols-4` to `grid-cols-2 sm:grid-cols-4` (TargetVsActual) and wrap the order-items table in `overflow-x-auto` (OrderManagement). | `src/pages/admin/TargetVsActual.tsx`, `src/pages/admin/OrderManagement.tsx` | Low | XS each | Both screens render without horizontal overflow or clipped content at ~375px width. |
| E2E evidence capture for the 5-screen governance-board family | `/admin/dispatch-readiness`, `/admin/dispatch-completion`, `/admin/dispatch-finalization`, `/admin/stock-finalization`, `/admin/finance-governance` | All five share a real, well-built `useGovernanceBoardState(supabase, loader, PREVIEW_ROWS, [...])` pattern with live/preview graceful fallback — the strongest-evidenced cluster in the reconciliation, but none have captured E2E evidence per Quality Gates, so none can be marked `BUILT_VALIDATED`. | `PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md` Backend/API Dependency Gaps table | Run each board against a live order that has real rows in `orders`, `dispatch_readiness_evidence`, `operational_scan_records`; record IDs/timestamps/statuses in a new evidence file following the `FINAL_E2E_EVIDENCE_TEMPLATE.md` format. No code change required unless a bug is found. | New evidence doc under `.ai-intent/`; no source change expected | Low (read-only verification) | S | Evidence doc exists with real row IDs for at least one full pass through each of the 5 boards; registry statuses updated to `BUILT_VALIDATED` only where evidence supports it. |

## Remaining P2 Items

| Item | Route/component | Why it blocks Phase 1 | Evidence source | Exact recommended implementation | Files likely touched | Risk level | Suggested PR size | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| `/admin/production` navigation duplication | `AdminProduction.tsx` | Pure tab-composition wrapper re-embedding `OrderManagement`, `AssemblyManagement`, `ReadyGoodsStore`, `AdminInventory`, `DispatchManagement` — all already reachable at their own dedicated routes. Not broken, just a second, less discoverable entry point for the same features. | `PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md` P2 #1 | Either document `/admin/production` explicitly as the "aggregated tab view" in the registry, or remove it from primary sidebar nav (it is not currently in the sidebar — confirm via `AdminLayout.tsx` nav array before any change). | `.ai-intent/SCREEN_REGISTRY.md` (docs only) | None | XS | No functional change; registry note added. |
| Backend evidence for `ThirdPartyStore.tsx` / `LabelCommandCenter.tsx` | `/admin/3pcs-store`, `/admin/label-command-center` | Weak signal only — 2 and 4 `supabase`/hook import matches respectively, versus 7-18 in comparable screens. Not fully read in the original audit pass. | `PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md` P2 #2 | Full read of both files to confirm actual data-path completeness before any status change. | None (read-only) | None | XS (research only) | A follow-up note in the registry states confirmed status with evidence, replacing the "unconfirmed" flag. |
| CartonExplorer nav grouping | `/admin/carton-explorer` | Self-labeled internal reference screen now sits in the same sidebar section as live operational screens, distinguished only by a badge and a "(preview)" label suffix. | `PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md` P2 #3 | Optional future UX pass to group non-live reference screens into a distinct "Internal tools" sidebar section. Not urgent — current labeling already prevents confusion per the acceptance criteria of PR #206. | `src/components/AdminLayout.tsx` | Low | S | Deferred — no immediate action needed. |
| Legacy alias routes | `/admin/whatsapp`, `/admin/heartbeat`, `/admin/dispatch`, `/admin/approvals` | Four routes render the exact same component as another canonical route. Documented, not broken. | `SCREEN_REGISTRY.md` reconciliation section | No action needed; already documented as intentional aliases. | None | None | — | No action required. |
| Registry phantom entries (net-new features, no route exists) | `/admin/gatekeeper`, `/admin/proforma-invoices`, `/admin/billing`, `/admin/e-way-bills`, `/admin/payment-variances`, `/admin/tickets`, `/admin/reports` | These are `SCREEN_REGISTRY.md` rows #9, #14-18, #20, #24 with no corresponding route in `src/App.tsx` at all — genuinely `NOT_BUILT` per `FEATURE_REGISTRY.md` §10, not a hygiene fix. | `SCREEN_REGISTRY.md` reverse-drift notes; `FEATURE_REGISTRY.md` "Explicitly Not Built Yet" | Net-new feature planning required (route, screen, backend, RLS) — out of scope for a hygiene/docs pass. See Backend/API Dependency Queue below. | N/A — future planning cycle | High (net-new) | L+ each | Not a Phase 1 closeout item; defer to Phase 2 feature planning. |

## Screens That Need Real Build

Existing routes that render, but are intentionally stub or static-input today and are meant to eventually carry live data (distinct from screens that are deliberately permanent internal previews — see next section).

| Route | Current status | What exists now | What is missing | Required backend/API dependency | Suggested first safe PR |
|---|---|---|---|---|---|
| `/admin/assembly-tv` | Stub (`ComingSoonOverlay`) | Full-screen "Coming Soon in Phase 2" placeholder with a working return link to CMD War Room (PR #206/#208 chain) | Any real TV-wall data — no supabase/hook usage at all | Reuse `ReadyGoodsTV.tsx`'s pattern (direct `supabase` query against assembly-relevant tables, e.g. `production_jobs`/assembly stage data) | A read-only TV board mirroring `ReadyGoodsTV.tsx`'s structure, scoped to assembly-line data only |
| `/admin/dispatch-tv` | Stub (`ComingSoonOverlay`) | Same as above, for dispatch | Same as above | Reuse `ReadyGoodsTV.tsx` pattern against dispatch-relevant tables | Same approach, scoped to dispatch data |
| `/admin/scan-timeline` | Self-documented "Feed pending" | Full UI shell (empty-state card + anomaly-kind documentation) built on top of a real derivation engine (`src/lib/barcode/`) | Any real scan event source — explicitly "no hardware, no persisted scan rows" | A barcode/scanner ingestion path feeding into `operational_scan_records` (referenced elsewhere as `ExecutionQueueBoard`'s dependency) | Wire the existing `src/lib/barcode/` derivation engine to read real `operational_scan_records` rows (read-only rendering — no new mutation path) |
| `/admin/inventory-risk-board` | Static/hardcoded inputs | Full `OperationalTimeline` rendering engine, fed literal flags (`shelfTruthUnknown: true`, `openReservationSignals: 0`, `reconciliationBacklogHint: false`) hardcoded in the component | The signal source(s) that should populate those flags | Inventory reconciliation/reservation signal tables — same feed builders already used (`buildInventoryOsOperationalFeed`, `buildExecutionOperationalFeed`) need real inputs instead of literals | Identify and wire one real signal (e.g. `openReservationSignals` from `inventory_reservations`) as a first slice, leaving the rest hardcoded until each is confirmed |
| `/admin/inventory-command-center` | Static/hardcoded inputs | Same engine as above, merging 4 feed builders (inventory, execution, governance, barcode) | Same — all 4 feeds use literal inputs | Same tables as above, plus governance/barcode signal tables | Same incremental-wiring approach as `InventoryRiskBoard`, one feed at a time |

## Screens That Should Stay Preview/Internal

Routes whose own source code or naming declares internal/preview intent — these should not be "fixed" into looking production-live; the goal is only to keep the labeling honest (already done in PR #206 for the first two).

| Route | Reason | Required label/status | Whether already handled |
|---|---|---|---|
| `/admin/carton-explorer` | Comment: "Design-time lifecycle reference only — not live cartons." Enumerates static states from a lookup table, no data fetch by design. | "Internal preview — not live data" badge | Yes — PR #206 |
| `/admin/verification` | Comment: "VerificationWarRoom is retired... kept active to avoid 404s." | "Retired — use CMD War Room" badge | Yes — PR #206 (hard redirect still pending, see P1 table above) |
| `/admin/customer-timeline-preview` | Comment: "This preview is for internal validation only. No customer app route, public API, or notification..." | Already named "preview" in both route and UI title | No new label added — route naming is already self-explanatory; consider verifying it isn't linked from any operator-facing nav (currently only in the `cmd_war_room`-gated sidebar section) |
| `/admin/operational-search`, `/admin/live-work-queues`, `/admin/entity-graph-explorer`, `/admin/queue-execution-preview`, `/admin/barcode-execution-preview` | All gated behind `AdminModuleRoute moduleKey="cmd_war_room"`, an internal power-user module distinct from the main operator sidebar sections | Registry `UNKNOWN_VALIDATE` status is appropriate; no additional labeling required beyond the existing module gate | No action needed — module gating already limits exposure |
| `/admin/product-intelligence-prototype` | Comment: "Read-only prototype — consumes approved aliases..." and in-UI text "Consumption prototype only" | Already self-labeled "prototype" in both route name and UI | No action needed |

## Backend/API Dependency Queue

| Feature/screen | Existing frontend route | Required tables/functions/API | Whether backend exists | Verification needed before build | Risk |
|---|---|---|---|---|---|
| Scan timeline live feed | `/admin/scan-timeline` | `operational_scan_records` (or equivalent) + a scanner/webhook ingestion path | Partially — `src/lib/barcode/` derivation engine exists; ingestion path does not, per the screen's own comment | Confirm whether `operational_scan_records` table exists yet (referenced by `DispatchReadinessBoard`'s `useGovernanceBoardState` dependency list) before wiring | Medium — new ingestion path, but read-only rendering |
| Inventory risk/command-center live signals | `/admin/inventory-risk-board`, `/admin/inventory-command-center` | Inventory reservation/reconciliation tables feeding `buildInventoryOsOperationalFeed`; execution satisfaction tables feeding `buildExecutionOperationalFeed` | Unconfirmed — feed builder functions exist and accept real shapes, but no caller supplies real data yet | `list_tables`-equivalent check against Supabase to confirm exact reservation/reconciliation table names before wiring any one flag | Low-medium — additive read wiring, no mutation |
| Assembly/Dispatch TV walls | `/admin/assembly-tv`, `/admin/dispatch-tv` | Same category of tables `ReadyGoodsTV.tsx` already queries directly via `supabase`, scoped to assembly/dispatch | Yes, in principle — `ReadyGoodsTV.tsx` is a working reference implementation for the same TV-wall pattern | Confirm which existing tables (`production_jobs`, dispatch equivalents) map to "TV wall" summary data before building | Low — read-only display, proven pattern to copy |
| Gatekeeper Exit Control | none (`/admin/gatekeeper` phantom) | `dispatch`, `labels`, `invoices`, `payments` per `SCREEN_REGISTRY.md` #9 | No — `NOT_BUILT` | Full feature design required; out of hygiene scope | High — net-new screen + workflow |
| Proforma Invoices / Billing Engine / E-Way Bills | none (phantom rows #14-16) | `proforma_invoices`, `invoices`, `taxes`, `eway_bills` | No — `NOT_BUILT` | Full feature design required | High — finance-domain net-new build, requires Quality Gates §3 higher gate |
| Payment Variance Approval | none (phantom row #18) | `approvals`, `payments` | No — `NOT_BUILT` | Full feature design required | High — finance-domain net-new build |
| Internal Tickets | none (phantom row #20) | `tickets`, `ticket_events` | No — `NOT_BUILT` | Full feature design required; may fold into existing `/admin/support` instead of a net-new screen | Medium |
| Reports | none (phantom row #24) | Aggregate/reporting views | No — `NOT_BUILT` | Full feature design required | Medium |

## Fastest Safe Build Sequence

Ordered safest → riskiest. None of these batches touch WhatsApp, the bridge, RLS, secrets, or financial/stock mutation paths unless explicitly noted (Batch 7 only, and even then only as a planning step).

### Batch 1 — VerificationWarRoom hard redirect
- **Why now:** Smallest possible diff, zero new risk, closes the one remaining P1 hygiene item, matches an already-proven pattern in the same file.
- **Files/routes:** `src/App.tsx` (the `verification` child route only); `/admin/verification`.
- **What not to touch:** Any other route in the `/admin` block, `AdminModuleRoute`/`RoleProtectedRoute` gating, `isAdminExpressUser`.
- **Acceptance criteria:** Visiting `/admin/verification` redirects immediately to `/admin/cmd-war-room` with no intermediate screen.
- **Suggested Claude implementation prompt:** "In `src/App.tsx`, change the `<Route path=\"verification\" element={<VerificationWarRoom />} />` entry to `<Route path=\"verification\" element={<Navigate to=\"/admin/cmd-war-room\" replace />} />`, following the exact pattern used for the `customers`/`assembly`/`crm`/`roles` legacy redirects a few lines above. First grep the codebase for any other import of `VerificationWarRoom` — if none exists outside `App.tsx` and its own file, also delete `src/pages/admin/VerificationWarRoom.tsx`; otherwise leave the file and only change the route."
- **Human verification:** Navigate to `/admin/verification`, confirm a single immediate redirect with no flash of the retired screen.

### Batch 2 — Registry status correction for 3 static-preview screens
- **Why now:** Docs-only, zero code risk, fixes a factual inaccuracy the audit already identified but deliberately did not apply.
- **Files/routes:** `.ai-intent/SCREEN_REGISTRY.md` rows #93, #96, #97 only.
- **What not to touch:** Any other registry row, any source file.
- **Acceptance criteria:** The three rows' Status column changes from `BUILT_NEEDS_EVIDENCE` to `PARTIAL` (or `NOT_BUILT` for `ScanTimeline`, which has zero live wiring), each with a one-line evidence note.
- **Suggested Claude implementation prompt:** "In `.ai-intent/SCREEN_REGISTRY.md`, update rows #93 (`InventoryCommandCenter`), #96 (`InventoryRiskBoard`), and #97 (`ScanTimeline`) — change Status from `BUILT_NEEDS_EVIDENCE` to `PARTIAL` for the first two and `NOT_BUILT` for `ScanTimeline`, and append a short note to each row's Backend Dependencies cell citing the static/hardcoded-input evidence already documented in `PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md`. Do not touch any other row or any source file."
- **Human verification:** Diff the registry file, confirm only those 3 rows changed and the rest of the table is untouched.

### Batch 3 — E2E evidence capture for the 5-screen governance-board family
- **Why now:** Read-only verification against already-solid code (the `useGovernanceBoardState` pattern) — no code change expected, highest-confidence path to legitimately promoting statuses toward `BUILT_VALIDATED`.
- **Files/routes:** New evidence doc under `.ai-intent/`; `/admin/dispatch-readiness`, `/admin/dispatch-completion`, `/admin/dispatch-finalization`, `/admin/stock-finalization`, `/admin/finance-governance`.
- **What not to touch:** No source files unless a genuine bug is found during verification — if one is, stop and report rather than silently fixing it in the same pass.
- **Acceptance criteria:** A new evidence file (following `FINAL_E2E_EVIDENCE_TEMPLATE.md`'s structure) records real row IDs/timestamps for at least one full pass through each of the 5 boards.
- **Suggested Claude implementation prompt:** "Using a live Supabase read-only session, walk through `/admin/dispatch-readiness`, `/admin/dispatch-completion`, `/admin/dispatch-finalization`, `/admin/stock-finalization`, and `/admin/finance-governance` for one real order each. Record the exact row IDs, statuses, and timestamps observed in a new file `.ai-intent/GOVERNANCE_BOARDS_E2E_EVIDENCE.md`, following the structure of `FINAL_E2E_EVIDENCE_TEMPLATE.md`. Do not modify any source file. If any board fails to load real data, stop and report the exact error instead of attempting a fix in the same pass."
- **Human verification:** Confirm the evidence doc's row IDs are real by spot-checking one in the Supabase dashboard.

### Batch 4 — Wire one real signal into InventoryRiskBoard
- **Why now:** First actual backend-wiring build, but scoped to exactly one hardcoded flag (`openReservationSignals`) to keep risk low and provide a template for the rest.
- **Files/routes:** `src/pages/admin/InventoryRiskBoard.tsx`, possibly `src/lib/operational-events/inventoryOperationalFeed.ts`; `/admin/inventory-risk-board`.
- **What not to touch:** `InventoryCommandCenter.tsx` (separate follow-up), any write/mutation path, any other feed flag on this screen (leave `shelfTruthUnknown`/`reconciliationBacklogHint` hardcoded until confirmed separately).
- **Acceptance criteria:** `openReservationSignals` reflects a real count from the inventory reservation table instead of the literal `0`; the "static preview" badge is removed or updated only once ALL flags on the screen are real (not after this partial step — badge should stay until every flag is live).
- **Suggested Claude implementation prompt:** "In `src/pages/admin/InventoryRiskBoard.tsx`, replace the hardcoded `openReservationSignals: 0` with a real count fetched from the inventory reservations table (confirm exact table/column names via a read-only Supabase query first — do not guess). Keep `shelfTruthUnknown` and `reconciliationBacklogHint` hardcoded for now. Do not remove the 'Internal preview — not connected to live data' badge in this PR since the other two flags are still static. Do not touch InventoryCommandCenter.tsx."
- **Human verification:** Confirm the displayed reservation count on the board matches a manual query against the reservations table for the same time window.

### Batch 5 — Wire remaining InventoryRiskBoard/InventoryCommandCenter flags
- **Why now:** Continuation of Batch 4 once the first slice is proven safe; still read-only, still additive.
- **Files/routes:** `src/pages/admin/InventoryRiskBoard.tsx`, `src/pages/admin/InventoryCommandCenter.tsx`; both routes.
- **What not to touch:** Any write path — these screens remain read-only monitoring views.
- **Acceptance criteria:** All flags on both screens are backed by real queries; only then remove the "static preview" badges (matching the pattern already used elsewhere, e.g. `DispatchReadinessBoard`'s live/preview toggle).
- **Suggested Claude implementation prompt:** "Following the pattern established in the previous PR for `openReservationSignals`, wire the remaining hardcoded flags in `InventoryRiskBoard.tsx` and all four feed builders' inputs in `InventoryCommandCenter.tsx` to real data sources. Once every flag is live, remove the 'Internal preview — not connected to live data' badge from both files and update their `SCREEN_REGISTRY.md` rows accordingly in the same PR."
- **Human verification:** Cross-check each displayed signal against its source table; confirm no console errors on load.

### Batch 6 — Build real Assembly TV / Dispatch TV walls
- **Why now:** Proven pattern to copy (`ReadyGoodsTV.tsx`), read-only display, no mutation — but touches two full screens instead of a flag, hence ranked above the incremental inventory wiring but below it in total surface area.
- **Files/routes:** `src/pages/admin/AssemblyTV.tsx`, `src/pages/admin/DispatchTV.tsx`; `/admin/assembly-tv`, `/admin/dispatch-tv`.
- **What not to touch:** `ReadyGoodsTV.tsx` itself (read-only reference, don't refactor it in this pass), `DisplayManagement.tsx`'s tab labels (remove the "(Soon)" tag only once the real board ships, in the same PR).
- **Acceptance criteria:** Both screens render real, auto-refreshing data mirroring `ReadyGoodsTV.tsx`'s structure; the "(Soon)" tab labels in `DisplayManagement.tsx` are removed in the same PR once both are live.
- **Suggested Claude implementation prompt:** "Using `src/pages/admin/ReadyGoodsTV.tsx` as the reference pattern (direct `supabase` queries, no write path), build real implementations of `AssemblyTV.tsx` and `DispatchTV.tsx` scoped to assembly-line and dispatch data respectively. Once both render real data, remove the '(Soon)' badge from the corresponding tab triggers in `DisplayManagement.tsx` and update `auth-routing.ts`'s comment (not its values) if relevant. Do not add any write/mutation path — these are read-only TV walls."
- **Human verification:** Load both routes, confirm live data renders and auto-refreshes without errors; confirm `DisplayManagement.tsx` tabs no longer show "(Soon)".

### Batch 7 — Net-new Central feature planning (Gatekeeper, Billing, Payment Variances, Tickets, Reports)
- **Why now (last/riskiest):** These are `NOT_BUILT` features with no existing route, screen, or table — full vertical slices touching finance/dispatch domains, requiring the Quality Gates §3 higher gate (readiness gates, duplicate protection, transactional integrity, audit trail, operator identity, rollback path) before any code is written.
- **Files/routes:** None yet — this batch is a planning/design deliverable, not a code change.
- **What not to touch:** Do not write any code, migration, or route for these features until a dedicated design doc exists and is explicitly approved.
- **Acceptance criteria:** A design doc exists per feature (route, screen, backend, RLS, audit trail, rollback plan) before any implementation PR is opened.
- **Suggested Claude implementation prompt:** "Do not implement code for this batch. Instead, read `FEATURE_REGISTRY.md` §3-5 and `SCREEN_REGISTRY.md`'s reverse-drift notes for Gatekeeper Exit Control, Proforma Invoices, Billing Engine, E-Way Bills, Payment Variance Approval, Internal Tickets, and Reports. Produce a design doc per feature covering: route, screen, required tables/RPCs, RLS policy shape, audit trail requirements, and rollback path — following the Quality Gates §3 checklist. Stop after the design docs; do not open implementation PRs in the same pass."
- **Human verification:** Design docs reviewed and explicitly approved by a human before any Batch 7 implementation PR begins.

## Recommended Next Implementation PR

**Batch 1 — VerificationWarRoom hard redirect.** It is the smallest possible next change (one line in `src/App.tsx`), carries no new risk, directly matches an already-proven pattern in the same file, and closes the last open item from the original P0/P1 hygiene sweep before any real backend-wiring work begins. Batch 2 (registry status correction) is an equally safe, purely-docs alternative that could run in parallel if a docs-only PR is preferred first.
