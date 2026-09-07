# Point 61 — CRM Communication History Authority Census & Closure Evidence

**ASM:** POINT61 — CRM communication history canonical closure  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/point61-crm-communication-history-080a`

---

## 1. Current exact-head state

| Item | Value |
|------|--------|
| **Base (current main)** | `cb15abcb1d856ed674a1b17dd48a47083457dc16` |
| **Point59 #503** | **Merged** (squash onto main) |
| **Point61 PR** | `#507` — Point61-only rebuild (**4 commits** above base; 3 substantive: feature + Gate-4 remedial + Gate-4 final review repair; 1 docs alignment) |
| **Bounded ledger window (Customer 360)** | **25** most recent `client_interactions` rows (`CUSTOMER360_COMMUNICATION_HISTORY_LIMIT`) |
| **Bounded ledger window (standalone adaptor)** | **100** rows hard ceiling (`STANDALONE_COMMUNICATION_HISTORY_LIMIT`; `resolveStandaloneCommunicationHistoryLimit`) |
| **Ledger row typing** | `ClientInteractionLedgerRow` derived from generated `Database` `Pick`; `mapClientInteractionLedgerRows()` typed read boundary |

### Historical preflight (Gate-4, superseded)

| Item | Value |
|------|--------|
| Original branch stack | `6ffaa43b` (stale P57) → `60443018` (stale P59) → `0892c9b2` (P61) |
| Original P59 head at preflight | `60443018cd2303471ef034a399204f7cbb753947` |
| Rebuild action | Hard-reset to `cb15abcb`, cherry-pick P61 semantics only |

---

## 2. Communication-history authority census

### Surfaces & data sources

| Surface | Route / module | Primary data source | Company scope | Channel / direction | Actor | Disposition |
|---------|----------------|---------------------|---------------|---------------------|-------|-------------|
| Customer 360 interactions (partial) | `/admin/clients/:companyId` | `client_interactions` | `company_id` | `interaction_type` | `executive_id` | **Partial CRM-lite** legacy summary |
| Customer 360 communications ledger | `/admin/clients/:companyId` | `client_interactions` via Point61 adaptor | `company_id` + row `company_id` fail-closed | normalized channel/direction | executive / system | **Point61 canonical read** (bounded) |
| Sales dashboard CRM-lite | `/sales/dashboard` | `client_interactions` | AM roster `company_id` IN filter | manual types | `executive_id` | Duplicate read + **Point62 writes** |
| WA provider message log | Core `whatsapp_messages` | direct provider rows | via `order_id` only | inbound/outbound | provider | **Not CRM truth** — excluded |
| Protected WA historical corpus | certification lane | governed intakes / archives | certification only | — | — | **Explicitly excluded** (no access) |
| Email records | — | **none in Central contract** | — | — | — | **Unavailable** |

### Required projection for ledger normalization

`CLIENT_INTERACTION_LEDGER_SELECT` must include `company_id` and `executive_id`. Without these fields, `normalizeClientInteractionRow()` fail-closes every row and the ledger renders empty.

---

## 3. Programme separation

| Point | Scope | Point61 treatment |
|-------|-------|-------------------|
| **61** | Unified CRM communication history read | **Implemented** |
| **62** | Action capture writes | **Not absorbed** |
| **63** | CRM tasks | Remains partial slice |
| **64** | Customer health | Remains `unavailable_not_governed` |
| **Protected WA corpus** | Historical certification | **No access** |

---

## 4. Point61 implementation

### Canonical read contract

- **Module:** `src/lib/crm-communication-history/`
- **Authority:** `client_interactions` (Core CRM ledger; includes `send-whatsapp` auto-log)
- **Identity:** `companies.id` via `normalizeCompanyId()` + `assertCustomer360CompanyAccess()`
- **Server scope:** `.eq("company_id", companyId)` retained; RLS unchanged
- **Normalization:** channel, direction, actor, timestamp, source provenance
- **Bounded reads:** Customer 360 = 25 rows; standalone adaptor = 100 rows (not full history)
- **Unavailable channels:** email (`unavailable_not_governed`); WhatsApp partial (unlinked inbound / protected corpus excluded)

### Wiring

- `fetchCustomer360ReadModel` populates `communicationsLedger` from the same bounded interactions query
- Legacy `interactions` slice remains CRM-lite/partial preview; `communicationsLedger` is the governed Point61 view
- `Customer360Page` renders timeline + channel governance panel with bounded disclosure

### Tests

- `src/lib/crm-communication-history/__tests__/*`
- `src/lib/customer-360/__tests__/customer360ReadModel.test.ts` — projection regression (`company_id`, `executive_id`), ledger population, `recordLimit`

---

## 5. Gate state

| Gate | State |
|------|-------|
| Communication-history authority census | **YES** |
| Point61-only rebuild on post-#503 main | **YES** |
| `company_id` / `executive_id` projection fix | **YES** (Gate-4 remedial) |
| Standalone 100-record hard ceiling | **YES** (Gate-4 final review repair) |
| Generated `ClientInteractionLedgerRow` projection typing | **YES** (Gate-4 final review repair) |
| Bounded ledger behavior documented | **YES** (25 Customer 360 / 100 standalone) |
| Point59 #503 merged | **YES** |
| Exact-head review-clean | **pending** |
| Multi-channel runtime certification | **NOT_CLEARED** |
| Point61 programme CLEARED | **NOT_CLEARED** |

`PR MERGED != Point61 cleared`
