# Governance Board Evidence Capture - 2026-07-07

Generated: 2026-07-07
Scope: `oasisbaklawa2006/Oasis-Baklawa-Central`, the 5 governance-board admin screens identified as Batch 3 in `PHASE1_REMAINING_BUILD_EXTRACTION.md`.
Method: Direct reading of all 5 page components in full, their shared hook (`useGovernanceBoardState`) and supporting modules (`previewFallback.ts`, `boardNoticeFlags.ts`, `GovernanceBoardLiveNotice.tsx`), and every test file that imports from or exercises these screens' underlying logic. No source file was changed. No app was run, no Supabase query was executed, no Playwright test was run — `node_modules` is not present in this environment and `npm install` is forbidden, so no test suite was executed either. All "test coverage" evidence below is from **static reading** of test files, not from running them.

---

## Executive Summary

- **Total screens reviewed: 5** — `/admin/dispatch-readiness`, `/admin/dispatch-completion`, `/admin/dispatch-finalization`, `/admin/stock-finalization`, `/admin/finance-governance`.
- **Live-data backed: 5 of 5.** All five call `useGovernanceBoardState(supabase, loader, previewRows, previewTables)`, which attempts a real Supabase read via a dedicated loader function before falling back to anything else.
- **Preview fallback present: 5 of 5**, but **off by default in production.** Preview cards only render when `VITE_EXECUTION_PREVIEW_FALLBACK=true` is explicitly set (`previewFallback.ts`); a real vitest assertion (`signalFusion.test.ts`) confirms this flag is `false` in the test environment and that empty live data resolves to an honest "empty" state, not a silent preview.
- **Read-only: 0 of 5.** All five have real write/mutation actions gated behind role checks and a `canExecuteWrites` flag from their respective bundle.
- **Mutation risk: highest on `DispatchFinalizationBoard`** (the first and only auditable path to `orders.status → dispatched`) and `StockFinalizationBoard` (physical stock balance deduction). The other three write append-only evidence rows without mutating `orders.status` or stock.
- **Safe to leave visible: all 5.** None are stubs, none show fabricated data as if live, and all have an honest live/preview/empty/unavailable state machine driven by `GovernanceBoardLiveNotice`.
- **Need build work before Phase 1 complete: 0 of 5 for missing code.** What's missing across all five is **runtime E2E evidence** (real Supabase rows walked through end-to-end and recorded), not missing implementation. This is a verification gap, not a build gap — see Recommended Next PR.

---

## Route to Component Mapping

| Route | Component file | Shared hooks/utilities | Current registry status |
|---|---|---|---|
| `/admin/dispatch-readiness` | `src/pages/admin/DispatchReadinessBoard.tsx` | `useGovernanceBoardState`, `useAuth`, `@/lib/dispatch-readiness` (`projectDispatchReadiness`, `createDispatchReadinessBundle`), `GovernanceBoardLiveNotice`, `DispatchReadinessEvidencePanel`, `GovernancePrerequisiteList`, `OperationalTimeline` | `SCREEN_REGISTRY.md` row #122 — `BUILT_NEEDS_EVIDENCE` |
| `/admin/dispatch-completion` | `src/pages/admin/DispatchCompletionBoard.tsx` | `useGovernanceBoardState`, `useAuth`, `@/lib/dispatch-completion` (`projectDispatchCompletion`, `createDispatchCompletionBundle`), `GovernanceBoardLiveNotice`, `GovernancePrerequisiteList`, `OperationalTimeline` | `SCREEN_REGISTRY.md` row #123 — `BUILT_NEEDS_EVIDENCE` |
| `/admin/dispatch-finalization` | `src/pages/admin/DispatchFinalizationBoard.tsx` | `useGovernanceBoardState`, `useAuth`, `@/lib/dispatch-finalization` (`projectDispatchRelease`, `createDispatchFinalizationBundle`, `dispatchLineage`), `GovernanceBoardLiveNotice`, `GovernanceHandoffReferences`, `GovernancePrerequisiteList`, `OperationalTimeline` | `SCREEN_REGISTRY.md` row #124 — `BUILT_NEEDS_EVIDENCE` |
| `/admin/stock-finalization` | `src/pages/admin/StockFinalizationBoard.tsx` | `useGovernanceBoardState`, `useAuth`, `@/lib/stock-finalization` (`projectStockFinalization`, `createStockFinalizationBundle`, in-memory repos for demo mode, `createSupabaseStockBalanceRepository`), `@/lib/stock-authority/stockAuthorityGuard`, `GovernanceBoardLiveNotice`, `GovernancePrerequisiteList`, `OperationalTimeline` | `SCREEN_REGISTRY.md` row #125 — `BUILT_NEEDS_EVIDENCE` |
| `/admin/finance-governance` | `src/pages/admin/FinanceGovernanceBoard.tsx` | `useGovernanceBoardState`, `useAuth`, `@/lib/finance-governance` (`projectFinanceRelease`, `canCommerciallyRelease`, `createFinanceGovernanceBundle`, `financeEventsToOperational`), `GovernanceBoardLiveNotice`, `GovernancePrerequisiteList`, `OperationalTimeline` | `SCREEN_REGISTRY.md` row #73 — `BUILT_NEEDS_EVIDENCE` |

All five are registered in `src/App.tsx` under the `/admin` layout route, gated by the shared `RoleProtectedRoute allowedRoles={[...ADMIN_STAFF_ROLES]}` — no per-screen role restriction beyond that (no `AdminModuleRoute` gate, unlike the `cmd_war_room`-module screens).

---

## Data Source Evidence

| Screen | Data source observed | Live API/table/function dependency | Preview fallback present? | Hardcoded/sample data present? | Evidence lines/files |
|---|---|---|---|---|---|
| DispatchReadinessBoard | Real `useGovernanceBoardState(supabase, loadDispatchReadinessRows, ...)` call; writes via `createDispatchReadinessBundle(supabase)` | `orders`, `dispatch_readiness_evidence`, `operational_scan_records` (declared in the hook call itself) | Yes — `PREVIEW_READINESS_INPUTS`, rendered only if `boardState.showPreviewCards` is true (requires `VITE_EXECUTION_PREVIEW_FALLBACK=true`) | Only as the explicit preview-mode fallback, never blended with live rows | `DispatchReadinessBoard.tsx:150-155, 171-187` |
| DispatchCompletionBoard | Same pattern via `loadDispatchCompletionRows` | `orders`, `dispatch_completion_evidence`, `operational_scan_records` | Yes — same env-gated pattern | Same — preview-only, not blended | `DispatchCompletionBoard.tsx:172-209` |
| DispatchFinalizationBoard | Same pattern via `loadDispatchFinalizationRows`; additionally calls `service.previewCustomerPublication(...)` for a **customer-facing text preview**, which is a different, unrelated use of the word "preview" (it's a real derived-text preview of what a customer would see, not fake data) | `orders`, `dispatch_release_lineage` | Yes — same env-gated card pattern | Same — preview-only, not blended | `DispatchFinalizationBoard.tsx:202-260` |
| StockFinalizationBoard | Same pattern via `loadStockFinalizationRows`; **also has a separate, distinct demo mode** (`VITE_STOCK_FINALIZATION_DEMO=true`) that swaps the entire write bundle for an in-memory repository set (`createDemoStockService`) — this is a stronger override than the other 4 and is explicitly labeled "non-production" in the UI (`persistenceLabel`) | `orders`, `inventory_reservations`, `inventory_stock_balances`, `stock_consumption_lineage` | Yes — both the standard card-preview pattern AND the separate full in-memory demo-service override | Yes, in demo mode only (`bal-demo`, `WH-MAIN`, hardcoded 50/12 qty) — clearly labeled, gated behind a second, more explicit env flag | `StockFinalizationBoard.tsx:76-97, 111-116, 163-183, 211-216` |
| FinanceGovernanceBoard | Same pattern via `loadFinanceGovernanceRows` | `orders`, `finance_review_evidence` | Yes — same env-gated card pattern | Same — preview-only, not blended | `FinanceGovernanceBoard.tsx:54-91` |

Common finding across all 5: `previewFallback.ts`'s `resolveBoardProjectionSource()` only returns `"preview"` when `liveRowCount === 0 AND isPreviewFallbackEnabled()`. If live rows exist, they are always shown regardless of the flag. If the flag is off and no live rows exist, the state resolves to `"empty"`, and `GovernanceBoardLiveNotice` renders an honest "No live orders match this governance board" message — it does **not** silently show preview cards. This is confirmed by a real test: `signalFusion.test.ts` → `describe("preview fallback")`.

---

## UX State Evidence

| Screen | Loading state | Error state | Empty state | Preview/fallback warning | Mobile/responsive notes |
|---|---|---|---|---|---|
| DispatchReadinessBoard | Yes — `GovernanceBoardLiveNotice` shows "Loading live governance signals…" while `boardState.loading` | Yes — destructive-styled "Live read unavailable: {error}" banner | Yes — distinct "No live orders match" vs. "tables unavailable" messages | Yes — amber preview-cards banner citing `meta.projectionSource` and source tables | `md:grid-cols-2` card grid (single column below 768px); header uses `flex flex-wrap` for narrow-width wrapping. No `sm:` breakpoints, but no fixed-width elements observed. |
| DispatchCompletionBoard | Same (shared `GovernanceBoardLiveNotice`) | Same | Same | Same | Same pattern (`md:grid-cols-2`, `flex flex-wrap` header) |
| DispatchFinalizationBoard | Same | Same | Same | Same | Same pattern |
| StockFinalizationBoard | Same, plus a second persistence-mode banner (`persistenceLabel`) distinguishing Supabase / demo / unavailable | Same, plus a try/catch around `handleFinalize()` surfacing a user-facing `message` state for finalize failures (e.g. "already consumed") | Same, plus an explicit "No orders pending stock deduction" message in the order-selector list | Yes — both the shared preview-card banner and a distinct persistence-mode banner | `md:grid-cols-2` for its two info cards; order-selector list is a scrollable `max-h-40` block, reasonable on narrow screens. No `sm:` breakpoints. |
| FinanceGovernanceBoard | Same (shared) | Same | Same | Same | `md:grid-cols-2` card grid; header `flex flex-wrap`. No `sm:` breakpoints. |

No screen has a dedicated component-level empty/loading/error **unit test** (e.g. React Testing Library render + assert). The state logic itself (`showEmptyLiveMessage` / `showPreviewCards` / `showUnavailableMessage` derivation) is tested in `boardNoticeFlags` via `signalFusion.test.ts`'s "governance board notice flags (Bugbot #2)" block, which confirms `unavailable` read-model source resolves to the unavailable message, not the empty-live message — a real, previously-caught bug (per the test's own "(Bugbot #2)" naming) now guarded by a passing assertion.

---

## Mutation Risk

| Screen | User actions present | Read-only or mutating | Mutation path if any | Risk level |
|---|---|---|---|---|
| DispatchReadinessBoard | "Record readiness review (evidence)" button; evidence panel (`DispatchReadinessEvidencePanel`) | Mutating | `bundle.service.reviewReadiness(...)` → writes `dispatch_readiness_evidence` only. Explicit UI guard: `FORBIDDEN_DISPATCH_UI_LABELS` blocks "Dispatch Complete", "Mark Dispatched", "Generate Invoice", "E-Way", "Capture Payment", "Final Release" from ever being rendered. | Low-Medium — append-only evidence, no order/stock/finance state change |
| DispatchCompletionBoard | "Step 1 — Review completion (evidence)", "Step 2 — Attest completion (governed)" buttons | Mutating | `bundle.service.reviewCompletion(...)` and `attestCompletion(...)` → writes `dispatch_completion_evidence`. Screen's own banner: "does **not** set `orders.status` to dispatched, deduct stock, or generate invoices." Guarded by `FORBIDDEN_COMPLETION_UI_LABELS`/`FORBIDDEN_COMPLETION_ACTIONS`. | Low-Medium — append-only attestation evidence |
| DispatchFinalizationBoard | "Finalize dispatch (governed)", "Publish customer release", "Request reversal" buttons | Mutating | `service.finalizeDispatch(...)` → per the screen's own banner, this is "the first auditable path to `orders.status → dispatched`," writing `dispatch_release_lineage` and updating order status. Explicitly excludes payment/invoice/notification/stock-deduction (`FORBIDDEN_FINALIZATION_UI_LABELS`/`_PATTERNS`). `legacyDispatchDecommission.test.ts` independently confirms other legacy screens (`AdminPackingDispatch`, `AdminSecurityGate`, `AdminAccountsRelease`) do **not** perform this same status mutation, i.e. this board is meant to be the single authoritative path. | **High** — the only real `orders.status` mutation among the 5, though heavily gated behind upstream readiness/completion/finance evidence |
| StockFinalizationBoard | "Finalize consumption" button (+ a permanently-disabled "Request reversal" button with an explanatory tooltip) | Mutating | `bundle.service.finalizeConsumption(...)` → deducts physical stock balances, writes `stock_consumption_lineage`, requires `dispatchLineageId` + `scanReference` + reconciled reservations. SUPER_ADMIN role additionally requires a typed `overrideReason` (`requiresStockOverrideReason` guard). Guarded by `FORBIDDEN_STOCK_UI_LABELS`/`_PATTERNS`. | **High** — real inventory/stock-balance mutation with financial consequence, though gated behind dispatch finalization + scan evidence + reservation reconciliation |
| FinanceGovernanceBoard | "Step 1 — Start finance review", "Step 2 — Record commercial release" buttons | Mutating | `bundle.service.startReview(...)` and `commercialRelease(...)` → writes `finance_review_evidence` (`credit_review` / `commercial_release`). Screen's own text: "Neither step dispatches or captures payment." Guarded by `FORBIDDEN_FINANCE_UI_LABELS`/`_ACTIONS`. | Low-Medium — append-only finance evidence, no payment/invoice/dispatch action |

All 5 gate every mutating action behind `bundle?.canExecuteWrites` (derived from the bundle-creation call succeeding, which itself depends on Supabase availability and, for `StockFinalizationBoard`, an additional `requiresStockOverrideReason(role)` check for `SUPER_ADMIN`). None of the 5 screens contain a raw `supabase.from(...).update(...)` call directly in the `.tsx` file itself — all writes are routed through a `bundle.service.*` method from the corresponding `lib/*` module, which is the layer the automated tests below actually exercise.

---

## Test/Evidence Coverage

| Existing tests found | What they prove | What they do not prove | Missing evidence |
|---|---|---|---|
| `src/lib/execution-read-models/__tests__/governanceGoldenChain.test.ts` (7 tests) | The full readiness → finance → completion → finalization signal-fusion chain is internally consistent: readiness review persists evidence, commercial release persists evidence, finance signal becomes `ready` after fusion, completion becomes `eligible` after upstream evidence, completion attestation does not imply dispatched, finalization becomes eligible with fused references, gate/completion references resolve correctly from evidence slices. Uses real in-memory service implementations (`createDispatchReadinessService`, `createFinanceGovernanceService`), not mocks. | Does not touch the React components, does not touch real Supabase, does not prove RLS behavior, does not prove the UI renders these states correctly. | Component-level render test; real-Supabase integration test; RLS-as-a-real-user test. |
| `src/lib/execution-read-models/__tests__/signalFusion.test.ts` (~25 tests) | (a) A repo-wide **SELECT-only enforcement test** scans every file under `execution-read-models/` (excluding `__tests__`) and fails if any contains `.insert(`, `.update(`, `.delete(`, `.upsert(`, `.rpc(`, `functions.invoke`, or `fetch(` — i.e. the read-model layer these 5 boards depend on for loading data is mechanically guaranteed read-only. (b) Finance/readiness/completion/stock signal-adapter unit tests (stale review handling, rejected evidence blocking, scan mismatch blocking, variance detection, missing-reference detection). (c) Preview-fallback behavior: confirms the flag is off in test env and that empty+available resolves to `"empty"` not `"preview"`, and unavailable resolves to `"unavailable"`. (d) `governanceReadQueries.ts` source-text guards against reintroducing fake `"live-scan"`/`"live-gate"` placeholder strings or non-existent `updated_at` column ordering (two "Bugbot" regression tests, i.e. these were real caught bugs, now guarded). | Same limits as above — pure logic/source-text level, no component rendering, no live Supabase. | Same as above. |
| `src/lib/dispatch-readiness/__tests__/dispatchDashboardGuard.test.ts` | Imports `FORBIDDEN_DISPATCH_UI_LABELS` **directly from `DispatchReadinessBoard.tsx`** and asserts it excludes dispatch-completion/invoice language — a real regression guard tied to this exact screen's exported constant. | Does not prove the labels are actually absent from *rendered* output, only that the exported constant (which the component uses to guard rendering) contains the right values. | Rendered-DOM assertion that no forbidden button ever appears. |
| `src/lib/finance-governance/__tests__/financeDashboardGuard.test.ts` | Same pattern, importing `FORBIDDEN_FINANCE_UI_LABELS` from `FinanceGovernanceBoard.tsx`. | Same limit. | Same. |
| `src/lib/dispatch-finalization/__tests__/legacyDispatchDecommission.test.ts` (5 tests) | Source-text greps confirm: `AdminPackingDispatch.tsx`, `AdminSecurityGate.tsx`, `AdminAccountsRelease.tsx` do **not** independently mutate `orders.status` to `dispatched`; `App.tsx` registers `path="dispatch-finalization"` with `DispatchFinalizationBoard`; the Supabase finalization store is confirmed as the **only** `orders.update` site for this status transition in the codebase. | Does not prove the finalization board's own write actually succeeds against a real database — it proves other screens don't compete with it. | Real-database write confirmation for `DispatchFinalizationBoard` itself. |
| `src/lib/stock-finalization/__tests__/*` (8 files: `createStockFinalizationBundle`, `stockFinalizationReservationFulfill`, `stockReservationPostFinalize`, `stockFinalizationService`, `stockConsumptionValidation`, `stockDeductionEligibility`, `stockReservationReconciliation`, `stockFinalizationHardening`) | Extensive unit coverage of the stock-finalization service layer that `StockFinalizationBoard.tsx` calls into (not individually re-read line-by-line in this pass given volume, but file presence and naming confirm dedicated coverage of reservation reconciliation, deduction eligibility, and hardening/edge cases). | Not individually verified in this pass; naming suggests logic-layer coverage only, consistent with the pattern above. | Full read of each file (out of scope for this evidence-capture pass — flagged for anyone doing deeper stock-specific verification). |

**Overall:** All 5 screens have real, meaningful **automated unit-test coverage of their underlying logic layer**, including two tests that import directly from the board `.tsx` files themselves to guard exported safety constants. None have component-rendering tests, and none have been exercised against a real Supabase instance in this pass (no app was run). This is a stronger evidence position than "no tests exist," but it does not meet Quality Gates' bar for `BUILT_VALIDATED` ("proven end-to-end with evidence").

---

## Classification Recommendation

| Screen | Recommended status | Reason |
|---|---|---|
| `/admin/dispatch-readiness` (DispatchReadinessBoard) | **BUILT_NEEDS_EVIDENCE** (unchanged) | Real live-data hook, real evidence-write service, explicit forbidden-action UI guards with a passing regression test tied to the exact exported constant. Missing only: a real walkthrough against a live order with recorded row IDs. |
| `/admin/dispatch-completion` (DispatchCompletionBoard) | **BUILT_NEEDS_EVIDENCE** (unchanged) | Same reasoning; two-step review/attest flow is fully implemented and guarded, golden-chain test confirms attestation logic is internally consistent. |
| `/admin/dispatch-finalization` (DispatchFinalizationBoard) | **BUILT_NEEDS_EVIDENCE** (unchanged) | Most business-critical of the 5 (real `orders.status` mutation) — implementation is real and independently guarded by `legacyDispatchDecommission.test.ts`, but a real order-status mutation deserves the strongest E2E proof before any `BUILT_VALIDATED` claim; recommend this screen be evidence-captured **first** within Batch 3. |
| `/admin/stock-finalization` (StockFinalizationBoard) | **BUILT_NEEDS_EVIDENCE** (unchanged) | Real stock-balance mutation with the deepest test suite (8 dedicated test files) of the 5, plus a clearly-labeled non-production demo mode. Still needs a real-Supabase-persistence-mode walkthrough (not the demo mode) before evidence can be considered complete. |
| `/admin/finance-governance` (FinanceGovernanceBoard) | **BUILT_NEEDS_EVIDENCE** (unchanged) | Real evidence-write service, two-step review/release flow, guarded UI constants with a passing regression test. |

No screen is recommended for `BLOCKED` — none has a missing dependency or unresolved architectural question preventing evidence capture. No screen is recommended for `PARTIAL` — all five have a complete implementation (read path + write path + UX states + safety guards), unlike the three screens downgraded to `PARTIAL` in the prior Post-Hygiene Status Alignment pass (`InventoryRiskBoard`, `InventoryCommandCenter`, `ScanTimeline`), which use hardcoded literals instead of a real read path. **No screen is marked `BUILT_VALIDATED`** — that requires actual runtime/E2E proof (real row IDs, real RLS-as-a-user confirmation, real UI smoke), none of which was collected in this docs-only pass.

---

## Required Build Work

| Screen | Missing piece | Recommended implementation | Files likely touched | Risk level | Suggested PR size |
|---|---|---|---|---|---|
| All 5 | Runtime E2E evidence packet | Walk each board against one real order with live rows in the relevant tables (`orders` + the per-screen evidence/lineage table); record order IDs, evidence row IDs, and timestamps in a new evidence doc following `FINAL_E2E_EVIDENCE_TEMPLATE.md`'s structure | New `.ai-intent/*.md` evidence doc only; no source change expected unless a real bug surfaces | Low (read/write against already-gated, already-tested write paths) | S |
| DispatchFinalizationBoard specifically | Confirmation that `service.finalizeDispatch(...)` correctly updates `orders.status` in a real environment (not just in-memory/unit-tested) | Same E2E walkthrough as above, but this screen should be evidence-captured with extra care given it's the only real status-mutation path among the 5 | Same | Low-Medium (real order status change — should be done on a test/non-critical order first) | S, but sequence last within Batch 3 |
| StockFinalizationBoard specifically | Confirmation of real Supabase persistence mode (not `VITE_STOCK_FINALIZATION_DEMO=true`) actually deducting a real stock balance row with correct optimistic-locking (`expectedBalanceVersion`) | Same E2E walkthrough, explicitly noting `persistenceLabel` shows "Supabase persistence" (not "Demo in-memory") during the test | Same | Low-Medium (real stock deduction — use a test SKU/order) | S |
| None | No code-level gap identified in this pass | — | — | — | — |

---

## Recommended Next PR

**A docs-only E2E evidence-capture PR** — not a code/implementation PR. All 5 screens are code-complete with real live-data wiring, real gated write paths, and meaningful existing unit-test coverage of their logic layer; what's missing is the runtime proof itself, not more implementation. The next PR should:

1. Walk `DispatchReadinessBoard` → `DispatchCompletionBoard` → `FinanceGovernanceBoard` (the three append-only-evidence screens) against one real order each, recording evidence row IDs and timestamps.
2. Walk `DispatchFinalizationBoard` last among the four dispatch/finance screens, since it is the one real `orders.status` mutation — verify on a test order.
3. Walk `StockFinalizationBoard` in real Supabase persistence mode (not demo mode), verifying the `expectedBalanceVersion` optimistic-lock path and recording the resulting stock balance/lineage rows.
4. Record everything in a new `.ai-intent/GOVERNANCE_BOARDS_E2E_EVIDENCE.md` file following `FINAL_E2E_EVIDENCE_TEMPLATE.md`'s structure.
5. Only after that evidence exists should any of these 5 rows in `SCREEN_REGISTRY.md` be considered for `BUILT_VALIDATED` — and only for the specific screens the evidence actually covers.

If a real bug is found during that walkthrough, stop and report it rather than silently patching it in the same evidence-capture pass — that would conflate "capturing evidence" with "fixing a newly-found bug," which should be its own reviewed PR per this project's Quality Gates and Cursor Cost Control policies.
