# Point 63 — CRM Tasks / Follow-ups / Opportunities Authority Census & Closure Evidence

**ASM:** POINT63 — CRM tasks / follow-ups / opportunities canonical closure  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/point63-crm-tasks-followups-a7dd`  
**Base ancestry:** Point61 PR #507 head `0892c9b20043eadb1ee8626818e249d6c581bf8e`  
**Merge predecessor chain:** #497 Dispatch P0 → #499 Point57 → #503 Point59 → #507 Point61 → **Point63 (this PR, draft/dependent)**

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

## 2. Task / follow-up / opportunity authority census

### Surfaces & data sources

| Surface | Route / module | Primary data source | Company scope | Kind / status | Owner | Disposition |
|---------|----------------|---------------------|---------------|---------------|-------|-------------|
| Customer 360 tasks (partial) | `/admin/clients/:companyId` | `crm_tasks` raw select | `company_id` | `task_type`, `status` | `sales_exec_id` | **Partial CRM-lite** (Point59 legacy) |
| Customer 360 work items ledger | `/admin/clients/:companyId` | `crm_tasks` + `client_interactions.follow_up_date` via Point63 adaptor | `company_id` | normalized kind/status | `sales_exec_id` / `executive_id` | **Point63 canonical read** |
| Sales CRM-lite workspace | `/sales/dashboard` | `crm_tasks` insert/update + `client_interactions` follow-ups | AM roster `company_id` IN | follow_up, repeat_contact, sample, opportunity | `sales_exec_id` | **Write surface** — now uses Point63 mutation contract |
| Sales dashboard overdue KPI | `/sales/dashboard` | `crm_tasks` count | exec-scoped | pending + overdue | `sales_exec_id` | Analytics only |
| SalesIntelligencePanel | `/admin/sales-hub` | `crm_tasks` + `client_interactions` aggregates | exec-scoped | counts | `sales_exec_id` | Analytics only |
| ClientInteractionsTab | Sales console | `client_interactions.follow_up_date` | company filter | interaction | `executive_id` | **Point62** action capture writes |
| Retail factory follow-ups | Store coordination | local drafts + operational events | store scope | factory follow-up | store roles | **Operational** — not CRM task master |
| `retail_followup_queue` | work queues | `operational_queue_items` projection | retail entity | queue item | store_incharge | **Operational queue** — not `crm_tasks` |
| Opportunity commercial facts | — | **none in `crm_tasks` schema** | — | — | — | **Unavailable** — no value/probability columns |
| Customer health / NBA | Customer 360 | — | — | — | — | **Point64** — `unavailable_not_governed` |

### Findings

| Risk | Evidence | Point63 treatment |
|------|----------|-------------------|
| UI-only tasks | CRM-lite workspace wrote `crm_tasks` without audit/provenance | Governed mutation contract with created/snooze/complete audit trail |
| Duplicated reminder stores | `follow_up_date` on interactions + `crm_tasks` due_date | Single read adaptor; commitments projected read-only until promoted |
| Missing company/actor scoping | `crm_tasks.company_id` / `sales_exec_id` nullable in types | Fail closed — rows without company or owner excluded from canonical read |
| Stale/completed tasks still actionable | CRM-lite listed all pending; no history lane | Customer 360 separates `openItems` vs `historyItems` |
| Follow-ups without due dates | Interactions with null `follow_up_date` | Excluded from commitment projection |
| Fabricated opportunity value/probability | No Core columns; UI allowed `opportunity` kind only | Contract rejects commercial fact fields; kind governance marks partial |
| Bypass Customer360 identity | Direct sales console reads | Customer 360 work items ledger bound to `normalizeCompanyId()` + access guard |
| Snooze erases prior due state | No dedicated snooze column (schema freeze) | Append-only audit marker in `description` preserves `fromDueDate` |

---

## 3. Programme separation

| Point | Scope | Point63 treatment |
|-------|-------|-------------------|
| **63** | CRM tasks / follow-ups / opportunities work-item contract | **Implemented** — `crm-work-items` adaptor + Customer 360 `workItemsLedger` |
| **62** | Communication/action capture writes (`client_interactions`) | **Not absorbed** — interaction logging unchanged |
| **64** | Customer health / next-best-action | Remains `unavailable_not_governed` on Customer 360 |
| **Protected WA corpus** | Historical certification | **No access** |

---

## 4. Point63 implementation

### Canonical work-item contract

- **Module:** `src/lib/crm-work-items/`
- **Read authority:** `crm_tasks` (Core) + read-only `client_interactions.follow_up_date` commitments
- **Write authority:** `crm_tasks` only (no second task master)
- **Identity:** `companies.id` via Customer 360 guards
- **Required fields:** company, owner (`sales_exec_id`), kind, status, due date, provenance
- **Snooze/reschedule:** auditable via `<!-- crm_work_item_audit:[...] -->` suffix — prior due dates never erased
- **Opportunity:** intent-only; commercial facts fail closed

### Wiring

- `fetchCustomer360ReadModel` populates `workItemsLedger` slice (Point63)
- `Customer360Page` renders governed open work items + history lane + kind governance
- `SalesCrmLiteWorkspace` create/complete/follow-up-promotion uses mutation contract
- Legacy `tasks` slice remains `partial_crm_lite` (parallel to Point61 interactions vs communicationsLedger)

### Tests

- `src/lib/crm-work-items/__tests__/crmWorkItemsNormalizer.test.ts`
- `src/lib/crm-work-items/__tests__/crmWorkItemsContract.test.ts`
- `src/lib/crm-work-items/__tests__/crmWorkItemsReadModel.test.ts`
- `src/lib/customer-360/__tests__/customer360ReadModel.test.ts` (workItemsLedger availability)

---

## 5. Gate state

| Gate | State |
|------|-------|
| Task/follow-up/opportunity authority census | **YES** (this document) |
| Company-scoped work-item read adaptor | **YES** |
| Customer 360 `workItemsLedger` binding | **YES** |
| Mutation contract (create/complete/snooze) with audit | **YES** |
| Deterministic scoping/ownership/overdue tests | **YES** |
| Point61 #507 merged | **NO** — PR remains dependent/draft |
| Runtime staff/customer-workflow UAT | **NOT_CLEARED** |
| Point63 programme CLEARED | **NOT_CLEARED** |

`PR MERGED != Point63 cleared`
