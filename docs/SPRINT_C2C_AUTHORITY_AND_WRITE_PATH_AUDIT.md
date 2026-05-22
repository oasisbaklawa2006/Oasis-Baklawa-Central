# Sprint C2C — Authority & Write-Path Audit (Preparation Only)

**Purpose:** Phase **C2C preparation** — consolidate inspection of WhatsApp-related **Edge functions**, **JWT / service-role posture**, **operator reply authority**, **classify/route (TOOL 3/4) authority**, **WhatsApp audit tables & RLS posture**, and **governance / C2B–C2C plans** into a single audit artifact. **No implementation**, **no migrations**, **no deploy**, **no Supabase CLI**, **no write-path changes** were performed to produce this document.

**Primary sources (this pass):** `supabase/config.toml`; `supabase/functions/whatsapp-webhook/index.ts`, `whatsapp-message-stitcher/index.ts`, `whatsapp-operator-reply/index.ts`, `send-whatsapp/index.ts`, `send-whatsapp-automation/index.ts`, `whatsapp-otp/index.ts`, `whatsapp-identify-sender/index.ts`, `whatsapp-classify-intent/index.ts`, `whatsapp-route-packet/index.ts`; `src/components/WhatsAppInbox.tsx`, `src/utils/whatsapp.ts`, `src/pages/admin/OrderManagement.tsx`, `src/pages/admin/AdminSettings.tsx`; `docs/SPRINT_C2B_POLICY_GOVERNANCE_RECONCILIATION_PACK.md`, `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md`, `docs/SPRINT_C2_READINESS_REPORT.md`, `docs/SPRINT_C2B_UNBLOCK_DECISION_MEMO.md`, `docs/SPRINT_C2B_EXECUTION_CHECKLIST.md`, `docs/SPRINT_C2B_READ_ONLY_IMPLEMENTATION_PLAN.md`; `supabase/migrations/20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` (tracked intent for audit tables / RLS).

---

## 1. Every WhatsApp write surface

Surfaces are grouped by **mechanism**. “WhatsApp-adjacent” includes storage and CRM tables touched from the WhatsApp webhook path.

### 1.1 Edge Functions (service role — bypasses RLS)

| Surface | Slug | Tables / storage / external writes (observed in repo) |
|--------|------|---------------------------------------------------------|
| **Inbound pipeline** | `whatsapp-webhook` | **`whatsapp_contacts`** insert (find-or-create); **`whatsapp_buffer`** insert; **`whatsapp_messages`** insert (raw inbound `is_raw: true`, `packet_id: null`); **`debug_webhooks`** insert/update (incl. intent, dedup, attachment patch); **`storage`** bucket **`whatsapp_attachments`** upload + URL; extensive **non-WhatsApp** writes (`orders`, `order_items`, `notifications`, `client_interactions`, `companies`, `ledger_disputes`, etc.); **non-blocking `fetch`** to **`whatsapp-message-stitcher`** with **service bearer** |
| **Stitcher (TOOL 0)** | `whatsapp-message-stitcher` | **`whatsapp_message_packets`** insert; **`whatsapp_messages`** update (`packet_id`, `packet_sequence`, `is_raw`, `stitched_at`) |
| **Operator reply (TOOL 1)** | `whatsapp-operator-reply` | **`whatsapp_messages`** insert (outbound `provider: operator_reply`, `pending`); **`whatsapp_messages`** update (success → `delivered` + provider ids, or failure); **HTTP POST** to **`send-whatsapp`** with **`Authorization: Bearer` service role** |
| **Outbound send** | `send-whatsapp` | **`debug_webhooks`** insert; **`audit_logs`** insert (errors only); **`client_interactions`** insert (when `company_id`); conditional **`whatsapp_contacts`** insert + **`whatsapp_messages`** insert when **`order_id`** present |
| **Lifecycle automation** | `send-whatsapp-automation` | **`whatsapp_automations`** insert per trigger; delegates to **`send-whatsapp`** with service bearer |
| **OTP / WA login helper** | `whatsapp-otp` | **`app_settings`** upsert/delete for `wa_otp_*` keys; in-memory `otpStore`; outbound HTTP to Click2API (not a Postgres WhatsApp core table, but same **verify_jwt = false** gateway class) |

### 1.2 Edge Functions — read-only for governed WhatsApp tables (no `.insert`/`.update`/`.delete` on packet/message tables in handler grep)

| Slug | Role |
|------|------|
| `whatsapp-identify-sender` | SELECT-only classification (service role) |
| `whatsapp-classify-intent` | SELECT + return JSON (**TOOL 3**) |
| `whatsapp-route-packet` | SELECT + return JSON (**TOOL 4**) |

### 1.3 Browser / app (PostgREST or `functions.invoke`)

| Surface | Mechanism | WhatsApp-related effect |
|---------|-----------|-------------------------|
| **Operator Inbox reply** | `supabase.functions.invoke("whatsapp-operator-reply", { body: { …, operator_id? } })` | Delegates all DB + provider writes to Edge (**§1.1**) |
| **Dispatch / CRM helpers** | `sendWhatsAppMessage` / `sendDispatchAlert` in `src/utils/whatsapp.ts` | **`functions.invoke("send-whatsapp")`** — same Edge blast radius as admin callers |
| **Order management** | `OrderManagement.tsx` invokes **`send-whatsapp`** | Outbound + conditional **`whatsapp_messages`** when `order_id` in body |
| **Admin settings** | `AdminSettings.tsx` — test send via **`send-whatsapp`**; **`whatsapp_config`** insert/update via user-scoped client (RLS applies; not Edge) | Config + manual test messages |
| **Inbox read paths** | `WhatsAppInbox` / operator inbox hooks | **SELECT** on `whatsapp_message_packets` / `whatsapp_messages` only (per current grep); **invoke** classify/route (**read-only** on DB) |

### 1.4 Indirect / chained writes

- **`whatsapp-webhook`** → **`whatsapp-message-stitcher`**: second hop uses **service role** in stitcher; failure modes are **partial visibility** (inbound row without packet) if stitcher never runs or fails.
- **`whatsapp-operator-reply`** → **`send-whatsapp`**: operator row may be **`pending`** then updated; **`send-whatsapp`** does not receive `packet_id` in the delegated body (only `to`, `message`, `order_id`, `company_id`) — linkage is **prior insert** in operator-reply only.

### 1.5 Governance tables (`whatsapp_override_log`, `whatsapp_suggestions_log`)

- **No Edge function in repo** currently performs `.insert` into these tables (TOOL 5/6 persistence remains **frozen / unimplemented** per governance docs).
- Migration **`20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql`** defines **schema + RLS intent** for when writes are allowed.

---

## 2. JWT posture

| Observation | Detail |
|-------------|--------|
| **Gateway** | In **`supabase/config.toml`**, every listed function — including **all WhatsApp slugs** (`whatsapp-webhook`, `whatsapp-message-stitcher`, `whatsapp-operator-reply`, `whatsapp-otp`, `whatsapp-identify-sender`, `whatsapp-classify-intent`, `whatsapp-route-packet`, `send-whatsapp`, `send-whatsapp-automation`) — has **`verify_jwt = false`**. |
| **Implication** | Supabase **does not require** a valid end-user JWT at the Edge gateway for these URLs. Callers typically still pass **`apikey`** (anon/publishable) per platform contract; **that is not operator authentication**. |
| **Browser `functions.invoke`** | The JS client attaches the **user session JWT** when present, but the **gateway does not enforce** it when `verify_jwt = false`. **Authorization cannot rely on “invoke had a session.”** |
| **Target state (governance)** | **`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §5** requires **`verify_jwt = true`** for **write-capable** operator paths unless a **separate**, reviewed server-to-server design (HMAC, internal-only network, etc.) exists. |
| **Internal server-to-server** | **`whatsapp-operator-reply` → `send-whatsapp`** uses **service role bearer** explicitly — correct for **backend-to-backend**, but the **entry** `whatsapp-operator-reply` is still **publicly invokable** with anon key unless additional controls exist upstream (WAF, secrets URL, etc.). |

---

## 3. Service-role surfaces

| Location | Pattern | Notes |
|----------|---------|--------|
| **All WhatsApp Edge handlers above** | `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` | **Full RLS bypass** for any query issued in that handler. |
| **`whatsapp-webhook`** | Service client for almost all DB and **storage.upload** to **`whatsapp_attachments`** | Largest **blast radius** (orders, finance-adjacent paths, buffer, contacts, messages). |
| **`whatsapp-message-stitcher`** | Service client | Mutates **packet truth** and **message linkage**. |
| **`whatsapp-operator-reply`** | Service client + **`fetch(..., Authorization: Bearer service_key)`** to **`send-whatsapp`** | Nested service-role call chain. |
| **`send-whatsapp` / `send-whatsapp-automation`** | Service client; automation also uses bearer to **`send-whatsapp`** | Shared outbound + logging path. |
| **`whatsapp-otp`** | Service client for **`app_settings`** / reads | OTP state persistence side channel. |

**Design tension:** Governance expects **operator JWT + RLS** for human trust paths; current **operator reply** is **Edge service role** end-to-end with **no verified identity** in the handler.

---

## 4. Missing audit guarantees

| Gap | Why it matters |
|-----|----------------|
| **No `whatsapp_override_log` rows from Edge** | TOOL 5 **manual overrides** are not implemented; **no immutable audit** of packet control changes. |
| **`whatsapp-operator-reply` has no audit row** | Outbound operator messages update **`whatsapp_messages`** only; **no linked governance record** comparable to override log (actor, reason, correlation id). **`operator_id` in JSON is console-log only** — not an audit trail. |
| **`send-whatsapp` success path** | **`audit_logs`** only on **failure**; successes rely on **`debug_webhooks`** / optional **`whatsapp_messages`** / **`client_interactions`**. |
| **Stitcher** | No separate **audit** table for “who triggered stitch” or packet creation events; **idempotency** relies on message state + stitcher logic, not append-only audit. |
| **Prod vs migration intent** | Reconciliation pack notes **`{public}` vs `TO authenticated`** presentation for audit/packet policies and missing **`whatsapp_override_log_priority_check`** on prod — **DB-level audit integrity** not fully aligned with signed-off migration text until reconciled. |
| **Webhook ↔ stitcher** | Non-blocking stitcher call: **no transactional coupling** between inbound insert and packetization. |

---

## 5. TOOL 5 requirements (from governance — implementation frozen until approval)

Condensed from **`docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md`** and **`docs/SPRINT_C2B_POLICY_GOVERNANCE_RECONCILIATION_PACK.md` §5**:

1. **Explicit product + engineering approval** before any TOOL 5 code or migrations.
2. **`verify_jwt = true`** on browser-invoked **write** slugs (or an approved alternative with written threat model).
3. **Identity:** **`auth.uid()`** (verified JWT) as the **only** trust root for “who acted”; **reject/ignore** body **`operator_id` / `user_id`** for authorization or audit.
4. **Role checks:** Allowlisted staff roles validated **in Edge** (and ideally mirrored in **RLS** or **`SECURITY DEFINER` RPC**).
5. **Atomicity:** Packet (or governed entity) mutation + **`whatsapp_override_log`** insert in **one transaction** — prefer **`SECURITY DEFINER` RPC**.
6. **Field allowlist:** Exact mutable columns **signed off**; constraints/enums as needed.
7. **RLS:** No new policies / migrations until **migration history reconciliation** gates pass (`SPRINT_C2B_UNBLOCK_DECISION_MEMO`, execution strategy).
8. **TOOL 6 default:** Return-only; **no** `whatsapp_suggestions_log` persistence without separate approval (`§6` freeze pack).

---

## 6. Threat model (condensed)

| Actor | Capability today (repo + config) | Impact |
|-------|----------------------------------|--------|
| **Anyone with Edge URL + anon key** | POST to **`verify_jwt = false`** functions | **Stitcher:** create packets + relink messages. **Operator-reply:** insert fake outbound rows + trigger real **`send-whatsapp`** to arbitrary phone if provider keys work. **Webhook:** if provider signing absent or broken, forged inbound pipeline. |
| **Authenticated staff (browser)** | Same as above for Edge (JWT not enforced at gateway) | UI route protection (`ProtectedRoute`) does **not** secure Edge; it only gates who sees the **admin SPA**. |
| **Insider / leaked service role** | Full DB + storage | Bypasses all RLS; exceeds any WhatsApp-scoped damage model. |
| **Provider (Meta / Click2API / MSG91)** | Webhook + provider APIs | Expected trusted channels; failures become **integrity** or **DoS** issues. |

**Assumptions to validate in ops (not proven in repo):** Meta **signature verification** on `whatsapp-webhook`, rate limits, IP allowlists, separate **internal** URLs for stitcher/cron.

---

## 7. Replay risks

| Risk | Mitigation observed |
|-------|---------------------|
| **Duplicate inbound WhatsApp** | **`whatsapp-webhook`** checks **`debug_webhooks`** for existing **`wamid`** before processing; logs duplicate with `discard_reason: duplicate_wamid`. |
| **Replay of Edge POST** | **No request nonce** visible for stitcher or operator-reply; **retries** could duplicate work. Stitcher selects **`is_raw` + null `packet_id`** — replays might **race** or **double-process** if guardrails incomplete. |
| **Operator reply double-send** | Client could **double-click** Send → duplicate **`functions.invoke`** → duplicate **`whatsapp_messages`** + duplicate provider sends unless UI idempotency or server dedup exists (not audited here as present). |
| **`send-whatsapp` idempotency** | Provider-level message ids returned; **no** obvious application-level idempotency key in handler for the same logical send. |

---

## 8. Escalation risks

| Vector | Description |
|--------|-------------|
| **Webhook → core business tables** | Same handler resolves sender, mutates **orders**, **companies**, **ledger disputes**, etc. A **logic bug** or **adversarial payload** in the trusted-boundary failure mode has **cross-domain** impact (not isolated to WhatsApp). |
| **Service role in depth** | Any compromise of **one** `verify_jwt = false` function is effectively **database-wide** for queries that handler performs. |
| **Stitcher privilege** | Packet creation **defines** operator workload and routing surfaces; **silent corruption** (wrong grouping) escalates to **wrong business responses** without TOOL 5. |
| **Automation + send-whatsapp** | **`send-whatsapp-automation`** can drive high-volume outbound + **`whatsapp_automations`** inserts from a single authenticated-less POST. |

---

## 9. Operator impersonation risks

| Issue | Current behavior |
|-------|------------------|
| **Body `operator_id`** | **`whatsapp-operator-reply`** accepts optional **`operator_id`**; **logs to console only** — **not** stored on **`whatsapp_messages`** in the shown insert payload. **No server-side bind** to `auth.uid()`. |
| **UI passes `user?.id`** | **`SPRINT_C2_READINESS_REPORT.md`** notes inbox sends **`operator_id: user?.id`** — **client-chosen** identifier; trivially spoofable if Edge were ever trusted for identity. |
| **Outbound row attribution** | **`provider: operator_reply`** does not encode **which human** sent it in DB fields shown in code. |
| **Future TOOL 5** | If **`operator_id` from body** were ever used for **`whatsapp_override_log.operator_id`**, that would **violate governance §6** and enable **impersonation**. |

---

## 10. Safe pilot rollout sequence (documentation-level)

1. **Freeze** new write surfaces and TOOL 5/6 persistence (per C2B memo + checklist).
2. **Inventory** production **`pg_policies`** for all `whatsapp_*` and audit tables; reconcile with **`20260518220000_*`** and worksheet **W.6** (`SPRINT_C2B_POLICY_GOVERNANCE_RECONCILIATION_PACK.md` §3).
3. **Decision record** per Edge slug: intended caller, **`verify_jwt`** target, mitigations if it stays `false`.
4. **Staging** — apply **RLS / JWT** changes first; run **e2e** webhook, stitcher, operator reply, automation with **test providers**.
5. **Pilot cohort** — limit **operator reply** to a **small staff set** + monitoring (`debug_webhooks`, `whatsapp_messages`, provider dashboards).
6. **Expand** only after **checklist §10** in reconciliation pack (go/no-go) is green for the specific change set.

---

## 11. Staging-only gates (before production toggles)

| Gate | Rationale |
|------|-----------|
| **Schema parity** | Audit tables + constraints (`priority_check`, FKs) match **signed** migration intent. |
| **RLS `TO` role targets** | Resolve **`{public}` vs `authenticated`** questions for packets and audit tables. |
| **`verify_jwt` flip dry-run** | Confirm **`functions.invoke` with session** still succeeds; document **cron / webhook** callers that **cannot** send user JWT (they need **service** pattern or separate slug). |
| **Webhook signature tests** | Prove invalid signatures rejected **before** DB writes where applicable. |
| **Stitcher load test** | Large batch + concurrent webhook; verify **no duplicate packets** / orphan fragments. |
| **Operator reply abuse simulation** | Attempt unauthenticated or cross-role invoke on staging keys; expect **403** after hardening. |

---

## 12. Preconditions before ANY production write expansion

Aligned with **`docs/SPRINT_C2B_POLICY_GOVERNANCE_RECONCILIATION_PACK.md` §10**, **`docs/SPRINT_C2B_EXECUTION_CHECKLIST.md`**, and **`docs/SPRINT_C2B_UNBLOCK_DECISION_MEMO.md`**:

1. **Product + engineering sign-off** on TOOL 5 field list, TOOL 6 persistence default, and audit table contracts.
2. **Migration history reconciliation** acceptable per **`SUPABASE_RECONCILIATION_EXECUTION_STRATEGY.md`** §4 — **no blind `repair` / push**.
3. **RLS posture signed off** — packets, stitched parallel table (if used), **`whatsapp_override_log`**, buffer, config, **storage** policies.
4. **JWT plan signed off** — which slugs are **`verify_jwt = true`**, which remain **`false`** with **written** compensating controls.
5. **Edge authority map** updated for **staging + prod** (who can call, from where).
6. **Identity discipline** — no trusted **`operator_id`** from body on any mutator; **`auth.uid()`**-backed audit for human actions.
7. **Staging apply + e2e** passed for the **exact** migration/Edge bundle intended for prod.
8. **Monitoring / rollback** — feature flags or deploy order so **operator** and **webhook** paths can be **reverted** independently.

**Explicit no-go:** Expanding **browser-reachable** write paths, adding **TOOL 5** persistence, or broadening **`send-whatsapp`** side effects **while** **`verify_jwt = false`** and **body identity** patterns remain on operator paths **without** security sign-off.

---

## Cross-reference index

| Topic | Document |
|-------|----------|
| Policy inventory & Edge table | `docs/SPRINT_C2B_POLICY_GOVERNANCE_RECONCILIATION_PACK.md` |
| TOOL 5/6 principles & JWT | `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` |
| Architecture map & write surfaces | `docs/SPRINT_C2_READINESS_REPORT.md` |
| C2B allowed/blocked scope | `docs/SPRINT_C2B_UNBLOCK_DECISION_MEMO.md`, `docs/SPRINT_C2B_EXECUTION_CHECKLIST.md` |
| Read-only inbox plan | `docs/SPRINT_C2B_READ_ONLY_IMPLEMENTATION_PLAN.md` |
| Audit DDL + RLS intent | `supabase/migrations/20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` |

---

*End of C2C preparation audit. Next steps: engineering review, staging validation, then gated implementation — not part of this document.*
