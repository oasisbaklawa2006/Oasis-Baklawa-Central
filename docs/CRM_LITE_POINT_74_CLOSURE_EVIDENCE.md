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
| 7 | Roster → assist deep link | **Gap → fixed** | **Open assist** now switches to Assist tab + focuses client filter (was scroll-only) | **Fixed this hold** |
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
# Runtime auth-gate proof (CI preview smoke when app URL available):
npx playwright test tests/sales-dashboard-point74-smoke.spec.ts --project=desktop-chrome-size
```

---

## Runtime evidence prepared (no canonical base change)

| Artifact | Purpose | Auth required |
|---|---|---|
| `tests/sales-dashboard-point74-smoke.spec.ts` | CI/preview proof that `/sales/dashboard` enforces login gate | No |
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
- [ ] CI green on pushed head (await GitHub)
- [ ] Merge hold lifted (#448)
- [ ] Authenticated runtime capture (optional; env credentials)

**Agent #8 remains locked to Point 74. Does not claim Points 75–78.**
