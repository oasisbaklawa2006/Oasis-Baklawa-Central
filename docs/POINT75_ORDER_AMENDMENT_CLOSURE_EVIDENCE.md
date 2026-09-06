# Point 75 closure matrix — order amendment / cancellation / substitution

**ASM:** POINT75 (immutable #459)  
**Repository:** Oasis-Baklawa-Central  
**Central main SHA:** `64a107dfc167be76673a3d18f177a72472dcb241`  
**Gate state:** Software boundary at PR head — **not** stage CLEARED until Core RPC family is deployed and authenticated order-runtime evidence is certified.

---

## FIRST RETURN (census)

### 1. Exact Central main SHA

`64a107dfc167be76673a3d18f177a72472dcb241`

### 2. Amendment / cancel / substitute surface census

| Surface | Path | Role | Current behaviour | Point 75 posture |
|---|---|---|---|---|
| Order Trace governed panel | `OrderAmendmentActionsPanel` → `OrderTraceSheet` | Ops / admin | **New** — routes amend/cancel/substitute through Core RPC client only | **Owned** |
| Order authority client | `orderAmendmentAuthorityClient.ts` | Central service | Fail-closed Core RPC boundary with version/actor/reason/idempotency | **Owned** |
| Order Management | `OrderManagement.tsx` | Ops pipeline | Status transitions via governed release RPCs only; no cancel/amend UI | Unchanged — no shadow writes |
| Admin Orders | `AdminOrders.tsx` | Legacy pipeline | `cancelled` is terminal display only; pipeline advance blocks dispatch | No silent cancellation |
| Admin Operations | `AdminOperations.tsx` | Production | **Cross-scope defect:** direct `order_items` quantity/update (production mutation) | **Evidence only** — not Point 75 fix; return to Mission Control |
| Admin Finance | `AdminFinance.tsx` | Finance | **Cross-scope defect:** direct `orders.payment_status` update | **Evidence only** |
| War Room / WhatsApp | intent labels `ORDER_CANCELLATION` | Intake | Classification only — no live order cancel RPC from Central | Out of scope |
| Buyer App | customer projections | Customer | Read-only status; no amend/cancel mutation | Out of scope (Buyer repo) |
| CRM-lite Point 74 | sales assist | Sales | Explicitly excludes P75–78 mutation | Collateral only |

### 3. Core RPC / table census (Central `database.types.ts`)

| Contract | Present at main SHA? |
|---|---|
| `get_order_amendment_facts_v1` | **ABSENT** |
| `request_order_amendment_v1` | **ABSENT** |
| `request_order_cancellation_v1` | **ABSENT** |
| `request_order_substitution_v1` | **ABSENT** |
| `order_status_history` (read) | Present (audit read model — not mutation authority) |
| `sales_order_commercial_versions` (via PI binding reads) | Partial — payment/clearance facts only |

### 4. Allowed order states (Central advisory pre-check; Core is final authority)

| Action | Allowed (pre-dispatch) | Blocked |
|---|---|---|
| Amendment | `submitted` → `cleared_for_dispatch` | `dispatched`, terminal states |
| Cancellation | `submitted` → `cleared_for_dispatch` | `dispatched`, terminal states |
| Substitution | `submitted` → `packing` | `packed_ready+`, `dispatched`, terminal |

### 5. Commercial-version handling

- All governed requests require `commercialVersionId` + `expectedOrderStatus` (stale-version fail-closed at Core).
- Amendment/substitution must create new commercial version — no silent overwrite (governance freeze Point 12).

### 6. Payment / finance implications

- Facts RPC must expose `finance_status` and downstream blockers.
- Material amendments may require finance revalidation (Core-owned).
- Central does not adjust `payment_status`, `advance_paid`, or PI rows directly.

### 7. Production / packing / dispatch cutoffs

- Facts RPC exposes `production_cutoff_reached`, `packing_cutoff_reached`, `dispatch_cutoff_reached`.
- Central eligibility blocks substitution after packing; Core enforces compensating actions post-reservation.

### 8. Actor / reason / audit

- Every request requires authenticated `actorId`, non-empty `reason`, `evidenceReference`, `correlationId`, `idempotencyKey`.
- Cancellation governance matrix (`approvalMatrix.ts`) requires CMD dual control — enforced at Core/UI gate when RPC exists.

### 9. Risk register (must not occur)

| Risk | Central guard |
|---|---|
| Direct `orders` / `order_items` update for amend/cancel/substitute | Authority client + surface tests forbid in P75 surfaces |
| Silent cancellation | No status shortcut in Order Management; Core RPC only |
| Substitution without product/customer approval | `customerApprovalReference` field on substitution RPC contract |
| Edits after irreversible execution | Eligibility blocks `dispatched+`; Core blockers for stale version |
| Stale-version overwrite | `expectedOrderStatus` + `commercialVersionId` required on every mutation |
| Payment mismatch / history erasure | No direct finance column writes in P75 boundary |

### 10. Separation from adjacent points

| Point | Scope | P75 relationship |
|---|---|---|
| **Point 76** partial/split fulfilment | Separate fulfilment identities | **Not claimed** — no split-order logic in this PR |
| **Points 77–81** finance consolidation | Finance authority | Facts consumption only; no finance mutation |
| **Point 74** CRM-lite | Sales assist | Collateral; not expanded |

---

## Core prerequisite (exact)

**BLOCKED** until `oasis-supabase-core` deploys and types:

1. `get_order_amendment_facts_v1(p_order_id)`
2. `request_order_amendment_v1(...)` — version-checked line amendments + immutable audit
3. `request_order_cancellation_v1(...)` — compensating cancellation + reason
4. `request_order_substitution_v1(...)` — approved replacement identity + optional customer approval ref

Central fails closed with `POINT75_CORE_PREREQUISITE` when PostgREST reports RPC absence (`PGRST202`).

---

## Closure matrix (Point 75 only)

| # | Requirement | Status | Evidence |
|---:|---|---|---|
| 1 | Census published | **Complete** | This document |
| 2 | Single Central action boundary | **Complete** | `orderAmendmentAuthorityClient.ts` |
| 3 | Core-only mutation (no shadow edits) | **Complete at boundary** | Client + panel + surface guard tests |
| 4 | Version/state/actor/reason/idempotency | **Complete** | Client contract + tests |
| 5 | Fail closed when Core RPC absent | **Complete** | `PGRST202` handling + prerequisite string |
| 6 | Deterministic lifecycle tests | **Complete** | `orderAmendmentEligibility.test.ts`, client tests |
| 7 | Operator surface (Order Trace) | **Complete** | `OrderAmendmentActionsPanel` |
| 8 | Authenticated order runtime proof | **BLOCKED** | Core RPC family absent |
| 9 | Programme clearance | **NOT CLEARED** | `PR merged != Point75 cleared` |

**Point 75 bounded verdict:** **software-complete at Central boundary** pending Core prerequisite merge/deploy and authenticated runtime certification.

---

## Test evidence

```bash
npm run typecheck
npm run test -- src/lib/order-authority/__tests__/orderAmendmentAuthorityClient.test.ts
npm run test -- src/lib/order-authority/__tests__/orderAmendmentEligibility.test.ts
npm run test -- src/lib/order-authority/__tests__/point75OrderAmendmentClosure.test.ts
npm run build
```

---

## Cross-scope defects (evidence only — Mission Control reassignment)

1. `AdminOperations.tsx` — direct `order_items` quantity/production mutation (production shadow edit).
2. `AdminFinance.tsx` — direct `orders.payment_status` update (finance shadow edit).

No fix applied in Point 75 scope.
