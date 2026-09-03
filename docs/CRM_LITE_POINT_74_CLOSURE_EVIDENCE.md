# Point 74 closure matrix — CRM-lite sales assistance

**Workstation:** Agent #8 (exclusive Point 74 owner)  
**PR:** #449 (`cursor/crm-lite-lane-e-closure-1970`) — legacy bundled carrier  
**Issue:** master #437  
**Merge posture:** **HOLD behind #448** — no rebase/merge until Agent #2 / #450 clears canonical order  
**Gate state:** Software evidence at PR head — **not** stage CLEARED

---

## Closure matrix (Point 74 only)

| # | Requirement | Classification | Evidence | Agent #8 status |
|---:|---|---|---|---|
| 1 | Sales exec landing route | **Complete** | `auth-routing.ts` → `/sales/dashboard`; `App.tsx` `RoleProtectedRoute` | Verified + contract test |
| 2 | Role admission gate | **Complete** | `SALES_DASHBOARD_ROLES = ADMIN + SALES_EXECUTIVE`; server role verify in `RoleProtectedRoute` | Verified + contract test |
| 3 | Assigned-roster query | **Complete** | `SalesDashboard` filters `companies.account_manager_id = user.id` | Implemented |
| 4 | Unified assist surface | **Complete** | `SalesCrmAssistPanel` (`data-point="74"`) on Assist tab | Implemented |
| 5 | Interaction timeline CRUD | **Complete** | `ClientInteractionsTab` + header Log Call/Message modals → `client_interactions` | Implemented |
| 6 | Executive-scoped reads | **Gap → fixed** | Assist panel now passes `scopeExecutiveId` (was showing all exec interactions on roster companies) | **Fixed this hold** |
| 7 | Roster → assist deep link | **Gap → fixed** | **Open assist** switches Assist tab, focuses filter, pre-selects header log client | **Fixed this hold** |
| 8 | WA outbound auto-log | **Complete (Core)** | `send-whatsapp` edge writes `client_interactions` when `company_id` present | Evidence-only; no Central change |
| 9 | Admin sales hub parity | **Complete (collateral)** | `/admin/sales-hub` retains admin-wide interaction view without exec scope | Not P74 claim |
| 10 | Full Customer 360 | **Upstream / out of scope** | Register P59–64 | Not Agent #8 |

**Point 74 bounded verdict:** **software-complete at PR head** pending CI re-run and merge hold lift.

---

## Role / route authority

| Surface | Route | Allowed roles | Default landing | Module key |
|---|---|---|---|---|
| Sales Executive Console | `/sales/dashboard` | `SUPER_ADMIN`, `ADMIN`, `SALES_EXECUTIVE` | `SALES_EXECUTIVE` → `/sales/dashboard` | `clients` (admin nav link) |
| Admin sales hub (not P74) | `/admin/sales-hub` | Admin staff module set | Admin CMD | `clients` |

Contract tests: `salesDashboardRouteAuthority.test.ts`, `auth-routing.test.ts` (existing SALES_EXECUTIVE path check).

---

## Genuine defects found during hold (fixed on branch)

| Defect | Impact | Fix | Points touched |
|---|---|---|---|
| **D74-1** Assist timeline read not scoped to `executive_id` | Sales exec could see other executives' interactions on shared roster companies | `ClientInteractionsTab.scopeExecutiveId`; set from `SalesCrmAssistPanel` | **P74 only** |
| **D74-2** **Open assist** did not activate Assist tab | Deep-link scrolled to workspace but left user on collateral tab if previously selected | Controlled `activeTab` in workspace; switches to `assist` on focus | **P74 wiring only** (no P75–78 logic change) |
| **D74-3** **Open assist** did not pre-select header log client | Quick Log Call/Message modal still required manual client pick after roster deep-link | `setLogCompany(c.id)` on **Open assist** | **P74 only** |

**Not defects (documented boundaries):**

- Authenticated assist screenshot requires sales-exec test credentials (environment gap, not code)
- Vercel preview rate-limited on free tier (deployment gap, not code)
- Collateral tabs P75–78 remain in bundled PR; other workstations own closure claims

---

## Test evidence (exact-head)

```bash
npm run typecheck
npm run test -- src/lib/crm-lite/__tests__/salesCrmAssistPoint74.test.ts
npm run test -- src/lib/crm-lite/__tests__/salesDashboardRouteAuthority.test.ts
npm run test -- src/lib/crm-lite/__tests__/
npm run build
# Runtime auth-gate proof (no credentials):
npx playwright test tests/sales-dashboard-point74-smoke.spec.ts --project=desktop-chrome-size
# Authenticated readiness proof (requires TEST_SALES_EMAIL / TEST_SALES_PASSWORD):
npx playwright test tests/sales-dashboard-point74-assist.spec.ts --project=desktop-chrome-size
```

---

## Dependency census (Point 74)

| Dependency | Owner | Required for P74? | State at hold | Agent #8 action |
|---|---|---|---|---|
| `client_interactions` table + RLS | Core | Yes | Merged authority | Consume only |
| `companies.account_manager_id` roster scope | Core | Yes | Merged authority | Consume only |
| WA outbound auto-log (`send-whatsapp` → timeline) | Core edge | No (enhancement) | Merged | Evidence-only |
| PF-6B credit/wallet RPCs | Core | **No** (P76 collateral) | Merged | Not claimed |
| `crm_tasks` / `support_tickets` | Core | **No** (P75–78 collateral) | Merged | Not claimed |
| Canonical merge gate **#448** | Mission Control | Yes (merge) | **Open — HOLD** | Wait for Agent #2 |
| Rebase coordination **#450** | Agent #2 | Yes (merge train) | Pending | No rebase ahead |
| `TEST_SALES_EMAIL` / `TEST_SALES_PASSWORD` | CI secrets | No (code) / Yes (authenticated proof) | Not in agent env | Spec prepared; skips if unset |
| Full Customer 360 (P59–64) | Future CRM lane | No | Not started | Out of scope |

---

## Strikeability register — what remains for Point 74 to close

| # | Remaining gate | Owner | Strikeable now? | Notes |
|---:|---|---|---|---|
| 1 | Exact-head CI green (`15ad90a1+`) | GitHub Actions | **In progress** | Prior run green on `f4501642`; re-run on latest commit pending |
| 2 | Merge hold **#448** | Mission Control / Agent #2 | **No** | Agent #8 must not merge/rebase ahead |
| 3 | Authenticated assist runtime capture | CI / ops secrets | **Partial** | `sales-dashboard-point74-assist.spec.ts` ready; skips without `TEST_SALES_*` |
| 4 | Draft PR → ready for review | Agent #2 / maintainer | **No (Agent #8)** | Wait until #448 hold lifts |
| 5 | #437 Point 74 sign-off | Mission Control | **No** | Requires merge + programme gate, not code alone |
| 6 | Stage clearance | Mission Control | **No** | `PR MERGED ≠ STAGE CLEARED` |

**Agent #8 bounded software verdict:** Point 74 is **strike-ready at code/evidence level** once CI re-confirms green on latest head. Programme strike (#437 closure) still blocked by **#448** and authenticated proof secret provisioning.

---

## Runtime evidence prepared (no canonical base change)

| Artifact | Purpose | Auth required |
|---|---|---|
| `tests/sales-dashboard-point74-smoke.spec.ts` | CI/preview proof that `/sales/dashboard` enforces login gate | No |
| `tests/sales-dashboard-point74-assist.spec.ts` | Authenticated assist panel + Open assist proof (skips without secrets) | Yes (`TEST_SALES_*`) |
| `point74_sales_console_login_page.png` | Preview route loads app shell | No |
| `point74_sales_dashboard_route_loads.mp4` | Recording of route load attempt | No |
| Authenticated Assist tab screenshot | Full P74 UI proof | Yes (`TEST_SALES_*` — not in agent env) |

---

## Merge coordination

| Item | Owner | State |
|---|---|---|
| Canonical base / rebase | Agent #2 / #450 | Pending |
| Merge gate | #448 | **HOLD** |
| Point 74 code | Agent #8 | Ready at branch head after this commit |
| Points 75–78 | Other workstations | Unclaimed by Agent #8 |

---

## Stop condition checklist

- [x] Point-74-only closure matrix published
- [x] Focused assist contract tests
- [x] Role/route authority checks
- [x] Genuine P74 defects fixed pre-#450 advance
- [x] Runtime evidence spec prepared (auth-gate smoke)
- [x] Authenticated readiness spec prepared (`sales-dashboard-point74-assist.spec.ts`)
- [x] Dependency census published
- [x] Strikeability register published
- [x] CI green on pushed head (`71d5919e` — Release Quality Gate success)
- [ ] Merge hold lifted (#448)
- [ ] Authenticated runtime capture (optional; env credentials)

**Agent #8 remains locked to Point 74. Does not claim Points 75–78.**
