# Point 62 — Governed CRM Action Capture Census & Closure Evidence

**ASM:** POINT62 — calls / WhatsApp / email / notes / promises action capture  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/point62-action-capture-f7e1`  
**Base ancestry:** Point61 PR #507 head `0892c9b20043eadb1ee8626818e249d6c581bf8e`  
**Merge predecessor chain:** #497 → #499 → #503 → #507 → **Point62 (this PR, draft/dependent)**

---

## 1. Starting SHA / ancestry

| Item | Value |
|------|--------|
| **Starting SHA** | `0892c9b20043eadb1ee8626818e249d6c581bf8e` |
| **Starting commit** | `feat(point61): company-scoped CRM communication history read contract` |
| **Parent** | `60443018cd2303471ef034a399204f7cbb753947` (Point59 #503) |
| **Merge-base with main** | `64a107dfc167be76673a3d18f177a72472dcb241` |

---

## 2. Action / write / provider authority census

### Operator write surfaces (pre-Point62)

| Surface | Route / module | Write path | Core authority | Actor binding | Idempotency | Delivery / result | Audit |
|---------|----------------|------------|----------------|---------------|-------------|-------------------|-------|
| Sales dashboard log | `/sales/dashboard` | direct `client_interactions.insert` | RLS table | `executive_id` + roster | none | immediate `recorded` | row only |
| ClientInteractionsTab | Sales CRM-lite | direct `client_interactions.insert` | RLS table | `executive_id` + roster | none | immediate | row only |
| Customer 360 | `/admin/clients/:id` | **none** (read-only Point61) | — | — | — | — | — |
| WA outbound send | `send-whatsapp` edge | provider + `client_interactions` auto-log | Core edge | caller auth + `company_id` | edge auth | `delivered`/`failed` from provider | `audit_logs` + row |
| WA operator reply | `whatsapp-operator-reply` | `whatsapp_messages` | Core edge | operator `auth.uid()` | packet keys | provider status | WA tables |
| Email send | `send-email` edge | Resend API | Core edge | staff/admin auth | none | provider response | console only |
| UI-only WA notes | Operator inbox localStorage | none | — | — | — | — | **not durable** |
| CRM tasks / promises | `crm_tasks` | separate table | Core RLS | `sales_exec_id` | none | task status | Point63 scope |

### Risks identified

| Risk | Evidence | Point62 treatment |
|------|----------|-------------------|
| Duplicate ungoverned writes | Sales dashboard + interactions tab direct insert | **Rerouted** through `crm-action-capture` |
| UI-only notes | Operator inbox localStorage | **Unchanged** — not CRM ledger; out of scope |
| Invented delivery success | Manual WA log could imply send | Manual WA uses `logged_manual` outcome |
| Email without provider | No CRM email ledger | **Intent-only** capture with `intent_recorded` |
| Unscoped promises | `follow_up_date` on generic interactions | Dedicated `promise` channel + follow-up binding |
| Cross-company writes | Nullable `company_id` | Fail-closed company binding + roster/admin auth |
| Provider unavailable | `send-email` requires RESEND_API_KEY | Email intent capture; no send claimed |

### Programme separation

| Point | Scope | Point62 treatment |
|-------|-------|-------------------|
| **61** | Communication history read | Consumes `client_interactions` after capture |
| **62** | Governed action capture | **Implemented** — `src/lib/crm-action-capture/` |
| **63** | CRM tasks / scheduling | Not absorbed |
| **64** | Customer health | Not absorbed |
| **65–70** | WA order intake / live provider certification | Not absorbed |
| **Protected WA corpus** | Historical certification | No access |

---

## 3. Point62 implementation

### Canonical capture boundary

- **Module:** `src/lib/crm-action-capture/`
- **Durable authority:** Core `client_interactions` (no shadow table, no migrations)
- **Provenance:** `[POINT62:source:channel:phase:idem:{key}]` note prefix
- **Authorization:** roster binding for sales executives; internal staff admins for Customer 360
- **Idempotency:** pre-insert lookup by provenance idempotency marker
- **Intent/result:** manual channels write `result`; email = `intent_recorded`; WA provider path records intent row then delegates to `send-whatsapp` for canonical delivery outcome
- **UI wiring:** `SalesDashboard`, `ClientInteractionsTab`, `Customer360Page` (`CrmActionCaptureForm`)

### Tests

- `src/lib/crm-action-capture/__tests__/crmActionCaptureValidation.test.ts`
- `src/lib/crm-action-capture/__tests__/crmActionCaptureClient.test.ts`
- `src/lib/crm-action-capture/__tests__/crmActionCaptureHistoryRoundTrip.test.ts`
- `src/lib/crm-lite/__tests__/salesCrmAssistPoint74.test.ts` (governed write routing)

---

## 4. Gate state

| Gate | State |
|------|-------|
| Action/write/provider census | **YES** (this document) |
| Governed capture boundary | **YES** |
| Point61 history round-trip | **YES** (tests) |
| Predecessor #507 merged | **NO** — PR remains dependent/draft |
| Live provider/runtime certification | **NOT_CLEARED** |
| Point62 programme CLEARED | **NOT_CLEARED** |

`PR MERGED != Point62 cleared`
