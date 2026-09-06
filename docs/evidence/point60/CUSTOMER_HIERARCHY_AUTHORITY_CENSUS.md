# Point 60 — Customer Company / Branch / Buyer Hierarchy Authority Census

**ASM:** POINT60 — customer company / branch / buyer hierarchy reconciliation  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/point60-hierarchy-reconciliation-31b5`  
**Base ancestry:** Point59 PR #503 head `60443018cd2303471ef034a399204f7cbb753947`  
**Merge predecessor chain:** #497 → #499 → #503 → **Point60 (this PR, draft/dependent)**

---

## 1. Starting SHA / ancestry

| Item | Value |
|------|--------|
| **Starting SHA** | `60443018cd2303471ef034a399204f7cbb753947` |
| **Starting commit** | `feat(point59): canonical Customer 360 operational read model` |
| **Parent** | `6ffaa43b` — Point57 module authority matrix |
| **Merge-base with `main`** | `64a107dfc167be76673a3d18f177a72472dcb241` |
| **Commits ahead of main at start** | 2 (Point57 + Point59) |

---

## 2. Identity model census (Central-consumed)

### 2.1 Commercial customer company (`public.companies`)

| Field | Central usage |
|-------|----------------|
| **Primary key** | `companies.id` — canonical Customer 360 / CRM / order / finance identity |
| **Surfaces** | `AdminClients`, `Customer360Page`, `SalesDashboard`, WA client resolution, finance, dispatch |
| **Ownership fields** | `account_manager_id` → `users.id` (sales AM, not org hierarchy) |
| **Lifecycle** | `status` includes `active`, `shadow`, frozen via `is_frozen` |
| **Tax/phone** | `gst_number`, `phone` — attributes only; used for WA scoring, **not** hierarchy keys |

**Central adapter:** direct PostgREST on `companies`; `customer_company_v1` RPC (Buyer-safe read).

### 2.2 Org hierarchy authority (`org_companies`, `org_branches`, `org_contacts`, memberships)

| Entity | In Central `database.types.ts` | Central adapter | Disposition |
|--------|----------------------------------|-----------------|-------------|
| `org_companies` | **NO** | none | Core-owned (Point 17 / Core#206 evidence) |
| `org_branches` | **NO** | none | Core-owned |
| `org_contacts` | **NO** | none | Core-owned |
| `org_memberships` / scope | **NO** | none | Core-owned |

**Finding:** Central has **zero** typed or runtime consumption of org hierarchy tables. They are not interchangeable with `public.companies` without a proven mapping contract.

### 2.3 Buyer / auth user identities

| Entity | Key | Link to company | Central surfaces |
|--------|-----|-----------------|------------------|
| `users` | `users.id` | `users.company_id` → `companies.id` | Auth, AdminUsers, WA resolution, AM roster |
| `profiles` | `profiles.id` (= auth uid) | `profiles.company_id` → `companies.id` | Auth flow, AdminUsers |
| Buyer team RPC | `customer_team_v1` | scoped to session company | `customerAppClient.ts` (Buyer App boundary) |

**Buyer/contact model today:** flat `users`/`profiles` rows with optional `company_id`. No branch scope, no org contact linkage, no membership table in Central types.

### 2.4 Staging / intake / shadow identities

| Entity | Purpose | Promotion link | Unsafe inference risk |
|--------|---------|----------------|----------------------|
| `shadow_clients` | WA lead staging | `promoted_to_company_id` → `companies.id` | phone/name/GST scoring in WA resolution |
| `companies.status='shadow'` | parallel shadow company | same phone path as shadow_clients | dual-model drift (documented) |
| `b2b_applications` | trade onboarding intake | approval → `companies` via `approve_b2b_trade_application_v1` | contact fields are application attributes only |
| `customer_import_*` | workbook staging (SQL scripts) | **explicitly does not promote** | GST/phone/name duplicate views in `scripts/sql/` — **not in Central types** |
| `delivery_addresses` | shipping locations | `company_id`, `user_id`; inline `contact_person`/`contact_phone` | **not** org branches — must not be inferred as hierarchy |

### 2.5 Customer-safe RPC boundary (Buyer App)

| RPC | Returns | Hierarchy relevance |
|-----|---------|---------------------|
| `customer_company_v1` | company profile for session | company only |
| `customer_team_v1` | team members for session company | contacts without branch scope |
| `submit_b2b_trade_application_v1` | application + optional `company_id` | intake only |

No customer-safe hierarchy RPC exists in Central types.

### 2.6 Customer 360 binding (Point 59)

| Slice | Identity key | Point 60 relevance |
|-------|--------------|-------------------|
| Profile / orders / tickets | `companies.id` | anchor for hierarchy resolution input |
| `branchesAndContacts` | was `unavailable_not_governed` | **Point 60 resolver target** |

---

## 3. Authoritative identifier mapping

| Relationship | Authoritative source today | Mapping status |
|--------------|---------------------------|----------------|
| Commercial customer company | `companies.id` | **authoritative in Central** |
| Org company | `org_companies.id` (Core) | **not reachable from Central types** |
| **Commercial ↔ org company** | — | **MISSING — no FK, link table, or staff RPC in Central contract** |
| Branch / location | `org_branches` (Core) | **unavailable** |
| Contact / person | `org_contacts` (Core) | **unavailable** |
| Buyer auth user | `users.id` / `profiles.id` | linked via `company_id` only (company-wide, no branch scope) |
| Account manager | `companies.account_manager_id` → `users.id` | commercial ownership, not org membership |
| Branch scope | org membership (Core) | **unavailable** |
| Shadow lead | `shadow_clients.id` → optional `promoted_to_company_id` | staging only |
| Delivery location | `delivery_addresses.id` | logistics attribute, **not** hierarchy branch |

### Missing links / unsafe patterns (must not be used for hierarchy)

1. **Name / email / GST / phone matching** between `companies` and org entities — used in WA client resolution only; forbidden for hierarchy linkage.
2. **`delivery_addresses`** treated as branches — address records without org branch IDs.
3. **`b2b_applications.contact_*`** treated as org contacts — intake attributes only.
4. **`customer_import_*`** staging rows — not promoted, not in types.
5. **Dual shadow models** (`shadow_clients` vs `companies.status=shadow`) — parallel pre-company identity, not hierarchy.

---

## 4. Programme separation

| Point | Scope | Point 60 treatment |
|-------|-------|-------------------|
| **17** | Shared org hierarchy schema authority (Core) | Consumed only via Core contract; Central does not own schema |
| **59** | Customer 360 read shell | Hierarchy slice wired through Point 60 resolver |
| **60** | Company ↔ org hierarchy reconciliation | **This PR** — fail-closed resolver + census |
| **61–64** | CRM comms / tasks / health | unchanged — partial CRM-lite slices |
| **Buyer App** | Customer-safe storefront | out of scope; no hierarchy expansion here |

---

## 5. Core prerequisite (BLOCKER for governed hierarchy data)

Central **must not** invent schema or infer `companies` ↔ `org_companies` linkage.

### Required Core contract (chronology)

| Step | Owner | Deliverable |
|------|-------|-------------|
| 1 | Core (deployed — Core#206 evidence) | `org_companies`, `org_branches`, `org_contacts`, membership/scope tables + RLS |
| 2 | **Core — MISSING for Central** | Deterministic **`companies.id` ↔ `org_companies.id`** mapping surface (FK on `companies`, governed link table, or explicit `unlinked` registry — not name/GST inference) |
| 3 | **Core — MISSING for Central** | Staff-safe read RPC e.g. **`staff_company_hierarchy_v1(p_company_id uuid)`** returning org company id, branches, contacts, membership status/branch scope — fail-closed on ambiguous/unlinked |
| 4 | Central | Regenerate `database.types.ts` after Core contract lands; flip `CORE_HIERARCHY_CONTRACT.availableInCentralTypes` |
| 5 | Central (Point 60) | Resolver consumes RPC only; Customer 360 shows governed hierarchy or explicit `unlinked` / `core_contract_missing` |

**ASM route for step 2–3:** Core hierarchy mapping lane (extends Core#206 / Point 17), not Central.

---

## 6. Point 60 Central implementation

### Fail-closed hierarchy resolver

- **Module:** `src/lib/customer-hierarchy/customerHierarchyResolver.ts`
- **Contract probe:** `src/lib/customer-hierarchy/customerHierarchyContract.ts`
- **Behaviour:** validates `companies.id`; if Core mapping RPC/types absent → `core_contract_missing`; never queries org tables or infers linkage
- **Customer 360 wiring:** `fetchCustomer360ReadModel` maps resolver outcome to `branchesAndContacts` slice

### Tests

- `src/lib/customer-hierarchy/__tests__/customerHierarchyResolver.test.ts`
- Updated `customer360ReadModel.test.ts` expectations

---

## 7. Gate state

| Gate | State |
|------|-------|
| Hierarchy authority census | **YES** (this document) |
| Fail-closed resolver + tests | **YES** |
| Core `companies` ↔ `org_companies` mapping contract | **NO** — Core prerequisite |
| Point59 #503 merged | **NO** — PR remains dependent/draft |
| Point60 programme CLEARED | **NOT_CLEARED** — requires Core mapping RPC + predecessor merges + runtime reconciliation |

`PR MERGED != Point60 cleared`
