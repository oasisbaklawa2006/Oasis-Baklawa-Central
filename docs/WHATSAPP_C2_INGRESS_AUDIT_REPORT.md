# WhatsApp C2 Ingress Safety Audit Report (PR-WA-01)

**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/wa-01-read-only-safety-audit-d522`  
**Date:** 2026-06-02  
**Scope:** Documentation-only safety audit before WhatsApp automation implementation.  
**Evidence source:** Repo inspection on `main` (HEAD includes PR #156 barcode ingest; unrelated to this audit).  
**Not verified in this audit:** Remote Supabase deploy state, production traffic, secret rotation, or live `functions list` on any project ref.

---

## 1. Executive summary

Oasis Central runs **three overlapping WhatsApp intake pipelines** plus multiple outbound paths. All WhatsApp-related Edge Functions in `supabase/config.toml` have **`verify_jwt = false`**. Most handlers use **`SUPABASE_SERVICE_ROLE_KEY`**, bypassing RLS.

**Strongest safe surface:** Operator inbox **read path** (`WhatsAppInbox.tsx` PostgREST `select` + TOOL 3/4 suggestion invokes that do not persist routing decisions).

**Highest blast radius:** `whatsapp-webhook` (inbound provider callback) — can create/update `orders`, `order_items`, `companies`, notifications, and trigger stitcher + Banyan buffer without operator JWT at the Edge gate.

**Audit tables** `whatsapp_override_log` and `whatsapp_suggestions_log` exist in migrations (`20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql`) but have **zero writes** from application or Edge code in this repo (grep confirmed: migration + docs only).

**C2C posture (cross-reference):** `docs/C2C_EXECUTIVE_READINESS_SCORECARD.md` rates staging **write pilot NOT ready** (JWT RED, idempotency RED, Edge trust model RED). This audit aligns with that scorecard.

---

## 2. Edge function inventory

All entries below are from `supabase/config.toml` unless noted. **JWT hardening needed** = user- or browser-callable today with `verify_jwt = false` and no compensating HMAC/API-key gate in handler (per `docs/C2C_WRITE_PATH_THREAT_MODEL.md`).

| Function | `verify_jwt` | Service role | Purpose | Read paths | Write paths | Idempotency | Audit logging | Rating |
|----------|--------------|--------------|---------|------------|-------------|-------------|---------------|--------|
| `whatsapp-webhook` | `false` | Yes | Inbound provider webhook; ingest, classify, AI order parse, side effects | `users`, `products`, `product_aliases`, `orders` (select) | **Extensive:** `debug_webhooks`, `whatsapp_buffer`, `whatsapp_messages`, `whatsapp_contacts`, `orders`, `order_items`, `companies`, `notifications`, `client_interactions`, `ledger_disputes`, `bi_monthly_ledgers`, storage | **Partial:** WAMID dedup via `debug_webhooks.wamid` early discard | `debug_webhooks` rows; not structured override/suggestion audit | **RED** |
| `whatsapp-message-stitcher` | `false` | Yes | TOOL 0 — stitch raw inbound into packets | `whatsapp_messages` (unstitched inbound) | `whatsapp_message_packets` insert; `whatsapp_messages` update (`packet_id`, etc.) | **Absent** (re-stitch risk if invoked twice) | None | **AMBER** |
| `whatsapp-operator-reply` | `false` | Yes | TOOL 1 — operator outbound reply | — | `whatsapp_messages` insert/update; internal `fetch` → `send-whatsapp` with service bearer | **Absent** (no `Idempotency-Key`; duplicate click = duplicate send risk) | Logs `operator_id` to console only; no `whatsapp_override_log` | **RED** |
| `whatsapp-identify-sender` | `false` | Yes | TOOL 2 — sender classification | `users`, `whatsapp_contacts` | None | N/A | None | **GREEN** |
| `whatsapp-classify-intent` | `false` | Yes | TOOL 3 — intent suggestion | `whatsapp_messages` | None (JSON response only) | N/A | None | **GREEN** |
| `whatsapp-route-packet` | `false` | Yes | TOOL 4 — routing suggestion | `whatsapp_message_packets` | None (JSON response only) | N/A | None | **GREEN** |
| `whatsapp-otp` | `false` | Yes | Login OTP via WhatsApp | `users`, `b2b_applications`, `app_settings` | `app_settings` upsert/delete (OTP store) | **Partial** (in-memory + DB OTP keys; not message-idempotency) | None | **AMBER** |
| `send-whatsapp` | `false` | Yes | Outbound provider send (Click2API + MSG91 fallback) | — | Provider API; `debug_webhooks`, optional `audit_logs` (failure), `client_interactions`, `whatsapp_contacts`, `whatsapp_messages` | **Absent** | `debug_webhooks`; `audit_logs` on failure only | **RED** |
| `send-whatsapp-automation` | `false` | Yes | Lifecycle triggers (`so_created`, `payment_verified`, etc.) | `orders` | `whatsapp_automations` insert; invokes `send-whatsapp` | **Absent** | `whatsapp_automations` row only | **RED** |
| `banyan-central-parser` | `false` | Yes | Cron/buffer flush; Vision AI → suggested orders | `whatsapp_buffer`, `companies`, `products` | `whatsapp_buffer` update; `suggested_orders`, `shadow_clients`, `companies` insert/update | **Not verified** in handler (buffer status updates) | None | **RED** |
| `admin-create-draft` | `false`* | Yes | Human-promoted draft order from War Room / intelligence | `users`, `companies`, `products`, `orders` | `orders`, `order_items`, `companies`, `users`; optional `send-whatsapp` invoke; `debug_webhooks` update | **Yes:** WAMID → existing `orders.wamid` short-circuit | JWT + role gate in handler; WAMID dedup | **AMBER** |

\* `admin-create-draft` has **`verify_jwt = false` in config** but the handler **requires `Authorization` Bearer** and validates user role (`ADMIN` / `SUPER_ADMIN`) — compensating control, not platform JWT verification.

**Related (not WhatsApp-named but invoked on order/comms paths):**

| Function | WhatsApp relevance | Rating |
|----------|-------------------|--------|
| `notify-event` | May include WA audience | **AMBER** — not inventoried line-by-line in this audit |
| `oasis-ai-chat` | War Room alias assist (`AliasDrawer.tsx`) | **AMBER** — separate from WA ingress |

---

## 3. Frontend write path inventory

### 3.1 Operator inbox (Pipeline A UI)

| File | Mechanism | Tables / functions | Rating |
|------|-----------|-------------------|--------|
| `src/components/WhatsAppInbox.tsx` | `select` on `whatsapp_message_packets`, batched `whatsapp_messages`; Realtime subscribe | Read only | **GREEN** |
| `src/components/WhatsAppInbox.tsx` | `invoke("whatsapp-operator-reply")` | → Edge writes + send | **RED** |
| `src/components/WhatsAppInbox.tsx` | `invoke("whatsapp-classify-intent")` | Read-only Edge | **GREEN** |
| `src/components/WhatsAppInbox.tsx` | `invoke("whatsapp-route-packet")` | Read-only Edge | **GREEN** |
| `src/components/whatsapp/*` helpers | Select/counts, localStorage UI state | Read / local only | **GREEN** |
| `src/pages/OperatorInbox.tsx` | Wrapper | — | **GREEN** |

Cross-reference: `docs/WHATSAPP_READ_ONLY_GUARDRAIL_AUDIT.md` — post–PR #66 inbox tree has **no direct PostgREST writes** except invokes above.

### 3.2 CMD War Room

| File | Mechanism | Rating |
|------|-----------|--------|
| `src/pages/admin/CMDWarRoom.tsx` | `select` count on `whatsapp_message_packets` | **GREEN** |
| `src/pages/admin/CMDWarRoom.tsx` | Direct `orders` update (duplicate flag, company_id, status submitted) | **RED** (bypasses governed draft path; no override audit) |
| `src/components/warroom/SuggestedOrdersTab.tsx` | `select` `suggested_orders`; `invoke("admin-create-draft")`; `update` suggested_orders | **AMBER** (promotion via JWT-gated Edge); status updates via client |
| `src/components/warroom/RawIntelligenceTab.tsx` | `select` debug_webhooks/orders; direct company/order/debug_webhooks updates; `invoke("admin-create-draft")` | **RED** (mixed read + ungoverned client writes) |
| `src/components/warroom/ShadowClientSection.tsx` | Extensive client-side `companies`/`users`/`orders`/`debug_webhooks` mutations; `invoke("admin-create-draft")` | **RED** |
| `src/components/warroom/WarRoomOrderCard.tsx` | `order_items`, `companies`, `b2b_applications`, `orders` updates | **RED** |
| `src/components/warroom/AliasDrawer.tsx` | `products`/`product_aliases` insert/update; `invoke("oasis-ai-chat")` | **AMBER** (catalogue teaching, not WA send) |

### 3.3 Central Order Pool (Pipeline B UI)

| File | Mechanism | Rating |
|------|-----------|--------|
| `src/pages/admin/CentralOrderPool.tsx` | `select` `suggested_orders`, `companies` | **GREEN** |
| `src/pages/admin/CentralOrderPool.tsx` | **`orders` + `order_items` direct insert** on confirm (no `admin-create-draft`, no WAMID) | **RED** |
| `src/pages/admin/CentralOrderPool.tsx` | `update` `suggested_orders` | **AMBER** |

### 3.4 Other frontend WhatsApp invokes

| File | Invoke | Rating |
|------|--------|--------|
| `src/utils/whatsapp.ts` | `send-whatsapp` | **RED** |
| `src/pages/admin/OrderManagement.tsx` | `send-whatsapp` | **RED** |
| `src/pages/admin/AdminSettings.tsx` | `send-whatsapp` (test send) | **RED** |
| `src/components/SupportChat.tsx` | Logs callback intent only (no invoke) | **GREEN** |

**Not found in repo:** `src/` callers of `send-whatsapp-automation`, `whatsapp-identify-sender`, or `banyan-central-parser` (cron/server-triggered).

---

## 4. DB table touch map by path

### 4.1 `whatsapp_messages`

| Path | Operations |
|------|------------|
| `whatsapp-webhook` | insert (raw inbound) |
| `whatsapp-message-stitcher` | select unstitched; update link to packet |
| `whatsapp-operator-reply` | insert outbound; update status |
| `send-whatsapp` | insert (outbound log path) |
| `WhatsAppInbox` / observability | select |
| `whatsapp-classify-intent` | select |

### 4.2 `whatsapp_message_packets`

| Path | Operations |
|------|------------|
| `whatsapp-message-stitcher` | insert |
| `WhatsAppInbox` / CMDWarRoom | select (+ Realtime) |
| `whatsapp-route-packet` | select |

### 4.3 `suggested_orders`

| Path | Operations |
|------|------------|
| `banyan-central-parser` | insert |
| `CentralOrderPool`, War Room tabs | select, update |
| **Not wired:** inbox packets → suggested_orders | **Gap (duplicate pipeline risk)** |

### 4.4 `orders` / `order_items`

| Path | Operations |
|------|------------|
| `whatsapp-webhook` | insert/update/delete items (AI parse, clarification, cancel stale) |
| `admin-create-draft` | insert orders + items (WAMID dedup) |
| `CentralOrderPool.handleConfirm` | **direct insert** (no WAMID) |
| War Room components | update/insert various |
| `send-whatsapp-automation` | read for message content |

### 4.5 `client_interactions`

| Path | Operations |
|------|------------|
| `whatsapp-webhook` | insert |
| `send-whatsapp` | insert (when `company_id` present) |

### 4.6 Audit / override tables

| Table | App/Edge writes in repo | Notes |
|-------|-------------------------|-------|
| `whatsapp_override_log` | **None** | Schema + RLS in `20260518220000_*`; TOOL 5 not implemented |
| `whatsapp_suggestions_log` | **None** | TOOL 3/4 suggestions not persisted |
| `debug_webhooks` | webhook, send-whatsapp, war room | Operational trace, not governance audit |
| `audit_logs` | send-whatsapp failures only | Partial |

---

## 5. Duplicate pipeline risks

```text
Pipeline A (Operator Inbox):
  whatsapp-webhook → whatsapp_messages → whatsapp-message-stitcher → whatsapp_message_packets
  → WhatsAppInbox (read) → whatsapp-operator-reply → send-whatsapp

Pipeline B (Central Pool / Banyan):
  whatsapp-webhook → whatsapp_buffer → [pg_cron] banyan-central-parser → suggested_orders
  → CentralOrderPool / War Room → orders (direct OR admin-create-draft)

Pipeline C (Webhook auto-intake):
  whatsapp-webhook → aiParseOrder / order branches → orders + order_items directly
  (parallel to human promotion; highest governance risk)
```

**Risk:** Same inbound message can fan out to **buffer**, **messages**, **debug_webhooks**, and **orders** without a single canonical “intake record.” Operators may see Pipeline A in inbox while Pipeline B/C create orders elsewhere.

**Evidence:** `triggerMessageStitcherNonBlocking()` in `whatsapp-webhook/index.ts` (~line 791); Banyan cron in `20260417113513_*` migration (per `docs/SPRINT_C2_READINESS_REPORT.md`).

---

## 6. RAG summary per path

| Path | Rating | Rationale |
|------|--------|-----------|
| Inbox packet/message load + Realtime | **GREEN** | Select-only; documented in guardrail audit |
| TOOL 3 `whatsapp-classify-intent` | **GREEN** | No DB writes |
| TOOL 4 `whatsapp-route-packet` | **GREEN** | No DB writes |
| TOOL 2 `whatsapp-identify-sender` | **GREEN** | No DB writes (not yet invoked from inbox UI) |
| TOOL 0 stitcher (server-triggered) | **AMBER** | Required for inbox; writes without idempotency; JWT off |
| `admin-create-draft` (War Room invoke) | **AMBER** | JWT+role in handler; WAMID dedup; config JWT off |
| `whatsapp-otp` | **AMBER** | Auth path; not order intake |
| War Room read-only selects | **GREEN** | When no action buttons used |
| War Room / Shadow / Raw intelligence client writes | **RED** | Direct mutations, no override audit |
| `CentralOrderPool` confirm | **RED** | Bypasses governed draft + WAMID |
| `whatsapp-operator-reply` | **RED** | Customer-visible send; no idempotency |
| `send-whatsapp` (browser invoke) | **RED** | JWT off; duplicate send risk |
| `whatsapp-webhook` order/company branches | **RED** | Unattended writes at scale |
| `banyan-central-parser` | **RED** | Unattended suggested_orders creation |
| `send-whatsapp-automation` | **RED** | Callable; no app wiring; no idempotency |

---

## 7. Exact unsafe write paths (must not expand before idempotency + JWT/HMAC)

1. **`whatsapp-webhook`** — autonomous `orders` / `order_items` / `companies` mutations (Pipeline C).
2. **`whatsapp-operator-reply`** — outbound customer messages without idempotency key.
3. **Browser `send-whatsapp`** — `OrderManagement.tsx`, `AdminSettings.tsx`, `utils/whatsapp.ts`.
4. **`CentralOrderPool.handleConfirm`** — direct `orders` insert without `admin-create-draft` or WAMID.
5. **War Room direct SQL writes** — `ShadowClientSection.tsx`, `RawIntelligenceTab.tsx`, `WarRoomOrderCard.tsx`, `CMDWarRoom.tsx` order mutations.
6. **`send-whatsapp-automation`** — if enabled without dedupe store (not wired from `src/` today but deployed slug exists).
7. **Any future TOOL 5** — must not ship without `whatsapp_override_log` transactional insert (per `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md`).

---

## 8. Exact safe read-only paths (staging read pilot)

Per `docs/C2C_CURRENT_SAFE_BOUNDARY.md` and `docs/WHATSAPP_READ_ONLY_GUARDRAIL_AUDIT.md`:

1. **`/admin/operator-inbox`** and **`/admin/whatsapp`** — load open packets, messages, observability strip.
2. **`invoke("whatsapp-classify-intent")`** and **`invoke("whatsapp-route-packet")`** — suggestions only; do not persist results.
3. **`invoke("whatsapp-identify-sender")`** — safe to add as read-only enrichment (handler is select-only).
4. **CMD War Room** — packet count query; tab **read** of `suggested_orders` / `debug_webhooks` without confirm/promote actions.
5. **Central Order Pool** — list/filter `suggested_orders` without Confirm/Reject actions.
6. **localStorage** inbox features (filters, notes, saved views) — non-authoritative.

---

## 9. Forbidden until idempotency / JWT (or equivalent) fixed

From `docs/C2C_EXECUTIVE_READINESS_SCORECARD.md` (JWT RED, idempotency RED, Edge trust RED):

| Function / surface | Blocker |
|--------------------|---------|
| `whatsapp-operator-reply` | No end-to-end idempotency; JWT off; service role |
| `send-whatsapp` | JWT off; browser callable |
| `send-whatsapp-automation` | JWT off; no dedupe |
| `whatsapp-webhook` (write branches) | Unattended order creation |
| `banyan-central-parser` | Unattended intake |
| `CentralOrderPool` confirm | Ungoverned order insert |
| War Room promote/mutate without audit | No `whatsapp_override_log` |
| TOOL 5 override UI | Explicitly RED in scorecard |

**Compensating exception (narrow):** `admin-create-draft` may be used in **controlled staging** with human operator + JWT bearer + WAMID only after written GO per `docs/C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md` — still **AMBER**, not GREEN.

---

## 10. Functions needing JWT hardening (config + handler)

All WhatsApp slugs in `supabase/config.toml` list `verify_jwt = false`. Priority hardening candidates for **browser-invoked** paths:

| Priority | Function | Recommended control |
|----------|----------|---------------------|
| P0 | `whatsapp-operator-reply` | Enable JWT verification **or** HMAC; derive actor from JWT sub; idempotency key |
| P0 | `send-whatsapp` | Block anon invoke; JWT + role; idempotency; rate limits |
| P1 | `admin-create-draft` | Set `verify_jwt = true` (handler already validates token) |
| P1 | `whatsapp-classify-intent`, `whatsapp-route-packet`, `whatsapp-identify-sender` | JWT on invoke (read-only but prevents abuse) |
| P2 | `whatsapp-message-stitcher` | Internal-only secret header; not browser callable |
| P2 | `whatsapp-webhook`, `banyan-central-parser` | Provider signature / cron secret (not JWT) |
| P3 | `send-whatsapp-automation` | Disable public invoke until worker + idempotency store |

---

## 11. Functions that must not be used before idempotency

| Function | Reason |
|----------|--------|
| `whatsapp-operator-reply` | Duplicate outbound messages on retry/double-click |
| `send-whatsapp` | Same |
| `send-whatsapp-automation` | Lifecycle duplicate notifications |
| `whatsapp-webhook` (auto-order) | Duplicate orders unless WAMID path always hit (not guaranteed across pipelines) |
| Browser direct `orders` insert (`CentralOrderPool`) | No message-level dedup |

**Partial idempotency today:**

- `whatsapp-webhook`: WAMID check on `debug_webhooks` before processing.
- `admin-create-draft`: WAMID check on `orders.wamid`.

These do **not** cover operator replies or Pool B direct inserts.

---

## 12. Recommended gating order (WA-02 → WA-07)

Aligned with Priority 1 roadmap; each step assumes prior step’s safety gates documented.

| Step | PR slice | Prerequisite | Safe to proceed when |
|------|----------|--------------|----------------------|
| **WA-02** | Customer identity resolution | WA-01 complete | `whatsapp-identify-sender` invoked read-only from inbox; no new writes |
| **WA-03** | Product extraction from chat | WA-02 + catalogue aliases | Read-only alias/product lookup service; no order rows |
| **WA-04** | AI order draft creation | WA-03 | **Only** `admin-create-draft` path; webhook auto-draft feature-flagged off in staging |
| **WA-05** | Quote draft creation | WA-04 | Separate status/table; no finance dispatch side effects |
| **WA-06** | Human approval screen | WA-04/05 | Unified UI; **retire** `CentralOrderPool` direct insert |
| **WA-07** | Order conversion | WA-06 | Idempotency keys on all promotes; JWT hardened on draft/send |

**Do not start WA-04 until:** written staging isolation proof (`docs/C2C_STAGING_ISOLATION_CHARTER.md`) and duplicate-send metric plan exist.

---

## 13. Cross-reference index

| Document | Relevance |
|----------|-----------|
| `docs/C2C_EXECUTIVE_READINESS_SCORECARD.md` | JWT/idempotency RED; staging write pilot not ready |
| `docs/C2C_CURRENT_SAFE_BOUNDARY.md` | SAFE vs NOT SAFE lists |
| `docs/WHATSAPP_READ_ONLY_GUARDRAIL_AUDIT.md` | Inbox read-only contract post–PR #66 |
| `docs/SPRINT_C2_READINESS_REPORT.md` | TOOL 0–4 map, write surfaces |
| `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` | TOOL 5 + audit table requirements |
| `docs/SPRINT_C2B_EXECUTION_CHECKLIST.md` | PR guardrails (no new persistence without review) |
| `docs/C2C_WRITE_PATH_THREAT_MODEL.md` | Threat severity (JWT bypass Critical) |
| `docs/SUPABASE_WHATSAPP_SCHEMA_INTROSPECTION_RESULTS.md` | Prod table/RLS catalog for audit tables |
| `docs/WHATSAPP_OPERATOR_INBOX_LOCAL_FEATURES_AUDIT.md` | localStorage-only features |

---

## 14. PR-WA-01 deliverable checklist

| Task | Status |
|------|--------|
| Edge function inventory | Done (§2) |
| Frontend write path inventory | Done (§3) |
| DB table map | Done (§4) |
| C2C cross-reference | Done (§13) |
| RED/AMBER/GREEN ratings | Done (§6) |
| Unsafe vs safe path lists | Done (§7–8) |
| Idempotency / JWT gating | Done (§9–11) |
| Duplicate pipeline risks | Done (§5) |
| WA-02–WA-07 gating order | Done (§12) |
| Code/runtime changes | **None** (docs only) |

---

## 15. Next PR

Proceed to **WA-02** only after this report is reviewed. Suggested next implementation PR: wire **`whatsapp-identify-sender`** read-only enrichment in inbox (no persistence, no new Edge slugs) — see program prompt in mega roadmap §G.

---

*End of report. Documentation-only; no Edge deploy, no migration, no `verify_jwt` changes in this PR.*
