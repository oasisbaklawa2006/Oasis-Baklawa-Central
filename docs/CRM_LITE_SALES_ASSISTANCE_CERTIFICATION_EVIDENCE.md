# CRM-lite sales assistance — certification evidence (non-numbered)

**Workstation:** Agent #8 evidence workstation (CRM-lite sales assistance only)  
**Carrier:** #449 merged to `main` (implementation); this PR (#455) is **certification evidence only**  
**Main SHA (evidence run):** `d29feabda0e48e52e8d2c9cc71244702270f4188`  
**PR posture:** **Draft / HOLD** — evidence preservation only; **not** a programme-point strike  
**Gate state:** Certification evidence at merged main — **not** stage CLEARED

---

## Numbering correction (#459)

Under immutable Central **#459**, **original Point 74** is **priority / owner / SLA** — not CRM-lite sales assistance.

| Topic | Route |
|---|---|
| CRM-lite sales assistance (this workstation) | Non-numbered certification evidence in this PR; Lane E implementation already on `main` via #449 |
| Original Point 74 (priority / owner / SLA) | **#459 ledger** — not claimed or closed here |
| Lane E parallel numbering (#437 E74–E78) | Historical Lane E scope label only; does **not** override #459 original Point 74 |

This document **does not** strike, merge, or close original Point 74.

---

## Certification matrix (CRM-lite sales assistance behaviour)

| Criterion | Software status at merged main | Evidence |
|---|---|---|
| Executive-scoped interaction reads | Implemented | `SalesCrmAssistPanel` → `scopeExecutiveId={userId}` → `ClientInteractionsTab` `.eq("executive_id", …)` |
| Assist tab activation from roster | Implemented | `Open assist` → `assistFocusCompanyId` → `setActiveTab("assist")` |
| Correct client preselection | Implemented | `setLogCompany(c.id)` + `initialFilterCompanyId` + **Assisting:** banner |
| Governed write/read boundary | Implemented | `client_interactions` + `account_manager_id` roster filter |
| Fail-closed route gate | Implemented | `ProtectedRoute` + `RoleProtectedRoute`; unauthenticated smoke redirects to `/login` |

**Bounded verdict:** CRM-lite sales-assistance **software certification-ready** at merged main. **Authenticated live-session capture** still blocked (see below). This is **not** original Point 74 clearance.

---

## Exact-head validation

```bash
npm run typecheck
npm run test -- src/lib/crm-lite/__tests__/salesCrmAssistCertification.test.ts
npm run test -- src/components/sales/__tests__/SalesCrmAssistCertificationRuntime.test.tsx
npm run build
APP_URL=http://127.0.0.1:4173 npx playwright test tests/sales-dashboard-point74-smoke.spec.ts --project=desktop-chrome-size
TEST_PREVIEW_URL=http://127.0.0.1:4173 npx playwright test tests/sales-dashboard-point74-assist.spec.ts --project=desktop-chrome-size
```

| Suite | Result |
|---|---|
| `salesCrmAssistCertification.test.ts` | contract assertions on assist wiring |
| `salesCrmAssistCertificationRuntime.test.tsx` | mocked Supabase runtime proofs |
| `sales-dashboard-point74-smoke.spec.ts` | auth gate (legacy filename; Lane E scope) |
| `sales-dashboard-point74-assist.spec.ts` | **skipped** without `TEST_SALES_EMAIL` / `TEST_SALES_PASSWORD` |

---

## Remaining certification gate (not original Point 74)

| Gate | Owner | Notes |
|---|---|---|
| Authenticated assist runtime capture | CI / ops secrets | `TEST_SALES_EMAIL`, `TEST_SALES_PASSWORD`, `TEST_PREVIEW_URL` |
| Original Point 74 (priority / owner / SLA) | **#459 ledger** | Out of scope for this workstation |

**Protected environment references (values not disclosed):** `TEST_SALES_EMAIL`, `TEST_SALES_PASSWORD`, `TEST_PREVIEW_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## Scope lock

- **In scope:** CRM-lite sales-assistance certification evidence only  
- **Out of scope:** original Point 74 (#459), Points 75–78 strike claims, full Customer 360, Core migrations, new lanes
