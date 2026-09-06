# Point 62 — CRM Action Capture Authority Census & Closure Evidence

**ASM:** POINT62 — calls / WhatsApp / email / notes / promises governed action capture  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/point62-action-capture-80f9`  
**Base ancestry:** Point61 PR #507 head `0892c9b20043eadb1ee8626818e249d6c581bf8e`  
**Merge predecessor chain:** #497 → #499 → #503 → #507 → **Point62 (this PR, draft/dependent)**

---

## 1. Starting SHA / ancestry

| Item | Value |
|------|--------|
| **Starting SHA** | `0892c9b20043eadb1ee8626818e249d6c581bf8e` |
| **Starting commit** | `feat(point61): company-scoped CRM communication history read contract` |
| **Parent** | `60443018cd2303471ef034a399204f7cbb753947` (Point59 #503) |
| **Commits ahead of main at start** | 3 (Point57 + Point59 + Point61) |

---

## 2. Action / write / provider authority census

### Operator write surfaces (pre-Point62)

| Surface | Route / module | Channel | Write authority | Actor bind | Company bind | Idempotency | Delivery state | Audit |
|---------|----------------|---------|-----------------|------------|--------------|-------------|----------------|-------|
| Sales dashboard log modals | `/sales/dashboard` | call, whatsapp, visit, note | direct `client_interactions.insert` | `executive_id` | roster `company_id` | none | N/A manual | RLS only |
| ClientInteractionsTab | Sales / admin sales hub | call, whatsapp, visit, note | direct insert | `executive_id` | company filter | none | N/A | RLS only |
| send-whatsapp edge | Core edge | whatsapp outbound | `client_interactions` when `company_id` | caller JWT | optional | none | provider result (`delivered`/`failed`) | `debug_webhooks`, `audit_logs` on failure |
| whatsapp-operator-reply | Operator inbox | whatsapp reply | Core RPC queue | staff JWT | packet/case | `p_idempotency_key` | Core status machine | Core reply ledger |
| WA case lifecycle RPCs | Operator inbox | governed WA actions | Core RPCs | staff | case→company | case action keys | Core events | case snapshot |
| Operator packet notes | Operator inbox | note | `upsert_whatsapp_operator_note` RPC | per actor | per packet | mutation queue | N/A | RPC tables |
| notify-event / send-email | various | email, WA | outbox / provider | resolved audience | weak | none | per-channel ok/fail | `audit_logs` |
| CRM tasks | Sales CRM-lite | follow-up tasks | `crm_tasks` | `sales_exec_id` | `company_id` | none | task status | **Point63** — not absorbed |

### Gaps identified (pre-Point62)

| Gap | Risk | Point62 treatment |
|-----|------|-------------------|
| Duplicate direct inserts | No provenance, no idempotency | Single `crm-action-capture` boundary |
| Email sends bypass CRM timeline | No durable company-scoped record | `captureEmailIntent` — intent-only, no send claim |
| Promise without follow-up date | Unscoped commitments | `promise` channel requires `followUpDate` |
| Provider invented delivery | Client could claim sent | WA provider path returns `pending_provider`; edge owns delivered/failed |
| Cross-company writes | Roster escape | `authorizedCompanyIds` roster guard |
| UI-only / non-durable notes | Operator confusion | WA packet notes remain separate; CRM notes use durable boundary |
| Point61 read fragmentation | History misses governed writes | All boundary writes include P62 provenance consumed by Point61 adaptor |

### Programme separation

| Point | Scope | Point62 treatment |
|-------|-------|-------------------|
| **61** | Communication history read | **Consumed** — boundary writes project into `client_interactions` for Point61 adaptor |
| **62** | Action capture | **Implemented** — `src/lib/crm-action-capture/` + sales surface wiring |
| **63** | CRM tasks / scheduling | **Not absorbed** — `crm_tasks` writes unchanged |
| **64** | Customer health / protected WA certification | **Not absorbed** — no protected corpus access |
| **65–70** | WhatsApp order intake / live provider certification | **Not absorbed** — operator inbox paths unchanged |

---

## 3. Point62 implementation

### Canonical capture boundary

- **Module:** `src/lib/crm-action-capture/`
- **Durable authority:** Core `client_interactions` (no shadow ledger, no migrations)
- **Provenance:** `[P62|channel=…|source=…|delivery=…|idem=…]` prefix on `notes`
- **Intent/result separation:** `delivery` in provenance; `outcome` holds `intent_only` / provider states / manual outcome
- **Idempotency:** client-side key embedded in provenance; dedupe query before insert
- **Authorization:** actor required; optional roster `authorizedCompanyIds` fail-closed guard
- **Provider paths:**
  - WhatsApp: `captureWhatsAppProviderSend` → existing `send-whatsapp` edge (never invents delivered)
  - Email: `captureEmailIntent` only — provider unavailable, `intent_only` outcome

### Wired surfaces

- `ClientInteractionsTab` → `captureCrmManualAction` (+ promise type, provenance display strip)
- `SalesDashboard` log modals → `captureCrmManualAction` with roster scope
- `sendWhatsAppMessage` documentation aligned to Core provider authority

### Tests

- `src/lib/crm-action-capture/__tests__/crmActionCaptureProvenance.test.ts`
- `src/lib/crm-action-capture/__tests__/crmActionCaptureValidation.test.ts`
- `src/lib/crm-action-capture/__tests__/crmActionCaptureClient.test.ts`
- `src/lib/crm-action-capture/__tests__/crmActionCaptureRoundTrip.test.ts` (Point61 round-trip)
- `src/lib/crm-action-capture/__tests__/point62ActionCaptureClosure.test.ts`
- Updated Point61 normalizer governance + Point74 assist structural tests

---

## 4. Gate state

| Gate | State |
|------|-------|
| Action/provider authority census | **YES** (this document) |
| Single Central capture boundary | **YES** |
| Company / actor / provenance binding | **YES** |
| Idempotency + intent/result separation tests | **YES** |
| Point61 history round-trip | **YES** |
| Point61 #507 merged | **NO** — PR remains dependent/draft |
| Live provider / email runtime certification | **NOT_CLEARED** |
| Point62 programme CLEARED | **NOT_CLEARED** |

`PR MERGED != Point62 cleared`
