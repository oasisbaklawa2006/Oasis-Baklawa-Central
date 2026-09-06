# Point 59 — Customer 360 Authority Census & Closure Evidence

**ASM:** POINT59 — Customer 360 canonical operational view closure  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/point59-customer-360-7654`  
**Base ancestry:** Point57 PR #499 head `6ffaa43babeed060ec9ccdcc567f8bff45347b94`  
**Merge predecessor chain:** #497 Dispatch P0 → #499 Point57 → **Point59 (this PR, draft/dependent)**

---

## 1. Starting SHA / ancestry

| Item | Value |
|------|--------|
| **Starting SHA** | `6ffaa43babeed060ec9ccdcc567f8bff45347b94` |
| **Starting commit** | `feat(point57): Central module authority matrix and audit closure` |
| **Merge-base with `main`** | `64a107dfc167be76673a3d18f177a72472dcb241` |
| **Commits ahead of main at start** | 1 (Point57 only) |

---

## 2. Customer 360 authority census (pre-Point59)

### Routes & surfaces

| Route | Component | Module | Disposition | Identity key |
|-------|-----------|--------|-------------|--------------|
| `/admin/clients` | `AdminClients` | `clients` | Governance + directory | `companies.id` |
| `/admin/approvals` | `AdminClients` | `clients` | Alias | same |
| `/admin/customers`, `/admin/crm` | redirect | `clients` | Alias | same |
| `/admin/sales-hub` | `SalesPerformanceHub` | `cmd_war_room` | Specialist | `company_id` |
| `/sales/dashboard` | `SalesDashboard` + CRM-lite | — | Sales console | AM-scoped `company_id` |
| `/admin/customer-timeline-preview` | `CustomerTimelinePreview` | `cmd_war_room` | **Preview** (Point58) | `order_id` |
| `/admin/operator-inbox` | WA resolution | `support` | Channel identity | scored `company_id` |
| `/buyer/*` | Buyer legacy shell | — | **Buyer App scope** | RPC `customer_*_v1` |

**Gap before Point59:** no single canonical Customer 360 operational route; fragmented reads across AdminClients, sales consoles, previews, and search deep-links (`?customerId=` unresolved).

### Data adapters & Core authority

| Domain | Authority | Central adapter | Customer-safe boundary |
|--------|-----------|-----------------|------------------------|
| Company master | `companies` | direct table | N/A (staff) |
| Buyer profile | `customer_company_v1` RPC | `customerAppClient.ts` | Buyer App |
| Orders | `orders.company_id` | per-surface selects | `customer_order_status_v1` |
| Wallet/credit | PF-6B RPCs + `companies.*` | `creditWalletAuthorityClient.ts` | buyer finance RPCs |
| Interactions | `client_interactions` | CRM-lite tabs | not unified (P61) |
| Tasks | `crm_tasks` | CRM-lite workspace | not unified (P63) |
| Tickets | `support_tickets` → `orders` join | CRM-lite parse | `customer_support_tickets_v1` |
| Timeline engine | `operational_events` | preview hook only | `customer-timeline` + `customer-safe` libs |
| Dispatch history | order-scoped views | none aggregated | internal only |
| Branches/contacts | **missing schema** | none | Point 60 |

### Fragmentation / demo findings

- Duplicate timeline libraries (`customer-timeline` vs `customer-safe`)
- Parallel shadow identity (`companies.status='shadow'` vs `shadow_clients`)
- Operational search linked to broken `?customerId=` deep link
- Portal invite demo bypass (`app.id.startsWith("d")`) in AdminClients
- `operational_events` used in code but absent from `database.types.ts`

---

## 3. Programme separation

| Point | Scope | Point59 treatment |
|-------|-------|-------------------|
| **59** | Canonical Customer 360 read shell | **Implemented** — `/admin/clients/:companyId` |
| **60** | Branch/contact hierarchy | Explicit `unavailable_not_governed` |
| **61–64** | CRM comms/tasks/health | Partial CRM-lite + explicit unavailable slices |
| **77–81** | Finance exposure/ageing | Profile balances only; exposure slice blocked |
| **Buyer App** | Customer-safe storefront | Out of scope; legacy `/buyer/*` untouched |
| **58** | Preview/demo quarantine | `customer-timeline-preview` left untouched |

---

## 4. Point59 implementation

### Canonical read model

- **Route:** `/admin/clients/:companyId` → `Customer360Page`
- **Binding:** `src/lib/customer-360/customer360ReadModel.ts`
- **Identity:** `companies.id` via `normalizeCompanyId()` — fail closed on invalid UUID, missing company, ambiguous buyer identity, or cross-company storefront access
- **Authoritative slices:** company profile, recent orders, order-linked tickets
- **Partial slices:** CRM-lite interactions/tasks (labelled, not promoted to canonical ledger)
- **Blocked slices:** branches/contacts (P60), comms ledger (P61), dispatch aggregate (#456), finance exposure (P77–81), customer health (P64)

### Wiring

- AdminClients directory → **Customer 360** link + `?customerId=` redirect to canonical route
- Operational search customer entities → `/admin/clients/:companyId`
- Authority matrix entry added for `/admin/clients/:companyId`

### Tests

- `src/lib/customer-360/__tests__/customer360Identity.test.ts`
- `src/lib/customer-360/__tests__/customer360ReadModel.test.ts`
- `src/lib/customer-360/__tests__/customer360RouteAccess.test.ts`

---

## 5. Gate state

| Gate | State |
|------|-------|
| Customer 360 authority census | **YES** (this document) |
| Canonical read route + binding | **YES** |
| Fail-closed identity boundary tests | **YES** |
| Point57 #499 merged | **NO** — PR remains dependent/draft |
| Point59 programme CLEARED | **NOT_CLEARED** — requires #497 → #499 merge, rebase, CI/runtime reconciliation |

`PR MERGED != Point59 cleared`
