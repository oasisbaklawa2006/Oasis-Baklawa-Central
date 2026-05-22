# C2C — Repo-wide write surface inventory

**Scope:** Static inspection of `src/` and `supabase/functions/` (read-only audit). No runtime changes.

**Date context:** Pre–staging write pilot; production write expansion remains intentionally frozen at the governance layer.

---

## 1. Every current `supabase.functions.invoke` (client / `src`)

| Location | Function name | Notes |
|----------|---------------|--------|
| `src/components/WhatsAppInbox.tsx` | `whatsapp-operator-reply` | Operator outbound reply path |
| `src/components/WhatsAppInbox.tsx` | `whatsapp-classify-intent` | Suggestion-only classify |
| `src/components/WhatsAppInbox.tsx` | `whatsapp-route-packet` | Suggestion-only route |
| `src/utils/whatsapp.ts` | `send-whatsapp` | Shared helper for outbound WA (B2B / ops flows) |
| `src/utils/notifyEvent.ts` | `notify-event` | Event notification pipeline |
| `src/utils/notificationOutbox.ts` | `send-email` | Outbox processor invokes email Edge |
| `src/pages/admin/OrderManagement.tsx` | `send-whatsapp` | Admin-triggered sends (two call sites) |
| `src/pages/admin/AdminSettings.tsx` | `send-whatsapp` | Test / config confirmation |
| `src/pages/admin/AdminUsers.tsx` | `send-email` | Admin email path |
| `src/pages/admin/AdminProducts.tsx` | `generate-product-attributes` | AI-ish product enrichment |
| `src/components/admin/LedgerDisputesPanel.tsx` | `generate-bi-monthly-ledger` | Ledger generation trigger |
| `src/components/warroom/SuggestedOrdersTab.tsx` | `admin-create-draft` | Draft order creation |
| `src/components/warroom/ShadowClientSection.tsx` | `admin-create-draft` | Draft order creation |
| `src/components/warroom/RawIntelligenceTab.tsx` | `admin-create-draft` | Draft order creation |
| `src/components/warroom/AliasDrawer.tsx` | `oasis-ai-chat` | Chat / alias assistance |
| `src/pages/Register.tsx` | `notify-event` | Post-registration notification |
| `src/pages/PublicOrderTracking.tsx` | `public-order-tracking` | Public tracking (also comments on query-param limits) |
| `src/pages/Login.tsx` | `msg91-otp` | OTP verification |

**`src/hooks/`:** No `functions.invoke` matches in the current tree (grep).

**Edge-to-Edge (not client `invoke`, but live write coupling):** `whatsapp-operator-reply` performs an internal `fetch` to `…/functions/v1/send-whatsapp` with the **service role** bearer (server-side chain).

---

## 2. Every current DB write surface (high level)

### 2.1 Client (`src`) — `.insert(` / `.update(` / `.delete(`

There are **many** direct PostgREST writes across admin, B2B portal, war room, factory, finance, cart, registration, and support surfaces. Representative categories:

- **Orders & items:** status transitions, attachments, packing, dispatch, MOQ, central pool, war room cards, cart / checkout.
- **Finance & wallets:** `AdminFinance`, `AdminAccountsRelease`, `FinanceReleaseBoard`, payments, commissions, credit, ledger-adjacent UI.
- **Catalog & merchandising:** products, variants, BOM, tags, pricing, MOQ rules.
- **Users & access:** profiles, roles, permissions, invites, impersonation-adjacent flows.
- **Operations & inventory:** factory inventory, production jobs, daily logs, RGS / PHH modules, floor tablet.
- **Comms & notifications:** `notification_outbox` insert + status updates; various `audit_logs` inserts (often best-effort / fire-and-forget patterns exist in components).
- **WhatsApp operator read model:** `WhatsAppInbox` reads `whatsapp_message_packets` / messages; **writes** for operator path are via Edge (`whatsapp-operator-reply`), not direct table inserts from this component.

**RPC from client (`src`):** `increment_announcement_counter`, `log_cart_failure`, `restore_order_financials`, `is_internal_staff`, `get_user_role` — each implies server-side logic and must be governed separately from raw table writes.

### 2.2 Edge (`supabase/functions`)

Heavy writers include:

- **`whatsapp-webhook`:** Large branching insert/update/delete surface (orders, items, notifications, buffer, disputes, debug tables, etc.).
- **`send-whatsapp`:** Provider send + `debug_webhooks`, conditional `audit_logs`, `client_interactions`, optional `whatsapp_contacts` / `whatsapp_messages` rows (`retry_count` field initialized to `0` on insert — not an active multi-hop retry worker).
- **`whatsapp-operator-reply`:** Inserts outbound `whatsapp_messages` (pending), updates to delivered/failed, chains to `send-whatsapp`.
- **`whatsapp-message-stitcher`:** Packet / message persistence.
- **`send-whatsapp-automation`:** Automation run records (`whatsapp_automations` inserts).
- **`notify-event`:** Audit + outbound comms orchestration.
- **`send-email`:** Outbox status updates after send attempts.
- **`admin-create-draft`:** Orders / items / related rows; may delete draft on failure paths.
- **`banyan-central-parser`:** Suggested orders + bundle status updates (comment references **pg_cron** trigger interval).
- **`generate-bi-monthly-ledger` / `generate-rescue-ledger`:** Ledger rows + related updates.
- **`msg91-webhook`:** Auth / notification inserts.
- **`whatsapp-otp`:** Ephemeral OTP store + `app_settings` deletes.

**Migrations (reference only — not executed in this sprint):** SQL migrations define **pg_cron** schedules (e.g. bi-monthly ledger, banyan buffer flush). These are **database-level automation triggers**, not application loops, but they materially affect when Edge receives traffic.

---

## 3. Every queue / automation surface

| Surface | Mechanism | Notes |
|---------|-----------|--------|
| `notification_outbox` + `processOutboxQueue` | Client-driven batch: select pending, invoke `send-email`, update row status | Requires **active user session**; not a headless worker; duplicate processing risk if two admins run concurrently |
| `NotificationsPanel` / `AdminNotifications` | Realtime + manual refresh on outbox | Observability / ops UI, not a durable queue worker |
| **pg_cron → HTTP Edge** (migrations) | Scheduled calls into Edge functions | Platform-level automation; separate trust boundary from UI |
| `banyan-central-parser` | Cron-invoked buffer flush | Commented as ~30s cron / 60s buffer heuristic |
| `send-whatsapp` | Click2API primary + MSG91 **provider** fallback | Single request scope; not queued retries with backoff |
| `useStableSubscription` | WebSocket reconnect with **10s** backoff timer | Client resubscribe, not message resend |
| Various `setInterval` UIs | Polling (Factory TV, dashboards, floor tablet, etc.) | Read-heavy; still relevant for **stale state vs server truth** |

---

## 4. Current retry semantics

- **`send-whatsapp`:** **Provider-level** fallback (Click2API then MSG91) within one invocation. No persisted exponential backoff queue for WA sends in this function body.
- **`whatsapp-operator-reply`:** Single attempt to `send-whatsapp`; on failure, marks `whatsapp_messages` failed with `failure_reason`. No automatic re-drive from Edge visible in the reviewed file.
- **`notification_outbox`:** On `send-email` failure, marks row `failed` with `error_log`. **No automatic retry** loop in `processOutboxQueue` beyond the single pass when invoked.
- **`whatsapp_messages.retry_count`:** Set to `0` on insert in `send-whatsapp` order-linked logging path — indicates schema readiness more than an active retry engine.

---

## 5. Current optimistic UI assumptions

- **`WhatsAppInbox`:** Reply path uses `replySending` guard; on success clears draft and **silent-refetches** packets (`loadPackets({ silent: true })`). **No** optimistic “message bubble” appended before server ack — server-truth refresh model for thread content.
- **Classify / route:** Results stored in local React state; **abandon-on-navigation** via `selectedPacketIdRef` checks to avoid applying stale suggestions.
- **Realtime:** `whatsapp_message_packets` changes debounced (~480ms) then full reload — eventual consistency; ordering vs in-flight sends not formally guaranteed in UI.
- **Outbox UI:** Assumes row state transitions `pending` → `sent` | `failed` reflect delivery truth; concurrent processors could interleave.

---

## 6. Current audit guarantees

- **Partial:** `send-whatsapp` writes `audit_logs` on **API failure** paths (high risk flagged). Success path does not symmetrically guarantee rich audit in the same block for all sub-paths.
- **Broad app pattern:** Many admin actions insert `audit_logs` from the client with `actor_id: user?.id` — **integrity depends on RLS / role enforcement** and correct client auth session.
- **`debug_webhooks`:** High-volume diagnostic sink for outbound/inbound WA plumbing — useful for ops, not a substitute for authority-grade audit trails.
- **Operator reply:** `operator_id` is accepted in JSON body and **logged to console** in Edge when present — **not** a cryptographic proof of operator identity tied to JWT inside `whatsapp-operator-reply` (function uses service role client throughout).

---

## 7. Current replay protections

- **Limited explicit idempotency:** No standard `Idempotency-Key` header pattern observed on client `invoke` calls reviewed.
- **Outbox:** Single-row updates keyed by `id` reduce duplicate **status** writes for the same row if only one processor runs; **no** lease / `FOR UPDATE SKIP LOCKED` pattern in the reviewed TS.
- **WhatsApp operator path:** Inserts a new outbound row each attempt — **double-click or double-submit can create duplicate outbound rows** unless UI disables strictly (button state) and users never retry manually without dedupe keys.
- **Cron / webhook:** External replay of webhook or cron HTTP calls could duplicate work unless handlers are internally idempotent (needs per-handler review beyond this doc).

---

## 8. Current missing protections (summary)

- **Cross-cutting:** Typed API versioning, correlation IDs on all operator/commerce writes, mandatory idempotency keys for externally visible sends.
- **Trust:** Many sensitive Edge entries have **`verify_jwt = false`** in `supabase/config.toml` (see JWT audit doc) — replay surface depends on secret URLs, network rules, and handler-internal checks (often minimal).
- **Concurrency:** Outbox processor and multi-tab admin sessions — duplicate delivery attempts.
- **Ownership:** Operator reply payload trusts `packet_id` / `contact_id` / `phone_number` from caller without server-side “operator owns packet” enforcement visible in the small `whatsapp-operator-reply` excerpt (full file still service-role based).

---

## 9. Surfaces considered “legacy tolerated”

- **Large B2B + admin PostgREST surface:** Grown organically; acceptable for **current business operations** under existing RLS/roles, but not aligned with a **minimal C2C write cone** for future pilot.
- **`debug_webhooks`:** Diagnostic volume acceptable for engineering iteration; should not be the sole incident reconstruction source for regulated comms.
- **Client-side `audit_logs` inserts:** Useful where enforced by DB policy; fragile if policies drift.

---

## 10. Surfaces explicitly frozen (governance stance)

Per program direction (this sprint mirrors that policy in documentation only):

- **C2C staging write pilot** — not started; no new write paths, migrations, CLI, deploys, or Edge edits in this workstream.
- **Production write expansion** for C2C authority-hardening goals — frozen until prerequisites in `C2C_GOVERNANCE_GAP_SUMMARY.md` and checklists are met.
- **TOOL 5** — implementation untouched by charter (docs may reference future state only).

---

## 11. Surfaces requiring authority redesign

| Area | Why |
|------|-----|
| Operator WhatsApp send cone | Publicly reachable Edge + weak JWT posture + service role + no idempotency |
| Notification outbox | Client-run “queue processor”; finance-triggered inserts without distributed lease |
| Webhook + cron drivers | External replay and ordering — needs explicit idempotency keys and dedupe stores |
| War room / admin-create-draft | High-impact order creation from power-user UI — needs staged governance |
| Finance release + wallet mutations | Blast radius on double-submit and race with dispatch |

---

## 12. Methodology note

Inventory produced via repository-wide search for:

- `supabase.functions.invoke` / `functions.invoke`
- `.insert(`, `.update(`, `.delete(`
- `.rpc(`
- Keyword scans for `cron`, `retry`, `outbox`, `setInterval` in `src` and `supabase/`

Counts drift as code changes — **re-run grep before any pilot**.
