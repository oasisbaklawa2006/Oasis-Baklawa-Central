# Point 74 closure matrix — CRM-lite sales assistance

**Workstation:** Agent #8 (exclusive Point 74 owner)  
**Carrier:** #449 merged to `main`  
**Issue:** master #437  
**Main SHA (evidence run):** `d29feabda0e48e52e8d2c9cc71244702270f4188`  
**Gate state:** Software complete at merged main — **authenticated live-session proof blocked** — **not** stage CLEARED (`PR MERGED ≠ STAGE CLEARED`)

---

## Reconciliation verdict (post-#449 merge)

| #437 closure criterion | Classification | Merged-main evidence |
|---|---|---|
| Executive-scoped interaction reads | **Complete** | `SalesCrmAssistPanel` passes `scopeExecutiveId={userId}` → `ClientInteractionsTab` adds `.eq("executive_id", scopeExecutiveId)` on fetch |
| Assist tab activation from roster | **Complete** | `SalesDashboard` **Open assist** sets `assistFocusCompanyId`; `SalesCrmLiteWorkspace` `useEffect` calls `setActiveTab("assist")` |
| Correct client preselection | **Complete** | **Open assist** sets `setLogCompany(c.id)` (header Log Call/Message modal) + `initialFilterCompanyId` / **Assisting:** banner in assist panel |
| Governed write/read boundary | **Complete** | Reads/writes target `client_interactions`; roster filtered `companies.account_manager_id = user.id`; inserts set `executive_id` |
| Fail-closed role behavior | **Complete (route gate)** | `/sales/dashboard` behind `ProtectedRoute` + `RoleProtectedRoute allowedRoles={SALES_DASHBOARD_ROLES}`; unauthenticated users redirected to `/login` (Playwright smoke) |

**Point 74 bounded verdict:** **Software strike-ready at merged main.** Programme strike blocked on **authenticated live-session proof** (see blocker below).

---

## Exact-head validation (Agent #8 run on `d29feabd`)

```bash
npm run typecheck
npm run test -- src/lib/crm-lite/__tests__/
npm run test -- src/components/sales/__tests__/SalesCrmAssistPoint74Runtime.test.tsx
npm run build
# Unauthenticated auth-gate (requires preview build with VITE_SUPABASE_* at build time):
APP_URL=http://127.0.0.1:4173 npx playwright test tests/sales-dashboard-point74-smoke.spec.ts --project=desktop-chrome-size
# Authenticated assist path (requires CI secrets — skips when unset):
TEST_PREVIEW_URL=http://127.0.0.1:4173 npx playwright test tests/sales-dashboard-point74-assist.spec.ts --project=desktop-chrome-size
```

| Suite | Result |
|---|---|
| `salesCrmAssistPoint74.test.ts` | 7/7 pass |
| `salesDashboardRouteAuthority.test.ts` | 4/4 pass |
| `salesCrmAssistPoint74Runtime.test.tsx` | 4/4 pass (mocked Supabase runtime proofs) |
| `sales-dashboard-point74-smoke.spec.ts` | 1/1 pass (auth gate; no assist panel leak) |
| `sales-dashboard-point74-assist.spec.ts` | **skipped** — `TEST_SALES_EMAIL` / `TEST_SALES_PASSWORD` not provisioned in agent env |

---

## Strikeability register — what remains for Point 74 to close

| # | Remaining gate | Owner | Strikeable now? | Notes |
|---:|---|---|---|---|
| 1 | Authenticated assist runtime capture | CI / ops secrets | **No** | Blocker: `TEST_SALES_EMAIL`, `TEST_SALES_PASSWORD` (and `TEST_PREVIEW_URL` for CI Playwright) |
| 2 | #437 Point 74 sign-off | Mission Control | **No** | Requires authenticated proof + programme gate |
| 3 | Stage clearance | Mission Control | **No** | `PR MERGED ≠ STAGE CLEARED` |

---

## Precise blocker (path B)

**Protected environment references (values not disclosed):**

1. **`TEST_SALES_EMAIL`** — sales-executive QA identity for authenticated assist console proof  
2. **`TEST_SALES_PASSWORD`** — matching credential  
3. **`TEST_PREVIEW_URL`** — allowlisted preview host for Playwright assist spec (or CI `APP_URL` on deployed preview)  
4. **`VITE_SUPABASE_URL`** / **`VITE_SUPABASE_PUBLISHABLE_KEY`** — required at **build** time for non-blank preview shell (publishable keys only; not a strike blocker once preview is built in CI)

No Point-74 software deficiency identified at merged main. No corrective Central code change required beyond runtime evidence tests added in this reconciliation pass.

---

## Agent #8 scope lock

- **Claims:** Point 74 only  
- **Does not claim:** Points 75–78  
- **Out of scope:** full Customer 360 (register P59–64), commission payout mutation, Core migrations
