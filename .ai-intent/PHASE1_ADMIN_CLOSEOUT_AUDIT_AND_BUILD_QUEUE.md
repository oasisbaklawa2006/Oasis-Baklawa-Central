# Phase 1 Admin Closeout Audit and Build Queue

Generated: 2026-07-07
Scope: `oasisbaklawa2006/Oasis-Baklawa-Central`, read-only audit of the 75-route Central admin surface.
Method: Direct reading of `src/App.tsx`, `.ai-intent` governance docs, and ~20 fully-read admin page/component files, plus repo-wide grep sweeps for known risk signals (coming-soon stubs, TODO markers, mock/placeholder wording, self-documented "reference only"/"projections only"/"feed pending" comments, `ErrorBoundary` usage, responsive Tailwind breakpoints, and direct `supabase` usage). No code was changed, no build/typecheck/tests/Playwright were run, and no commit/push/PR was made for this pass.

This document is a companion to `SCREEN_REGISTRY.md` (Central Admin Route Reconciliation - 2026-07-07) and does not modify it. Where this audit's direct code inspection suggests a status in that registry may need revisiting, it is called out explicitly below as a **recommendation for a future registry update**, not applied here.

---

## Executive Summary

- **Total live admin routes reviewed: 75** (the `/admin` index route + 74 non-redirect children, per the `src/App.tsx` route tree and the existing `SCREEN_REGISTRY.md` reconciliation).
- **Production-ready but needs evidence: ~48** — real components, real `supabase`/hook-backed data paths, but no captured E2E/RLS/smoke evidence yet (Quality Gates §1 `BUILT_NEEDS_EVIDENCE`).
- **Partial / prototype / preview / sample: 7 confirmed by direct code read** — `AssemblyTV`, `DispatchTV` (literal `ComingSoonOverlay` stubs), `VerificationWarRoom` (self-documented as retired), `CartonExplorer`, `ScanTimeline`, `InventoryRiskBoard`, `InventoryCommandCenter` (self-documented "reference only" / "projections only" / "feed pending", static or hardcoded inputs, no live signal wiring yet).
- **Unknown requiring validation: 17** — the `AdminModuleRoute`-gated screens under `cmd_war_room`/`production`/`inventory`/`dispatch`/`orders`/`support` module keys (already marked `UNKNOWN_VALIDATE` in the registry). Direct reads of 3 of these (`ExecutionRiskBoard`, `ExecutionBottlenecks`, and by the same hook, `ExecutionCommandCenter`) show real hook-backed logic (`useExecutionCommandCenter`), so this bucket is not uniformly weak — it is uniformly *unproven*.
- **Route aliases (safe, low-effort): 2** — `/admin/whatsapp` (alias of the already-proven `OperatorInbox`) and `/admin/heartbeat` (alias of `AdminDashboard`).
- **Already proven (do not touch): 1** — `/admin/operator-inbox` (WhatsApp Operator Inbox), backed by `FINAL_E2E_EVIDENCE.md`.
- **High-risk to touch (money/stock/dispatch/finance/order-promotion domain, Quality Gates §3 applies): ~29** of the 75 (finance, accounts-release, pricing, dispatch family, the 7 `execution/*` boards, golden-chain-operator, order-management, central-pool, stock/inventory family, operator-inbox/whatsapp).
- **Safe to leave unchanged this phase: ~30** — low-blast-radius admin-ops/settings/reference/reporting screens with no money or stock mutation path (clients, products, users, settings, audit, currency, moq, support, department, notifications, merchandising, catalogue-sync/approvals, display-management, label-command-center, store-coordination, target-vs-actual, third-party store, announcements, sales-hub, carton-explorer, scan-timeline, the two aliases, logistics, approvals, customer-timeline-preview, operational-search, live-work-queues, entity-graph-explorer, product-intelligence-prototype).

Note: these buckets are not perfectly mutually exclusive (e.g. a screen can be both "needs evidence" and "high risk to touch" if it touches finance/dispatch). Counts are best-effort from direct reading, not a mechanically verified partition.

---

## P0 Must Fix Before Broad Build

| Item | Route/component | Problem | Risk | Recommended fix | Est. files touched | PR size | Code change required |
|---|---|---|---|---|---|---|---|
| 1 | `/admin/display-management` → embeds `AssemblyTV`, `DispatchTV` | Two of the three embedded TV tabs (`AssemblyTV.tsx`, `DispatchTV.tsx`) render nothing but `ComingSoonOverlay` — operators clicking "Assembly TV" or "Dispatch TV" from Device & Display Management see a dead end with no path forward. | Medium — confusing for TV_ASSEMBLY/TV_DISPLAY/dispatch roles who rely on this nav; not a data-integrity risk. | Either (a) label the tabs "Coming Soon" directly in the tab trigger so the dead end is visible before the click, or (b) build the real board once assembly/dispatch TV data source is decided. This audit does not decide which — flag for product decision. | 1 (label-only fix) or 2+ (real board) | XS (label) / M (real board) | Yes, but trivial for the label-only version |
| 2 | `/admin/verification` (`VerificationWarRoom.tsx`) | Component's own header comment states it is retired ("Shadow client triage has moved to CMD War Room... kept active to avoid 404s"). Registry still lists it as `BUILT_NEEDS_EVIDENCE`, which overstates its status. | Low functional risk (it soft-redirects via a link, not a hard `<Navigate>`), but it is misleading in a registry/status sense and wastes a click for anyone who lands on the URL. | Convert to a hard `<Navigate to="/admin/cmd-war-room" replace />` in `App.tsx` (consistent with the existing legacy-redirect pattern already used for `customers`, `assembly`, etc.), OR at minimum flag its registry status as retired/superseded in the next registry update. | 1 (`src/App.tsx`) if redirecting | XS | Yes, if converting to hard redirect (out of scope for this audit — flagged only) |
| 3 | Global `ErrorBoundary` coverage | Only two `ErrorBoundary` instances exist in the whole app: one wraps the entire `<App>` tree (`src/App.tsx:259`), and one scopes `/admin/pricing` only (`src/App.tsx:323`). All other 74 admin routes share the single app-root boundary. | Medium-high — an unhandled render error in any one of the other 73 admin screens (e.g. a null-pointer in a chart, a bad date parse) blanks the *entire* app shell behind "Application connection interrupted," not just the offending screen, taking down navigation for every admin user mid-session. | Add scoped `ErrorBoundary` wrappers per route group (at minimum around the `AdminLayout` child `<Outlet>` or per high-traffic route), following the exact pattern already proven at `pricing`. **Do not implement this in the current audit** — task scope forbids ErrorBoundary changes; flagged for a dedicated follow-up PR. | ~3-5 (`App.tsx` + possibly `AdminLayout.tsx`) | S | Yes (explicitly out of scope for this audit) |

## P1 Should Fix Soon

| Item | Route/component | Problem | Risk | Recommended fix | Est. files touched | PR size | Code change required |
|---|---|---|---|---|---|---|---|
| 1 | `AdminOrders.tsx:1077,1080` | "Print Final Invoice" / "Print Packing List" buttons call `toast.info("... coming soon")` — no real print action. | Low-medium — operators expect these buttons to work; silent no-op erodes trust in the Orders screen. | Either wire real print/export, or replace the buttons with a visibly disabled state + tooltip instead of a clickable dead end. | 1 | XS-S | Yes |
| 2 | `AdminAccountsRelease.tsx:766,770,774` | "Consignee Sticker", "Packing List", "Export Invoice" print buttons all toast "coming soon". | Low-medium — same as above, in a finance/dispatch-adjacent screen where staff expect document generation to work. | Same as above. | 1 | XS-S | Yes |
| 3 | `OrderManagement.tsx:505` | "Print Packing Slip" button toasts "coming soon". | Low-medium. | Same as above. | 1 | XS-S | Yes |
| 4 | `InventoryRiskBoard.tsx`, `InventoryCommandCenter.tsx` | Both screens present as live "risk"/"command center" boards but their inputs (`shelfTruthUnknown`, `openReservationSignals`, `financeVerified`, etc.) are hardcoded literals in the component, not fetched from any table/hook. Code comments are honest about this ("wire real satisfaction flags from War Room in a later pass"), but a viewer unaware of the source would assume these are live signals. | Medium — presents as "production-ready" (styled like a live dashboard) but is a static demo of the timeline-rendering engine; could mislead an owner/manager relying on it for a real decision, violating the "no important workflow should become a black box" standard in `PRODUCT_BUSINESS_EXCELLENCE_POLICY.md` §5. | Add a visible "static preview" badge (a `Badge variant="outline"` similar to the one `ReservationBoard.tsx` and `CartonExplorer.tsx` already use), or wire the flags to real signal sources. | 2 | XS (badge) / M (real wiring) | Yes |
| 5 | `ScanTimeline.tsx` | Self-documented "Feed pending" / "No real scan feed connected yet." This is functionally `NOT_BUILT`/`PLANNED`, but the registry (added in the prior reconciliation PR) marks `/admin/scan-timeline` as `BUILT_NEEDS_EVIDENCE`. | Low functional risk (the screen is honest about its own state in-UI), but registry status is inaccurate. | Recommend downgrading this route's status to `PLANNED`/`NOT_BUILT` in a future `SCREEN_REGISTRY.md` update once the barcode scan feed exists. Not changed here — registry edits are out of scope for this audit. | 0 (docs-only, future PR) | XS | No |
| 6 | 22 admin page files with no responsive Tailwind breakpoint classes (`sm:`/`md:`/`lg:`) found directly in the file (see Mobile/Responsiveness Risk table) | Some inherit responsiveness from a shared shell (e.g. `DepartmentExecutionBoard.tsx` → `ExecutionResponsiveShell`) and are false positives; others (e.g. `TargetVsActual.tsx`'s `grid-cols-4` summary row) look like genuine fixed-width desktop layouts. | Medium for the genuine cases — Quality Gates §6 requires "mobile/narrow screen is acceptable for operators." | Visually spot-check the ~10 files that do NOT delegate to a shared shell (see table) on a narrow viewport before Phase 2 sign-off. | 0 for audit; TBD per screen | XS-S each | Case-by-case |

## P2 Later / Not Blocking

| Item | Route/component | Problem | Risk | Recommended fix | Est. files touched | PR size | Code change required |
|---|---|---|---|---|---|---|---|
| 1 | `/admin/production` (`AdminProduction.tsx`) | Pure tab-composition wrapper that lazy-loads `OrderManagement`, `AssemblyManagement`, `ReadyGoodsStore`, `AdminInventory`, `DispatchManagement` — the same components already reachable at their own dedicated routes (`/admin/order-management`, `/admin/assembly-tasks`, `/admin/ready-goods`, `/admin/inventory`, `/admin/dispatch-mgmt`). | Low — not broken, just duplicated navigation surface; two ways to reach the same screen can drift in perceived "status." | Consider consolidating navigation to avoid two entry points per feature, or explicitly document `/admin/production` as the "aggregated tab view" in the registry. | 0-1 | XS | No (docs-only) |
| 2 | `ThirdPartyStore.tsx`, `LabelCommandCenter.tsx` | Lower backend-import density than comparable screens (2 and 4 matches respectively for `supabase`/hook imports, vs. 7-18 in comparable dispatch/production screens) — a weak signal only, not confirmed by full read in this pass. | Low-medium, unconfirmed. | Prioritize a closer read/evidence pass before marking these `BUILT_VALIDATED`. | 0 | XS | No |
| 3 | `CartonExplorer.tsx` | Explicitly self-labeled "Design-time lifecycle reference only — not live cartons." Legitimate and honest, but sits in the main admin nav alongside live operational screens with no visual distinction beyond a small badge. | Low. | Leave as an internal lab screen; consider grouping non-live reference screens under a distinct nav section in a future UX pass. | 0 | XS | No |
| 4 | Legacy-alias routes `/admin/whatsapp`, `/admin/heartbeat`, `/admin/dispatch`, `/admin/approvals` | Four routes render the exact same component as another canonical route, with no distinguishing UI. Not wrong, just redundant surface area to maintain. | Low. | No action needed; document as intentional aliases (already done in the registry reconciliation). | 0 | — | No |

---

## Prototype / Preview / Sample Screens

| Route | Component | Evidence | Recommendation |
|---|---|---|---|
| `/admin/assembly-tv` | `AssemblyTV.tsx` | File body is exactly `<ComingSoonOverlay moduleName="Assembly TV" />` — no other logic. | Convert to hidden/labeled-disabled in nav until built, or build for real. Do not remove without confirmation. |
| `/admin/dispatch-tv` | `DispatchTV.tsx` | File body is exactly `<ComingSoonOverlay moduleName="Dispatch TV" />` — no other logic. | Same as above. |
| `/admin/verification` | `VerificationWarRoom.tsx` | Header comment: "VerificationWarRoom is retired... This route is kept active to avoid 404s on existing bookmarks or links." UI is a soft-redirect card pointing to `/admin/cmd-war-room`. | Convert to a hard `<Navigate>` redirect (matches the existing legacy-redirect pattern), or leave as-is if the soft-redirect UX is intentional. Do not remove without confirmation — it protects old bookmarks. |
| `/admin/carton-explorer` | `CartonExplorer.tsx` | Comment: "Design-time lifecycle reference only — not live cartons." Renders static enumerated states from a lookup table, no data fetch. | Leave as internal lab; rename or badge more prominently so operators don't mistake it for live carton data. |
| `/admin/scan-timeline` | `ScanTimeline.tsx` | Comment: "No hardware, no persisted scan rows, no illustrative timeline events." Explicit "Feed pending" badge in the UI itself. | Leave as internal lab / honest placeholder until a real scan feed exists. Recommend registry status downgrade in a future pass (see P1 #5). |
| `/admin/inventory-risk-board` | `InventoryRiskBoard.tsx` | Comment: "Feed uses honest flags only... Reservation counts and reconciliation backlog hints stay off until real signals are wired." Inputs are hardcoded literals. | Convert to production once real inventory signals are wired, or add a visible "static preview" badge in the interim (see P1 #4). |
| `/admin/inventory-command-center` | `InventoryCommandCenter.tsx` | Comment: "merged projections only (no stock edits, no scanner I/O)... wire real satisfaction flags from War Room in a later pass." Inputs are hardcoded literals. | Same as above. |

Not classified as prototype despite naming: `ProductIntelligencePrototype.tsx` (`/admin/product-intelligence-prototype`) reads and writes through a real `createProductIntelligenceService(supabase)` service — the "Prototype" in the name appears to be a naming artifact from early development, not a functional signal. Recommend leaving its `UNKNOWN_VALIDATE` status as-is until evidence is captured, but do not assume it is a stub.

---

## Coming-Soon / Dead-End Actions

| File | Approx line | Label/text | User impact | Recommended handling |
|---|---|---|---|---|
| `src/pages/admin/AdminOrders.tsx` | 1077 | "Print Final Invoice" → `toast.info("Final Tax Invoice generation coming soon")` | Button looks actionable, does nothing but toast. | Wire real print/export or visibly disable with a tooltip. |
| `src/pages/admin/AdminOrders.tsx` | 1080 | "Print Packing List" → `toast.info("Packing List print coming soon")` | Same. | Same. |
| `src/pages/admin/AdminAccountsRelease.tsx` | 766 | "Consignee Sticker" → `toast.info("Consignee Sticker print — coming soon")` | Same, in a finance/dispatch-adjacent screen. | Same. |
| `src/pages/admin/AdminAccountsRelease.tsx` | 770 | "Packing List" → `toast.info("Packing List print — coming soon")` | Same. | Same. |
| `src/pages/admin/AdminAccountsRelease.tsx` | 774 | "Export Invoice" → `toast.info("Export Invoice print — coming soon")` | Same. | Same. |
| `src/pages/admin/OrderManagement.tsx` | 505 | "Print Packing Slip" → `toast.info("Print functionality coming soon")` | Same. | Same. |
| `src/pages/admin/AssemblyTV.tsx` | 1-5 | Entire screen is `ComingSoonOverlay` | Full-screen dead end for TV_ASSEMBLY role. | See Prototype table above. |
| `src/pages/admin/DispatchTV.tsx` | 1-5 | Entire screen is `ComingSoonOverlay` | Full-screen dead end for TV_DISPLAY/dispatch roles. | See Prototype table above. |

---

## ErrorBoundary Coverage Gap

| Route/screen group | Current coverage | Recommended wrapper/boundary plan | Risk of adding wrapper |
|---|---|---|---|
| `/admin/pricing` | Scoped `ErrorBoundary fallbackTitle="Pricing Matrix crashed"` (`src/App.tsx:323`) | Already correct — use as the reference pattern. | None — already shipped. |
| All other 74 `/admin/*` routes (index, clients, products, orders, finance, dispatch, execution/*, cmd-war-room, etc.) | Only the single app-root `ErrorBoundary fallbackTitle="Application connection interrupted"` (`src/App.tsx:259`), which wraps `BrowserRouter` itself. | Add a scoped boundary around the `AdminLayout`'s route `<Outlet>` (one boundary would protect all 74 at once with minimal diff) as a first pass; consider per-route boundaries for the highest-traffic/highest-risk screens (orders, finance, dispatch, execution boards) in a later pass. | Low technical risk (the pattern is proven at `pricing`), but it is a `.tsx` change and therefore explicitly out of scope for this read-only audit — flagged only. |

---

## Mobile / Responsiveness Risk

Signal used: absence of any `sm:`, `md:`, `lg:` Tailwind breakpoint class or `overflow-x-auto` in the page file itself. This is a **soft signal** — several of these delegate real responsive behavior to a shared shell component and are false positives; they are marked as such below.

| Route/component | Evidence | Recommended action |
|---|---|---|
| `/admin/execution/*` (7 routes) via `DepartmentExecutionBoard.tsx` | No breakpoint classes in `DepartmentExecutionBoard.tsx` itself, but it renders `ExecutionResponsiveShell`, `ExecutionBoardMobileView`, and `ExecutionBoardTVView` — dedicated mobile/TV view components exist. **Likely false positive.** | No action needed; confirmed by structure, not required to re-verify visually. |
| `/admin/assembly-tv`, `/admin/dispatch-tv` | No responsive classes — but these are `ComingSoonOverlay` stubs with almost no layout to break. **Not a real risk.** | No action needed until built for real. |
| `/admin/execution-risk`, `/admin/execution-bottlenecks` | Small, single-column card layouts (`max-w-4xl`) with no grid — unlikely to break on mobile even without explicit breakpoints. **Low risk.** | No action needed. |
| `/admin/target-vs-actual` (`TargetVsActual.tsx`) | Summary row uses a fixed `grid-cols-4` (line 142) with no `sm:`/`md:` responsive override, in a screen otherwise built for desktop chart viewing (`recharts` `BarChart`). **Genuine candidate.** | Visually check on a narrow viewport; likely needs `grid-cols-2 sm:grid-cols-4` or similar. |
| `/admin/order-management` (`OrderManagement.tsx`) | No responsive classes found; screen renders a `<table>` per the coming-soon grep hit context. | Visually check for `overflow-x-auto` around the table on narrow viewports. |
| `/admin/inventory-command-center`, `/admin/inventory-risk-board`, `/admin/carton-explorer`, `/admin/scan-timeline` | Static reference/preview screens (see Prototype table); `CartonExplorer.tsx` does use `sm:grid-cols-2 lg:grid-cols-3` in its card grid, so only `InventoryRiskBoard`, `InventoryCommandCenter`, `ScanTimeline` genuinely lack any breakpoint class. | Low priority given these are already flagged as static/preview in P1 #4 and #5 — fix alongside that work rather than separately. |
| `AdminAnnouncements.tsx`, `AdminCatalogueSyncStatus.tsx`, `AdminCurrency.tsx`, `AdminLogistics.tsx`, `AdminMerchandising.tsx`, `AssemblyManagement.tsx`, `OperationsController.tsx`, `ReadyGoodsStore.tsx`, `ThirdPartyStore.tsx`, `VerificationWarRoom.tsx` | No responsive breakpoint classes found in a repo-wide grep; not individually read in this pass. | Not yet confirmed as real risk vs. false positive — recommend a quick visual pass before Phase 2, lowest priority in this list. |

---

## Backend/API Dependency Gaps

| Screen | Expected data source | Current observed data source | Risk | Recommended backend verification before build |
|---|---|---|---|---|
| `InventoryRiskBoard.tsx` | Live inventory reservation/reconciliation signals | Hardcoded literal flags (`shelfTruthUnknown: true`, `openReservationSignals: 0`, `reconciliationBacklogHint: false`) passed directly in the component | Medium — presents as live, is not. | Confirm which table/RPC should supply these flags before wiring; do not silently flip to "live" without a source. |
| `InventoryCommandCenter.tsx` | Merged inventory/execution/governance/barcode operational feeds | Hardcoded literal flags across four feed builders, explicitly commented as placeholder | Medium — same pattern as above, larger surface (4 feeds). | Same. |
| `ScanTimeline.tsx` | Barcode/scanner event stream | None — explicitly "no hardware, no persisted scan rows" | Low (UI is honest about this) | Confirm scanner integration plan before building; screen is intentionally inert until then. |
| `AssemblyTV.tsx`, `DispatchTV.tsx` | Live assembly/dispatch TV feed (same family as the working `ReadyGoodsTV.tsx`, which does use `supabase` directly) | `ComingSoonOverlay` only | Low (clearly marked) | `ReadyGoodsTV.tsx` is a working reference implementation for the same TV-wall pattern — reuse its data-fetch approach when building these out. |
| `ThirdPartyStore.tsx`, `LabelCommandCenter.tsx` | Warehouse/label operational tables | Only 2 and 4 `supabase`/hook import matches respectively (weak signal, not fully read this pass) | Unconfirmed | Do a full read before treating as validated; do not assume built from route existence alone. |
| Governance-board family (`DispatchReadinessBoard.tsx`, `DispatchCompletionBoard.tsx`, `DispatchFinalizationBoard.tsx`, `StockFinalizationBoard.tsx`, `FinanceGovernanceBoard.tsx`) | `orders`, `dispatch_readiness_evidence`, `operational_scan_records`, and related governance tables | Confirmed real: all five share a `useGovernanceBoardState(supabase, loader, PREVIEW_ROWS, [...])` pattern that gracefully falls back to labeled preview cards only when zero live rows exist — directly read in `DispatchReadinessBoard.tsx`. | Low — this is the strongest-evidenced cluster in the newly reconciled routes. | Still needs formal E2E evidence capture (per Quality Gates) before `BUILT_VALIDATED`, but the code itself is sound and consistent. |

---

## Safe First Build Batches

Ordered safest → riskiest. None of these batches touch WhatsApp, the bridge, RLS, secrets, or financial/stock mutation paths.

### Batch 1 — Coming-soon print button cleanup
- **Why safe:** UI-only, no data mutation, no schema/route/auth change; the target lines are already isolated `onClick` handlers.
- **Files:** `src/pages/admin/AdminOrders.tsx` (lines ~1077, 1080), `src/pages/admin/AdminAccountsRelease.tsx` (lines ~766, 770, 774), `src/pages/admin/OrderManagement.tsx` (line ~505).
- **What not to touch:** any surrounding order/finance mutation logic in these same files; only the six named buttons.
- **Acceptance criteria:** each button either performs a real, already-available print/export action, or is visibly disabled (not just silently toasting) with a tooltip explaining why.
- **Suggested Claude prompt:** "In `src/pages/admin/AdminOrders.tsx`, `AdminAccountsRelease.tsx`, and `OrderManagement.tsx`, find the six buttons whose `onClick` calls `toast.info(...'coming soon'...)`. For each, replace the coming-soon toast with a `disabled` state + `title`/tooltip attribute explaining the feature is not yet available, using the existing Button component's disabled styling. Do not add new print/export logic. Do not touch any other button or handler in these files."
- **Suggested human verification:** click each of the six buttons in a browser and confirm they render visibly disabled instead of toasting a fake success-adjacent message.

### Batch 2 — Static "preview" badges on hardcoded-input analytics screens
- **Why safe:** additive UI-only badge, no logic change, no data source change.
- **Files:** `src/pages/admin/InventoryRiskBoard.tsx`, `src/pages/admin/InventoryCommandCenter.tsx`.
- **What not to touch:** the hardcoded input objects themselves, the `OperationalTimeline` rendering, any other admin screen.
- **Acceptance criteria:** both screens show a clearly visible "Static preview — not live data" badge near the header, consistent with the existing `Badge variant="outline"` pattern already used in `CartonExplorer.tsx` and `ReservationBoard.tsx`.
- **Suggested Claude prompt:** "In `src/pages/admin/InventoryRiskBoard.tsx` and `InventoryCommandCenter.tsx`, add a `Badge variant=\"outline\"` next to the existing header badge that reads 'Static preview — not wired to live signals yet', matching the styling already used for the 'Variance + execution' / 'Projections only' badges in the same files. Do not change the hardcoded input objects or any data logic."
- **Suggested human verification:** visually confirm the new badge renders on both screens without layout shift.

### Batch 3 — Assembly TV / Dispatch TV tab labeling in Device & Display Management
- **Why safe:** label-only change in a parent composition screen; does not touch the `ComingSoonOverlay` components themselves or any route.
- **Files:** `src/pages/admin/DisplayManagement.tsx`.
- **What not to touch:** `AssemblyTV.tsx`, `DispatchTV.tsx`, `ReadyGoodsTV.tsx`, any route definitions in `App.tsx`.
- **Acceptance criteria:** the "Assembly TV" and "Dispatch TV" tab triggers visibly indicate "Coming Soon" before the user clicks into them (e.g. a small badge next to the tab label), so the dead end is visible up front rather than after a click.
- **Suggested Claude prompt:** "In `src/pages/admin/DisplayManagement.tsx`, add a small 'Coming Soon' badge next to the 'Assembly TV' and 'Dispatch TV' tab trigger labels only (not 'RGS TV', which is real). Do not change the `TabsContent` bodies or any other file."
- **Suggested human verification:** open `/admin/display-management`, confirm the two badges render on the correct tabs and the third (RGS TV) is unaffected.

### Batch 4 — VerificationWarRoom hard redirect
- **Why moderately safe:** a `.tsx` route-table change (touches `App.tsx`), but converts an already-explicit soft-redirect UI into a hard `<Navigate>`, matching an existing proven pattern (`customers`, `assembly`, `crm`, `roles` redirects already in the same file). No new route, no removed route, no auth change.
- **Files:** `src/App.tsx` (the `verification` child route), optionally delete `src/pages/admin/VerificationWarRoom.tsx` if no longer referenced elsewhere (confirm no other imports first).
- **What not to touch:** any other route in the `/admin` block; `AdminModuleRoute`/`RoleProtectedRoute` gating; `isAdminExpressUser`.
- **Acceptance criteria:** visiting `/admin/verification` immediately lands on `/admin/cmd-war-room` with no intermediate screen, and no other route or import breaks.
- **Suggested Claude prompt:** "In `src/App.tsx`, change the `<Route path=\"verification\" element={<VerificationWarRoom />} />` entry to `<Route path=\"verification\" element={<Navigate to=\"/admin/cmd-war-room\" replace />} />`, following the exact pattern already used for the `customers`, `assembly`, `finance/payments`, `finance/invoices`, `crm`, and `roles` legacy redirects a few lines above. First grep the codebase for any other import of `VerificationWarRoom` before deciding whether to delete the now-unused component file — if it is imported elsewhere, leave the file in place and only change the route."
- **Suggested human verification:** navigate to `/admin/verification` and confirm an immediate, single redirect to `/admin/cmd-war-room` with no flash of the old retired screen.

### Batch 5 — Scoped ErrorBoundary around the AdminLayout outlet
- **Why riskiest of the five (but still low):** touches the shared `AdminLayout`/route composition that all 74 admin screens depend on, so a mistake has the widest blast radius of this batch set — but the pattern being copied (`ErrorBoundary fallbackTitle=...`) is already proven and shipped for `/admin/pricing`, so the risk is mechanical correctness, not architectural novelty.
- **Files:** `src/App.tsx` (or `src/components/AdminLayout.tsx`, whichever wraps the `<Outlet>`).
- **What not to touch:** the existing app-root `ErrorBoundary`, the `pricing`-specific `ErrorBoundary`, any route path, any auth/role gate, `isAdminExpressUser`.
- **Acceptance criteria:** a deliberately-thrown error inside any single admin child route renders a scoped fallback (not the app-root "Application connection interrupted" screen) while the admin shell (nav, sidebar) remains usable; verified via a temporary throw in one screen during manual testing, then reverted.
- **Suggested Claude prompt:** "In `src/App.tsx`, wrap the `<Outlet>` (or child `<Routes>`) inside `AdminLayout` with an `ErrorBoundary fallbackTitle=\"Admin screen crashed\"`, using the same `ErrorBoundary` component and prop pattern already used for the `/admin/pricing` route at line ~323. Do not remove or change the existing app-root `ErrorBoundary` at line ~259 or the pricing-specific one. Do not touch any route path, role gate, or `isAdminExpressUser`."
- **Suggested human verification:** temporarily throw an error in one non-critical admin screen (e.g. `AdminAnnouncements.tsx`), confirm only that screen's area shows the crashed-fallback UI while the sidebar/nav still work, then revert the temporary throw.

---

## Do-Not-Touch List

- WhatsApp webhook (`whatsapp-webhook` edge function) — do not redeploy or modify from AI Studio or Central.
- `whatsapp-studio-inbox-bridge` — keep in manual/dry-run mode; do not enable scheduled polling.
- Bridge cursor state, backfill logic, and any cron/scheduling around the bridge.
- Sales order draft → live Sales Order promotion path (`whatsapp_sales_order_drafts` → live SO) — explicitly `NOT_BUILT` by design; do not build without a separate, explicit approval.
- Finance/dispatch/stock mutation paths (`dispatch_readiness_evidence` writes, `inventory_reservations` service writes, finance governance approvals, `production_jobs`/`daily_production_logs` writes) — read-only inspection only in this pass; any change requires the Quality Gates §3 higher gate.
- RLS policies and any Supabase migration/schema object.
- All secrets/credentials — no values were read, logged, or written during this audit.
- `isAdminExpressUser` and the admin-express bypass logic in `src/App.tsx`.
- Any existing registry file (`SCREEN_REGISTRY.md`, `FEATURE_REGISTRY.md`, etc.) — this audit only adds the new standalone file; registry edits are explicitly deferred to a future, separately-approved pass.
- Package/config/migration files, and running `npm install`, build, typecheck, tests, or Playwright.

---

## Final Recommendation

The single safest next implementation PR after this audit is **Batch 1 — Coming-soon print button cleanup**. It is UI-only, touches three files with six precisely-located, already-isolated `onClick` handlers, requires no backend/schema/auth change, cannot affect any protected flow (WhatsApp, finance, dispatch, stock), and directly closes a real, currently-shipping user-trust gap (buttons that look actionable but silently no-op). It is also the fastest to validate: open the three screens, click six buttons, confirm each renders a disabled state instead of a fake-progress toast.

---

## Files Changed By This Audit

Only `.ai-intent/PHASE1_ADMIN_CLOSEOUT_AUDIT_AND_BUILD_QUEUE.md` was created. No other file was modified. Nothing was committed or pushed.

---

## Post-Hygiene Status Alignment - 2026-07-07

Seven PRs have merged since this audit was written. This section closes out which findings above are resolved, so a future AI engine reading this file does not re-attempt already-completed work. The tables above are left as the original historical record and are **not** rewritten.

**Closed — do not re-open without new evidence:**

- **P0 #1** (Display Management embeds `AssemblyTV`/`DispatchTV` stub tabs as a dead end) — closed by PR #206 ("(Soon)" tab labels + working return links) and its Bugbot follow-up (return links corrected to point at `/admin/cmd-war-room` instead of back into the same stub-embedding screen).
- **P0 #2** (`VerificationWarRoom` registry mismatch / retired screen still fully rendered) — closed by PR #206 (Retired badge) and fully closed by PR #210 (`/admin/verification` is now a hard `<Navigate>` redirect, matching the existing legacy-redirect pattern).
- **P0 #3** (single global `ErrorBoundary`, no scoped admin coverage) — closed by PR #208 (scoped `AdminRouteBoundary` wrapping all `/admin` child routes) and its Bugbot follow-up (boundary now resets on navigation instead of sticking on `hasError`).
- **P1 #1-#3** (six dead-end "coming soon" print buttons in `AdminOrders.tsx`, `AdminAccountsRelease.tsx`, `OrderManagement.tsx`) — closed by PR #205.
- **P1 #4** (labeling only — `InventoryRiskBoard`/`InventoryCommandCenter` badges not disclosing static data) — labeling closed by PR #206; the underlying real-data-wiring work itself is **still open**, tracked in `PHASE1_REMAINING_BUILD_EXTRACTION.md`.
- Registry status for `InventoryCommandCenter`, `InventoryRiskBoard`, `ScanTimeline` — corrected from `BUILT_NEEDS_EVIDENCE` to `PARTIAL` directly in `SCREEN_REGISTRY.md` in this same alignment pass (was P1 #5 here).
- Legacy redirect for `/admin/verification` — same PR #210 fix noted under P0 #2.

**Still open — see `PHASE1_REMAINING_BUILD_EXTRACTION.md` for the live, actionable queue:**

- P1 #6 (mobile/responsive spot-check for `TargetVsActual.tsx`, `OrderManagement.tsx`).
- All "Screens That Need Real Build" items (real data wiring for `AssemblyTV`, `DispatchTV`, `InventoryRiskBoard`, `InventoryCommandCenter`, `ScanTimeline`).
- All P2 items (production nav duplication, `ThirdPartyStore`/`LabelCommandCenter` evidence, CartonExplorer nav grouping).
- E2E evidence capture for the 5-screen governance-board family.
- The genuinely `NOT_BUILT` phantom Central features (Gatekeeper, Billing, Payment Variances, Tickets, Reports) — net-new feature planning, not a hygiene fix.

No item in this section is marked `BUILT_VALIDATED` — these are hygiene/labeling/redirect closures, not functional-completeness proofs. The **Final Recommendation** above (Batch 1 — print button cleanup) is now done; the current recommended next PR lives in `PHASE1_REMAINING_BUILD_EXTRACTION.md`'s own "Recommended Next Implementation PR" section.
