# Point 61 — CRM Communication History Authority Census & Closure Evidence

**ASM:** POINT61 — CRM communication history canonical closure  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/point61-crm-communication-history-080a`  
**Base ancestry:** Point59 PR #503 head `60443018cd2303471ef034a399204f7cbb753947`  
**Merge predecessor chain:** #497 Dispatch P0 → #499 Point57 → #503 Point59 → **Point61 (this PR, draft/dependent)**

---

## 1. Starting SHA / ancestry

| Item | Value |
|------|--------|
| **Starting SHA** | `60443018cd2303471ef034a399204f7cbb753947` |
| **Starting commit** | `feat(point59): canonical Customer 360 operational read model` |
| **Parent** | `6ffaa43babeed060ec9ccdcc567f8bff45347b94` (Point57 #499) |
| **Commits ahead of main at start** | 2 (Point57 + Point59) |

---

## 2. Communication-history authority census

### Surfaces & data sources

| Surface | Route / module | Primary data source | Company scope | Channel / direction | Actor | Disposition |
|---------|----------------|---------------------|---------------|---------------------|-------|-------------|
| Customer 360 interactions (partial) | `/admin/clients/:companyId` | `client_interactions` | `company_id` | `interaction_type` | `executive_id` | **Partial CRM-lite** (Point59) |
| Customer 360 communications ledger | `/admin/clients/:companyId` | `client_interactions` via Point61 adaptor | `company_id` | normalized channel/direction | executive / system | **Point61 canonical read** |
| Sales dashboard CRM-lite | `/sales/dashboard` | `client_interactions` | AM roster `company_id` IN filter | manual types | `executive_id` | Duplicate read + **Point62 writes** |
| ClientInteractionsTab | Sales console | `client_interactions` | company filter | call/wa/visit/note | `executive_id` | Duplicate read + **Point62 writes** |
| SalesCrmLiteWorkspace | Sales console | `client_interactions` | roster scope | same | `executive_id` | Duplicate read |
| SalesIntelligencePanel | `/admin/sales-hub` | `client_interactions` aggregates | exec-scoped | counts only | `executive_id` | Analytics only |
| WA outbound auto-log | Core `send-whatsapp` edge | `client_interactions` insert | `company_id` when known | whatsapp / outbound | caller user | **Core authority → CRM ledger** |
| WA provider message log | Core `whatsapp_messages` | direct provider rows | via `order_id` only | inbound/outbound | provider | **Not CRM truth** — order/packet scoped |
| WA operator inbox | `/admin/operator-inbox` | `whatsapp_messages` + packets | scored identity, not CRM ledger | packet projection | operator/customer | **Operational only** — not promoted |
| WA operational feed | `operational-events/whatsappFeed` | derived inbox projection | packet/order entities | communication | heuristic | **Derived** — not CRM ledger |
| Buyer communication log | Buyer App (`buyerCommunicationLog`) | tickets + general queries RPC | buyer-safe | support/enquiry | customer | **Buyer scope** — out of Central CRM |
| Notifications | various | `notifications` | optional `company_id` | system alerts | user_id | Operational alerts — **not unified comms** |
| Email records | — | **none in Central contract** | — | — | — | **Unavailable** |
| Protected WA historical corpus | certification lane | governed intakes / archives | certification only | — | — | **Explicitly excluded** (no access) |
| Support tickets | Customer 360 tickets slice | `support_tickets` → `orders` | order-linked | support | — | Adjacent; separate Point59 slice |
| CRM tasks / promises | Customer 360 tasks slice | `crm_tasks` + `follow_up_date` | `company_id` | task | sales exec | **Point63 / Point62** — not comms ledger |

### Findings

| Risk | Evidence | Point61 treatment |
|------|----------|-------------------|
| Duplicate histories | Sales dashboard, CRM-lite workspace, Customer 360 interactions all read `client_interactions` independently | Single **read adaptor** bound to Customer 360 `communicationsLedger` |
| Provider logs as CRM truth | `whatsapp_messages` used heavily in operator inbox / edges | **Excluded** from CRM ledger; only `client_interactions` auto-log is surfaced |
| Mock/demo rows | None in comms paths; Point59 blocks fabricated slices | Fail-closed unavailable states preserved for email / protected corpus |
| Missing company scoping | `client_interactions.company_id` nullable; WA packets often pre-resolution | Rows with mismatched `company_id` dropped; WA partial channel documents unlinked inbound gap |
| Ambiguous sender | Nullable `executive_id`; auto-log uses system actor | Normalized actor roles with explicit `unknown` fallback |
| Unsafe PII exposure | Full notes returned to staff CRM surfaces | Same RLS boundary as existing `client_interactions` reads — no new exposure |
| Events not linkable to `companies.id` | Inbound WA before identity resolution | Excluded from company ledger; channel marked `partial` |

---

## 3. Programme separation

| Point | Scope | Point61 treatment |
|-------|-------|-------------------|
| **61** | Unified CRM communication history read | **Implemented** — `crm-communication-history` adaptor + Customer 360 slice |
| **62** | Action capture (calls/WA/email/notes/promises writes) | **Not absorbed** — existing write surfaces unchanged |
| **63** | CRM tasks | Remains partial slice on Customer 360 |
| **64** | Customer health | Remains `unavailable_not_governed` |
| **Protected WA corpus** | Historical certification | **No access** — explicit partial/unavailable channel governance |

---

## 4. Point61 implementation

### Canonical read contract

- **Module:** `src/lib/crm-communication-history/`
- **Authority:** `client_interactions` (Core CRM ledger; includes `send-whatsapp` auto-log)
- **Identity:** `companies.id` via `normalizeCompanyId()` + `assertCustomer360CompanyAccess()`
- **Normalization:** channel, direction, actor, timestamp, source provenance (`table` + `recordId`)
- **Ordering:** newest-first with deterministic dedupe by source record
- **Unavailable channels:** email (`unavailable_not_governed`); WhatsApp inbound/unlinked + protected corpus (`partial` with reason)

### Wiring

- `fetchCustomer360ReadModel` populates `communicationsLedger` slice (Point61)
- `Customer360Page` renders governed communication history + channel governance panel
- CRM-lite interaction tab remains partial preview (not removed — separate slice contract)

### Tests

- `src/lib/crm-communication-history/__tests__/crmCommunicationHistoryNormalizer.test.ts`
- `src/lib/crm-communication-history/__tests__/crmCommunicationHistoryReadModel.test.ts`
- `src/lib/customer-360/__tests__/customer360ReadModel.test.ts` (communications ledger availability)

---

## 5. Gate state

| Gate | State |
|------|-------|
| Communication-history authority census | **YES** (this document) |
| Company-scoped read adaptor | **YES** |
| Customer 360 `communicationsLedger` binding | **YES** |
| Deterministic ordering / dedupe / scoping tests | **YES** |
| Point59 #503 merged | **NO** — PR remains dependent/draft |
| Multi-channel runtime certification | **NOT_CLEARED** — requires predecessor merge + live WA/email channel proof |
| Point61 programme CLEARED | **NOT_CLEARED** |

`PR MERGED != Point61 cleared`
