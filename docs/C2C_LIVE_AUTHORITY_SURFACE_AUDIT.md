# C2C — Live authority surface audit

**Method:** Read-only inspection of `supabase/functions/*`, `supabase/config.toml`, `src/components/WhatsAppInbox.tsx`, `src/components/whatsapp/*`, `src/pages/*` (invoke grep), `src/hooks/*` (no invokes found). **No code edits** in this sprint.

**Frozen reminder:** Migrations, Supabase CLI, deploy, Edge edits, new invokes, frontend writes, TOOL 5, and queue implementation remain **out of scope** per global rules. This document records **as-is** risk for governance.

---

## 1. Current live write surfaces

| Surface | Location | DB / provider writes? |
|---------|----------|------------------------|
| **`whatsapp-operator-reply`** | `supabase/functions/whatsapp-operator-reply/index.ts` | **Yes** — inserts `whatsapp_messages` (pending), calls `send-whatsapp` with **service role** bearer, updates row to delivered/failed. |
| **`send-whatsapp`** | `supabase/functions/send-whatsapp/index.ts` | **Yes** — outbound provider send; inserts `debug_webhooks`, conditional `audit_logs`, `client_interactions`, `whatsapp_messages` / contacts. |
| **`send-whatsapp-automation`** | `supabase/functions/send-whatsapp-automation/index.ts` | **Yes** — order-triggered customer messages; inserts `whatsapp_automations`; delegates to `send-whatsapp` with service key. |
| **`whatsapp-webhook`** | `supabase/functions/whatsapp-webhook/index.ts` | **Yes** — inbound pipeline; inserts/updates messages, contacts; non-blocking `fetch` to `whatsapp-message-stitcher`. |
| **`whatsapp-message-stitcher`** | `supabase/functions/whatsapp-message-stitcher/index.ts` | **Yes** — packet/fragment persistence. |
| **`whatsapp-classify-intent`** | `supabase/functions/whatsapp-classify-intent/index.ts` | **No DB writes** in function body — `select` only; returns JSON. |
| **`whatsapp-route-packet`** | `supabase/functions/whatsapp-route-packet/index.ts` | **No DB writes** — `select` + heuristic JSON. |

Other `supabase.functions.invoke` sites (not inbox): `send-whatsapp` from `src/utils/whatsapp.ts`, `src/pages/admin/OrderManagement.tsx`, `src/pages/admin/AdminSettings.tsx`; `send-email`, `notify-event`, `admin-create-draft`, `oasis-ai-chat`, ledgers, etc. — **out of inbox scope** but share the same **`verify_jwt = false` posture** in repo config where listed below.

---

## 2. Current invoke callers (inbox-focused)

| Function | Caller | File |
|----------|--------|------|
| `whatsapp-operator-reply` | Operator inbox send | `src/components/WhatsAppInbox.tsx` (`handleSendReply`) |
| `whatsapp-classify-intent` | Operator inbox classify | `WhatsAppInbox.tsx` (`handleClassifyIntent`) |
| `whatsapp-route-packet` | Operator inbox route | `WhatsAppInbox.tsx` (`handleSuggestRoute`) |

**Payloads (inbox):**

- **Reply:** `{ packet_id, contact_id, phone_number, message, operator_id?: user.id }`
- **Classify:** `{ packet_id, contact_id }`
- **Route:** `{ packet_id, contact_id, intent?: intentResult }`

**Indirect chain:** `whatsapp-operator-reply` → HTTP `POST …/functions/v1/send-whatsapp` with **`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`** (server-side from operator-reply Edge).

---

## 3. JWT expectations

### Repo configuration (`supabase/config.toml`)

The following entries are explicitly set to **`verify_jwt = false`** (as committed):

- `[functions.send-whatsapp]`
- `[functions.send-whatsapp-automation]`
- `[functions.whatsapp-operator-reply]`
- `[functions.whatsapp-classify-intent]`
- `[functions.whatsapp-route-packet]`
- Plus webhook/stitcher/OTP and other functions.

**Governance implication:** Supabase **does not** enforce JWT verification at the gateway for these functions **in this repo configuration**. Any additional auth must be **implemented inside** the function or enforced by network isolation (not observed here for public `invoke`).

### Edge runtime behavior (inspected)

- **`whatsapp-operator-reply`:** Does **not** read `Authorization` user JWT or `auth.getUser()` — constructs **service role** client only. **No binding** of `operator_id` body field to a verified JWT subject inside this function.
- **`whatsapp-classify-intent` / `whatsapp-route-packet`:** Service role client; **no JWT-derived identity** in handler.

**Expected future posture (staging pilot):** `verify_jwt = true` for operator-invoked functions **and** handler uses JWT user + RLS-scoped client (or explicit server-side authz), per blueprint docs — **not implemented** in this audit.

---

## 4. Current trust assumptions

| Assumption | Evidence | Risk |
|------------|----------|------|
| Only trusted callers hit Edge URLs | Client uses anon key + `invoke` from staff app | If `verify_jwt=false`, **anon key holders** who can reach the URL may invoke unless other controls exist (not in repo config). |
| `operator_id` is honest | Passed from React `user?.id` | Spoofable if function trusts body over JWT. |
| `packet_id` / `contact_id` belong to tenant | Service role bypasses RLS | **IDOR** risk if caller can guess UUIDs and network allows. |
| Classify/route are harmless | No writes in those two functions | Still **data exfiltration** / cost if abused at scale. |
| `send-whatsapp` only called from other trusted functions | Also `verify_jwt=false` | **Direct** `send-whatsapp` invocation could spam if exposed. |
| Provider retry is safe | `sendWithFallback` loops `maxRetries` per provider (`send-whatsapp/index.ts`) | **Duplicate customer SMS/WhatsApp** risk on partial failure / ambiguous provider ack (needs idempotency keys at provider + DB level). |

---

## 5. Missing guarantees (vs C2C blueprint)

- **Gateway JWT verification** for operator/classify/route/send paths (currently `verify_jwt=false` in config).
- **Authoritative actor** from JWT (`auth.uid()` / `sub`) enforced in Edge for operator reply.
- **Packet version / optimistic locking** on operator reply path.
- **Idempotency-Key** across operator-reply → send-whatsapp → provider.
- **Correlation IDs** end-to-end (webhook → stitcher → operator reply is not unified in code read).
- **Explicit role allowlist** inside Edge (not present in inspected handlers).

---

## 6. Missing auditability

| Path | Current observability |
|------|-------------------------|
| **Operator reply success** | Console logs; DB row on `whatsapp_messages`; no dedicated immutable append-only audit table in this handler. |
| **Operator reply failure** | Updates `whatsapp_messages` to `failed` + `failure_reason`. |
| **send-whatsapp** | `debug_webhooks` insert; `audit_logs` on failure path only; optional `client_interactions` / `whatsapp_messages` when `order_id` present. |
| **Classify / route** | `console.error` on failures; no structured audit row. |

**Gap vs C2C docs:** No guaranteed **append-only audit** for every attempt (success or deny) on operator/classify/route.

---

## 7. Missing idempotency

- **`whatsapp-operator-reply`:** No idempotency key in request body or dedupe store read in code.
- **`send-whatsapp`:** Retries within function for provider flakiness; **no** idempotency key visible at Edge boundary for duplicate POST suppression.
- **Automation:** `send-whatsapp-automation` inserts automation rows — separate idempotency story for triggers (not fully audited here).

---

## 8. Race-condition exposure

- **Operator UI:** `selectedPacketIdRef` guards classify/route async results — good for **UI** races, not server races.
- **Operator reply:** No `expected_version` / `updated_at` check before insert; concurrent replies could interleave with stitcher closing/updating packet.
- **Realtime + send:** `loadPackets({ silent: true })` after send may race with user still typing — UX-level, not server conflict handling.

---

## 9. Queue / retry risks

- **No durable queue** in inbox path; **debounced realtime** reload in `WhatsAppInbox.tsx` (`REALTIME_RELOAD_DEBOUNCE_MS`).
- **`send-whatsapp`:** Provider-level retry loops (`maxRetries` default 2 per provider block) — risk of **duplicate sends** if provider accepts first attempt but response is lost (classic distributed systems issue) unless provider idempotency exists.
- **`send-whatsapp-automation`:** Order lifecycle automation — separate blast radius from inbox; uses service role to call `send-whatsapp`.

---

## 10. Current “safe enough for read-only era” assumptions

1. **Staff-only routes** — Admin layout + `RoleProtectedRoute` reduce who loads `WhatsAppInbox` in SPA (not a substitute for Edge JWT).  
2. **Classify/route** return suggestions only — lower blast radius than reply.  
3. **Inbox CSV / notes / views** remain client-only — not authority-bearing.  
4. **Observability strip** is read-only and degrades gracefully.  
5. **Org process** assumes Edge URLs are not widely leaked and keys are rotated if exposed.

These assumptions are **organizational**, not cryptographic.

---

## 11. Why production write expansion remains frozen

- **Config + code** show **`verify_jwt=false`** and **service-role-first** handlers for operator-facing functions — misaligned with C2C **JWT + RLS + audit** target state.  
- **No idempotency / versioning** on operator reply path.  
- **Operator identity** not cryptographically bound in Edge for reply.  
- **Automation and send-whatsapp** share the same trust model — expanding writes without reconciling contracts increases blast radius.

---

## 12. Required conditions before staging pilot

Cross-reference: `docs/C2C_STAGING_WRITE_PILOT_MASTER_PLAN.md` §6 and `docs/C2C_PRE_IMPLEMENTATION_AUTHORITY_CHECKLIST.md` (this branch).

Minimum **design-approved** items before **any** staging write pilot:

1. **Decision** on `verify_jwt` and in-function auth pattern per function.  
2. **Threat-model mitigations** for IDOR, duplicate send, and audit gaps (`docs/C2C_WRITE_PATH_THREAT_MODEL.md`).  
3. **Contract doc** signed off (`docs/C2C_EDGE_CONTRACT_RECONCILIATION.md`).  
4. **Operator matrix** aligned with roles (`docs/C2C_OPERATOR_AUTHORITY_MATRIX.md`).  
5. **Dependency graph** ordering respected (`docs/C2C_STAGING_PILOT_DEPENDENCY_GRAPH.md`).

**No staging pilot execution** is authorized by this document alone — authority sign-off required.
