# Point 64 — Customer Health / Risk / Next-Best-Action Census & Closure Evidence

**ASM:** POINT64 — customer health / risk / next-best-action canonical closure  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/point64-customer-health-risk-nba-49e9`  
**Base ancestry:** Point61 PR #507 head `0892c9b20043eadb1ee8626818e249d6c581bf8e`  
**Merge predecessor chain:** #497 Dispatch P0 → #499 Point57 → #503 Point59 → #507 Point61 → **Point64 (this PR, draft/dependent)**

---

## 1. Starting SHA / ancestry

| Item | Value |
|------|--------|
| **Starting SHA** | `0892c9b20043eadb1ee8626818e249d6c581bf8e` |
| **Starting commit** | `feat(point61): company-scoped CRM communication history read contract` |
| **Parent** | `60443018cd2303471ef034a399204f7cbb753947` (Point59 #503) |
| **Merge-base with `main`** | `64a107dfc167be76673a3d18f177a72472dcb241` |
| **Commits ahead of main at start** | 3 (Point57 + Point59 + Point61) |

---

## 2. Health / risk / next-action signal census (pre-Point64)

### Existing scoring engines & heuristics

| Surface | Module | Signals used | Company scope | Disposition |
|---------|--------|--------------|---------------|-------------|
| Execution Command Center | `executionRiskScoring.ts` | SLA breach, queue blocked, escalation, scan mismatch | Order/entity keyed | **Operational** — not Customer 360 |
| Customer risk lane | `customerRiskProjection.ts` | Filters execution risks by customerId | Order-linked | **CMD internal** — duplicate engine |
| Finance governance | `financeRiskScoring.ts` | Order value, exposure, complaint severity, holds | Order/finance context | **Finance lane** — not company CRM health |
| CMD queue pressure | `cmdQueuePressure.ts` | `customer_impact` order flag count | Global queue | **Dashboard heuristic** |
| Live feeds | `customerRiskQueueFeed.ts` | `orders.customer_impact` | Feed aggregate | **Derived** — not explainable CRM health |
| Golden chain | `deriveGoldenChainStage.ts` | Order pipeline stage CTA | Per order | **Order wizard** — not company health |
| WA operator desk | `caseDecisionDesk.ts` | Case `next_action` writes | Packet/case | **Point62 mutation** — separate lane |
| Sales CRM-lite | `SalesCrmLiteWorkspace.tsx` | Due follow-ups, task counts | AM roster | **Partial** — not canonical health |
| Customer 360 (Point59–61) | `customer360ReadModel.ts` | Profile, orders, tickets, comms, tasks | `companies.id` | **Authoritative inputs** — health slice blocked |

### Findings

| Risk | Evidence | Point64 treatment |
|------|----------|-------------------|
| Duplicate scoring engines | Execution + finance + CMD feeds score overlapping delay/exposure concepts | **Single** company-scoped projection bound to Customer 360 slices |
| Hardcoded / fabricated scores | Point59 blocked `customerHealth` with explicit unavailable | No invented sentiment, ageing, or ML repeat-order scores |
| Customer-facing leakage | Buyer App uses separate RPC projections | Staff-only `/admin/clients/:companyId` health panel |
| Signals without timestamps | CMD feeds lack per-company provenance | Each fact exposes `observedAt`, `sourceAuthority`, `freshness` |
| NBA implying unsupported workflows | WA desk writes `next_action` directly | Advisory actions map to Point62/63/59/77 capabilities or `unavailable` |
| Finance ageing guessed from outstanding | `companies.total_outstanding` alone | Exposure **partial**; ageing explicitly `unavailable` (Point77) |

### Authoritative signals consumed (Point64)

| Signal ID | Authority | Freshness | Used in risk |
|-----------|-----------|-----------|--------------|
| `credit_outstanding_balance` | `companies.total_outstanding` | Read-time | Yes — when credit disallowed |
| `credit_limit_utilization` | `companies.credit_limit` + outstanding | Read-time | Yes — ≥90% utilization |
| `open_support_tickets` | `support_tickets.status` | `created_at` | Yes |
| `communication_recency` | Point61 `client_interactions` ledger | `occurredAt` | Yes — stale ≥30d |
| `overdue_crm_tasks` | `crm_tasks.due_date` + status | due date | Yes |
| `stuck_order_fulfilment` | `orders.status` hold states | `created_at` | Yes |

### Explicit unavailable signals (not guessed)

| Signal ID | Programme owner | Reason |
|-----------|-----------------|--------|
| `finance_ageing_exposure` | POINT77 | Ageing buckets / consolidated exposure not governed |
| `customer_sentiment` | POINT64_ML | No unified NPS; ticket ratings not promoted |
| `repeat_order_expectation` | POINT64_ML | Predictive authority not available |
| `sales_trajectory` | POINT64_ANALYTICS | Growth/decline analytics lane not available |

---

## 3. Programme separation

| Point | Scope | Point64 treatment |
|-------|-------|-------------------|
| **64** | Health / risk / NBA read projection | **Implemented** — `customer-health` module + Customer 360 slice |
| **62** | Action capture writes | **Not absorbed** — NBA maps to `POINT62_*` advisory only |
| **63** | CRM tasks | **Not absorbed** — NBA maps to `POINT63_create_task` advisory only |
| **77–81** | Finance exposure | Partial outstanding only; ageing remains unavailable |
| **ML / predictive** | Future lane | Explicit unavailable — no model deployment |

---

## 4. Point64 implementation

### Canonical read contract

- **Module:** `src/lib/customer-health/`
- **Binding:** `fetchCustomer360ReadModel` → `customerHealth` slice
- **Identity:** inherits Point59 `normalizeCompanyId()` + fail-closed upstream errors
- **Categories:** `healthy` | `watch` | `at_risk` | `critical` | `indeterminate`
- **Confidence:** reduced proportionally to unavailable signal census (never 100% while ML/finance ageing absent)

### Wiring

- `Customer360Page` renders explainable risk dimensions, signal facts, unavailable inputs, and advisory NBA list
- No production mutation, protected WA corpus access, or model deployment

### Tests

- `src/lib/customer-health/__tests__/customerHealthProjection.test.ts`
- `src/lib/customer-health/__tests__/customerHealthSignals.test.ts`
- `src/lib/customer-health/__tests__/customerHealthNextAction.test.ts`
- `src/lib/customer-360/__tests__/customer360ReadModel.test.ts` (health slice binding)

---

## 5. Gate state

| Gate | State |
|------|-------|
| Health/risk/NBA authority census | **YES** (this document) |
| Company-scoped explainable projection | **YES** |
| Advisory-only NBA with capability mapping | **YES** |
| Deterministic tests (signals, missing data, isolation, NBA) | **YES** |
| Point61 #507 merged | **NO** — PR remains dependent/draft |
| Runtime Customer 360 certification | **NOT_CLEARED** — requires predecessor merge + live evidence |
| Point64 programme CLEARED | **NOT_CLEARED** |

`PR MERGED != Point64 cleared`
