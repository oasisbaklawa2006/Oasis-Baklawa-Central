# WhatsApp Complete Module Build Audit (PR-WA-01B)

**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Branch:** `cursor/wa-01b-complete-whatsapp-module-audit-d522`  
**Base:** `main` (HEAD at audit time: includes merged barcode ingest PRs #155–#156; unrelated to this audit)  
**Date:** 2026-06-02  
**Scope:** Documentation-only repo-level inventory of everything built for WhatsApp / order intake.  
**Evidence:** Static repo inspection (grep, file reads, migrations). **Not verified:** live Supabase deploy state, production traffic, secret rotation, remote `functions list`, or staging project isolation.

**Related prior audits (do not replace):**
- `docs/WHATSAPP_READ_ONLY_GUARDRAIL_AUDIT.md` — inbox read/write guardrails post–PR #66
- `docs/WHATSAPP_OPERATOR_INBOX_LOCAL_FEATURES_AUDIT.md` — localStorage-only inbox features
- `docs/SUPABASE_WHATSAPP_SCHEMA_INTROSPECTION_RESULTS.md` — manual SQL Editor introspection
- `docs/SPRINT_C2_READINESS_REPORT.md` — Sprint C2 function inventory
- `docs/C2C_EXECUTIVE_READINESS_SCORECARD.md` — staging/production write posture

---

## A) Executive summary

Oasis Central has a **substantial but fragmented** WhatsApp module: inbound capture, message stitching, operator inbox UI, Banyan AI parsing, War Room triage, and multiple order-promotion paths all exist in code. They were built in **parallel tracks** without a single authoritative intake → approval → order pipeline.

**Three overlapping intake pipelines** compete for the same inbound webhook:

| Pipeline | Primary path | Order outcome |
|----------|--------------|---------------|
| **A — Operator inbox** | `whatsapp-webhook` → `whatsapp_messages` → stitcher → packets → `WhatsAppInbox` | Human reply via `whatsapp-operator-reply`; no governed order creation from inbox |
| **B — Banyan parser** | `whatsapp-webhook` → `whatsapp_buffer` → cron `banyan-central-parser` → `suggested_orders` | Human promotion via War Room `admin-create-draft` **or** unsafe direct insert in `CentralOrderPool` |
| **C — Webhook auto-intake** | `whatsapp-webhook` → `aiParseOrder` → direct `orders` / `order_items` / `companies` | **Unsupervised** draft/submitted orders without operator approval |

**Security posture:** All WhatsApp Edge Functions listed in `supabase/config.toml` have **`verify_jwt = false`**. Most use **`SUPABASE_SERVICE_ROLE_KEY`**, bypassing RLS. Audit tables `whatsapp_override_log` and `whatsapp_suggestions_log` exist in migrations but have **zero application writes** in this repo.

**Strongest safe surface:** Operator inbox **read path** (PostgREST select + Realtime + TOOL 3/4 suggestion invokes that return JSON only).

**Highest blast radius:** `whatsapp-webhook` (unsupervised order creation, finance/ledger side effects, duplicate pipeline fan-out) and **ungoverned client writes** in War Room / Central Order Pool.

**Recommendation:** **Do not proceed to WA-02 implementation writes** until WA-02A identity design audit completes and Pipeline C is gated/disabled in staging. WA-01B confirms build richness but **pilot readiness remains ~15%** (safety ~20%).

---

## B) WhatsApp build completion estimate

### Module-level percentages

| Dimension | % | Rationale |
|-----------|---|-----------|
| **Frontend** | **72%** | Rich operator inbox, War Room tabs, Central Pool UI, CMD pulse — but mock customer AI surfaces and duplicate promotion UIs |
| **Backend (Edge + DB schema)** | **68%** | 11 WA-named functions + cron parser + tables/migrations present; audit logging tables unwired |
| **Integration (end-to-end coherence)** | **38%** | Three conflicting pipelines; Central Pool bypasses governed draft path; identify-sender not wired to inbox |
| **Safety (C2C / pilot)** | **20%** | JWT RED, idempotency RED, Edge trust RED per `C2C_EXECUTIVE_READINESS_SCORECARD.md` |
| **Staging pilot readiness** | **15%** | Read-only inbox + observation OK; any real send or auto-order path NOT safe |
| **Production readiness** | **5%** | Explicitly not ready per C2C boundary docs |

### Built vs missing — capability matrix

| Capability | Built? | Completion | Notes |
|------------|--------|------------|-------|
| Inbound message capture | Yes | **85%** | `whatsapp-webhook` → `debug_webhooks`, `whatsapp_messages`, `whatsapp_buffer` |
| Message packet stitching | Yes | **75%** | `whatsapp-message-stitcher` + `whatsapp_message_packets`; no re-stitch idempotency |
| Customer/company identity | Partial | **55%** | `classifySender` in webhook; `whatsapp-identify-sender` Edge exists but **not invoked from inbox UI** |
| Product extraction | Yes | **70%** | AI in webhook + Banyan Vision parser; rule fallback when no API key |
| Catalogue alias matching | Partial | **60%** | `product_aliases` used in webhook/Banyan; War Room `AliasDrawer` teaches aliases client-side |
| Order draft creation | Yes (multiple paths) | **65%** | `admin-create-draft` (governed) vs webhook auto vs Central Pool direct insert (unsafe) |
| Quotation draft creation | Partial | **40%** | Clarification/hold flows in webhook; no dedicated quote entity |
| Human approval | Partial | **50%** | War Room + suggested_orders status; **Pipeline C skips approval** |
| Operator reply | Yes | **70%** | `whatsapp-operator-reply` → `send-whatsapp`; no idempotency / no override audit |
| WhatsApp outbound send | Yes | **75%** | `send-whatsapp` Click2API + MSG91 fallback; invoked from multiple surfaces |
| Automation/follow-up | Partial | **45%** | `send-whatsapp-automation` exists; **no frontend invokers**; cron not verified in repo |
| Complaint/ticket detection | Partial | **35%** | Keyword detection + `ledger_disputes` in webhook; `support_tickets` read in War Room only |
| Audit logging | Partial | **25%** | `debug_webhooks`, `client_interactions`; **audit tables unwired** |
| Idempotency | Partial | **30%** | WAMID dedup on webhook; `admin-create-draft` WAMID short-circuit; operator send **none** |
| JWT/security | Weak | **15%** | All WA functions `verify_jwt = false`; handler-level gates sparse |
| Staging readiness | Low | **15%** | Read path only per `C2C_CURRENT_SAFE_BOUNDARY.md` |
| Production readiness | Very low | **5%** | C2C scorecard: NOT ready |

---

## C) Frontend inventory

Safety legend: **GREEN** = read-only or suggestion-only; **AMBER** = partial governance or mixed read/write; **RED** = ungoverned writes or real sends.

### C.1 Primary surfaces

| File | Route / visibility | Purpose | Read actions | Write actions | Edge functions | Tables | Completion | Safety | Status |
|------|-------------------|---------|--------------|---------------|----------------|--------|------------|--------|--------|
| `src/components/WhatsAppInbox.tsx` | `/admin/operator-inbox`, `/admin/whatsapp` | TOOL 0–4 operator inbox: stitched packets, reply composer, AI/routing suggestions | `select` `whatsapp_message_packets`; batched `whatsapp_messages`; Realtime subscribe | `invoke` `whatsapp-operator-reply`, `whatsapp-classify-intent`, `whatsapp-route-packet` | ↑ | `whatsapp_message_packets`, `whatsapp_messages` | **88%** | **AMBER** (read GREEN; reply RED) | **Live** |
| `src/pages/OperatorInbox.tsx` | Same routes (wrapper) | Full-screen shell for inbox | — | — | — | — | **100%** | **GREEN** | **Live** |
| `src/pages/admin/CMDWarRoom.tsx` | `/admin/cmd-war-room` | CMD order triage hub: orders, shadow leads, suggested orders, raw intelligence, finance cards | `select` orders, companies, order_items, attachments, support_tickets, `whatsapp_message_packets` count | Direct `orders` update (duplicate flag, company_id, status submitted) | — | `orders`, `companies`, `whatsapp_message_packets`, `support_tickets`, … | **80%** | **RED** | **Live** |
| `src/components/warroom/SuggestedOrdersTab.tsx` | CMD War Room tab | Review Banyan `suggested_orders`; promote to draft order | `select` suggested_orders, companies | `invoke` `admin-create-draft`; `update` suggested_orders status | `admin-create-draft` | `suggested_orders`, `companies` | **75%** | **AMBER** | **Live** |
| `src/components/warroom/RawIntelligenceTab.tsx` | CMD War Room tab | Triage `debug_webhooks` / orphan orders | `select` debug_webhooks, orders, aliases | Direct companies insert/update, orders update, debug_webhooks update; `invoke` `admin-create-draft` | `admin-create-draft` | `debug_webhooks`, `orders`, `companies`, `product_aliases` | **70%** | **RED** | **Live** |
| `src/components/warroom/ShadowClientSection.tsx` | CMD War Room → Shadow Leads | Shadow company merge, employee phone routing, draft promotion | `select` companies, users, products, suggested_orders, debug_webhooks | Extensive client `update`/`insert` on companies, users, orders, b2b_applications, debug_webhooks; `invoke` `admin-create-draft` | `admin-create-draft` | `companies`, `users`, `orders`, `debug_webhooks`, `suggested_orders`, … | **72%** | **RED** | **Live** |
| `src/components/warroom/WarRoomOrderCard.tsx` | CMD War Room order cards | Per-order SKU edit, company patch, waste flag, B2B application | `select` (via parent) | `update` order_items, companies, orders; `insert` b2b_applications | — | `order_items`, `companies`, `orders`, `b2b_applications` | **78%** | **RED** | **Live** |
| `src/components/warroom/AliasDrawer.tsx` | CMD War Room modal | Teach product aliases from misparse | `select` products, aliases | `insert`/`update`/`delete` product_aliases, products.aliases; `invoke` `oasis-ai-chat` | `oasis-ai-chat` | `products`, `product_aliases` | **65%** | **AMBER** | **Live** (catalogue, not WA send) |
| `src/pages/admin/CentralOrderPool.tsx` | `/admin/central-pool` (route exists; **not in AdminLayout nav**) | Alternate suggested-order review UI | `select` suggested_orders, companies, products | **Direct** `orders` + `order_items` insert on confirm; `update` suggested_orders | — (bypasses Edge) | `suggested_orders`, `orders`, `order_items`, `products` | **60%** | **RED** | **Live duplicate** |
| `src/components/admin/CmdOperationalCommPulse.tsx` | CMD War Room header strip | Read-only ops pulse: open/stale WA packet counts, links to inbox | Display counts only | None | — | (reads via parent) | **85%** | **GREEN** | **Live** |
| `src/components/AiOrderModal.tsx` | Customer home (modal) | “AI order” UX for B2B buyers | Local product keyword match | `addToCart` only | — | — | **25%** | **GREEN** (no WA) | **Mock only** |
| `src/components/home/AIOrderUpload.tsx` | Customer home | Quick-order entry including WhatsApp icon | Opens review modal | None | — | — | **20%** | **GREEN** | **Mock only** |
| `src/utils/whatsapp.ts` | Shared utility | Dispatch/customer WA templates | — | `invoke` `send-whatsapp` | `send-whatsapp` | (Edge writes timeline) | **70%** | **RED** | **Live** |
| `src/pages/admin/OrderManagement.tsx` | `/admin/orders` | Order ops including WA notify | `select` orders | `invoke` `send-whatsapp` | `send-whatsapp` | `orders` (read) | **75%** | **RED** | **Live** |
| `src/pages/admin/AdminSettings.tsx` | Admin settings | Test WA send | — | `invoke` `send-whatsapp` | `send-whatsapp` | — | **50%** | **RED** | **Live** |
| `src/components/SupportChat.tsx` | Customer support widget | AI chat + callback intent | `select` auth user | `insert` audit_logs (callback request) | — | `audit_logs` | **40%** | **GREEN** | **Live** (no WA invoke) |
| `src/components/sales/ClientInteractionsTab.tsx` | Sales dashboard tab | CRM timeline incl. WhatsApp type | `select` client_interactions | Manual interaction CRUD | — | `client_interactions` | **55%** | **AMBER** | **Live** |
| `src/pages/admin/VerificationWarRoom.tsx` | Legacy route | Redirect notice to CMD War Room | — | — | — | — | **100%** | **GREEN** | **Legacy redirect** |

### C.2 WhatsApp inbox helper module (`src/components/whatsapp/*`)

| File | Purpose | Writes | Safety | Status |
|------|---------|--------|--------|--------|
| `operatorInboxMessagesBatch.ts` | Paginated `whatsapp_messages` select | None | GREEN | Live |
| `operatorInboxUtils.ts` | Packet health, SLA, intent inference (local) | None | GREEN | Live |
| `operatorInboxUiPersistence.ts` | localStorage UI state | localStorage only | GREEN | Live |
| `operatorInboxLocalNotes.ts` | localStorage packet notes | localStorage only | GREEN | Live |
| `operatorInboxSavedViews.ts` | Saved filter views (local) | localStorage only | GREEN | Live |
| `operatorInboxCsvExport.ts` | CSV export of visible packets | Download only | GREEN | Live |
| `operatorInboxBulkFilter.ts` | Bulk filter logic | None | GREEN | Live |
| `useOperatorInboxObservability.ts` | Read-only observability counts | select counts | GREEN | Live |
| `OperatorInboxReadOnlyPanels.tsx` | Governance bar, failed msgs panel, local AI preview | None | GREEN | Live |
| `OperatorInboxOperationalContextPanel.tsx` | Operational event feed for packet | Read feeds | GREEN | Live |
| `OperatorInboxVirtualizedPacketList.tsx` | Virtualized packet list | None | GREEN | Live |
| `OperatorInboxPacketRow.tsx` | Row rendering | None | GREEN | Live |
| `OperatorInboxSkeletons.tsx` | Loading UI | None | GREEN | Live |
| `operatorInboxTypes.ts` | Types | — | GREEN | Live |

### C.3 Operational / search integration (WhatsApp-adjacent)

| File | Purpose | WA link | Status |
|------|---------|---------|--------|
| `src/lib/operational-events/whatsappFeed.ts` | Normalize WA events for ops feed | Read model | Live |
| `src/lib/operational-search/searchAliases.ts` | Search entity aliases incl. WA | Discovery | Live |
| `src/components/admin/OrderTraceSheet.tsx` | Order trace UI | Placeholder text for WA transcript | **Partial / unused** |
| `src/components/admin/LedgerDisputesPanel.tsx` | Ledger disputes | Column `whatsapp_message_id` (display) | Live read |

### C.4 Navigation

| Location | Entry |
|----------|-------|
| `src/components/AdminLayout.tsx` | “WhatsApp Inbox” → `/admin/operator-inbox`; “War Room” → `/admin/cmd-war-room` |
| `src/App.tsx` | Routes: `operator-inbox`, `whatsapp`, `central-pool`, `cmd-war-room` |
| Central Order Pool | Routed but **not linked in sidebar** — discoverable by URL only |

---

## D) Edge function inventory

All WhatsApp slugs below: **`verify_jwt = false`** in `supabase/config.toml` (repo truth). **`admin-create-draft`** is **absent from config.toml** (platform default may apply); handler enforces Bearer + ADMIN role.

| Function | Path | Purpose | Service role | Class | Tables touched | Idempotency | Audit logging | Retry | Risk | Staging pilot? |
|----------|------|---------|--------------|-------|----------------|-------------|---------------|-------|------|----------------|
| `whatsapp-webhook` | `supabase/functions/whatsapp-webhook/index.ts` | Inbound provider webhook: dedup, buffer, stitch trigger, AI order parse, auto orders, complaints, notifications | Yes | Inbound + **write-heavy** | `debug_webhooks`, `whatsapp_buffer`, `whatsapp_messages`, `whatsapp_contacts`, `orders`, `order_items`, `companies`, `users`, `notifications`, `client_interactions`, `ledger_disputes`, `bi_monthly_ledgers`, `b2b_applications`, `products`, `product_aliases`, storage | **Partial:** WAMID dedup via `debug_webhooks.wamid` | `debug_webhooks` rows; not structured override/suggestion audit | Fire-and-forget stitcher fetch; no webhook retry contract documented | **CRITICAL** | **No** (disable Pipeline C first) |
| `whatsapp-message-stitcher` | `supabase/functions/whatsapp-message-stitcher/index.ts` | TOOL 0: stitch inbound fragments into packets | Yes | Inbound processor | `whatsapp_messages`, `whatsapp_message_packets` | **Absent** (re-stitch risk) | None | None | **HIGH** | **Read-only observe OK**; writes need idempotency |
| `whatsapp-operator-reply` | `supabase/functions/whatsapp-operator-reply/index.ts` | TOOL 1: operator outbound reply | Yes | Outbound | `whatsapp_messages`; internal fetch → `send-whatsapp` | **Absent** | Console `operator_id` only | Delegates to send-whatsapp retry | **CRITICAL** | **No** |
| `whatsapp-identify-sender` | `supabase/functions/whatsapp-identify-sender/index.ts` | TOOL 2: sender classification | Yes | Read-only | `users`, `whatsapp_contacts` | N/A | None | N/A | **LOW** | **Yes** (read classify) |
| `whatsapp-classify-intent` | `supabase/functions/whatsapp-classify-intent/index.ts` | TOOL 3: intent suggestion | Yes | Read-only | `whatsapp_messages` | N/A | None | N/A | **LOW** | **Yes** |
| `whatsapp-route-packet` | `supabase/functions/whatsapp-route-packet/index.ts` | TOOL 4: routing suggestion | Yes | Read-only | `whatsapp_message_packets` | N/A | None | N/A | **LOW** | **Yes** |
| `whatsapp-otp` | `supabase/functions/whatsapp-otp/index.ts` | WhatsApp OTP for auth (legacy/alternate to msg91) | Yes | Outbound OTP | `users`, `b2b_applications`, `app_settings` | Partial (OTP keys in app_settings) | None | Provider-dependent | **MEDIUM** | **No** until auth path declared |
| `send-whatsapp` | `supabase/functions/send-whatsapp/index.ts` | Outbound send Click2API + MSG91 fallback | Yes | Outbound | Provider API; `debug_webhooks`, `audit_logs` (failure), `client_interactions`, `whatsapp_contacts`, `whatsapp_messages` | **Absent** | Partial (failure audit_logs) | MSG91 up to 3 retries with backoff | **CRITICAL** | **No** |
| `send-whatsapp-automation` | `supabase/functions/send-whatsapp-automation/index.ts` | Lifecycle triggers (SO created, payment verified, etc.) | Yes | Outbound automation | `orders`, `whatsapp_automations`; invokes `send-whatsapp` | **Absent** | `whatsapp_automations` row | Via send-whatsapp | **HIGH** | **No** |
| `banyan-central-parser` | `supabase/functions/banyan-central-parser/index.ts` | Cron buffer flush; Vision AI → suggested_orders | Yes | Inbound batch processor | `whatsapp_buffer`, `suggested_orders`, `shadow_clients`, `companies`, `products` | Buffer status updates; not full dedupe | None | Cron every 30s (`pg_cron` in migration) | **HIGH** | **Observe only**; promotion still needs governance |
| `admin-create-draft` | `supabase/functions/admin-create-draft/index.ts` | Human-promoted draft order from War Room | Yes | Governed write | `orders`, `order_items`, `companies`, `users`, `debug_webhooks`; optional `send-whatsapp` | **Yes:** WAMID → existing order short-circuit | JWT + role in handler; WAMID dedup | Optional WA notify | **MEDIUM** | **AMBER** — best promotion path after JWT hardening |

### D.1 Related Edge functions (WhatsApp-connected)

| Function | Path | WA relevance | Risk |
|----------|------|--------------|------|
| `msg91-webhook` | `supabase/functions/msg91-webhook/index.ts` | Delivery callbacks → `auth_logs` (login analytics) | AMBER |
| `msg91-otp` | `supabase/functions/msg91-otp/index.ts` | Primary login OTP (Login.tsx invokes) | AMBER |
| `notify-event` | `supabase/functions/notify-event/index.ts` | Multi-channel notify incl. `whatsapp` channel | AMBER |
| `oasis-ai-chat` | `supabase/functions/oasis-ai-chat/index.ts` | War Room alias assist | AMBER |

### D.2 Invocation map (who calls whom)

```
Provider → whatsapp-webhook
              ├─→ whatsapp_buffer → (cron) banyan-central-parser → suggested_orders
              ├─→ whatsapp_messages → whatsapp-message-stitcher → whatsapp_message_packets
              ├─→ orders / order_items / companies (Pipeline C — auto)
              └─→ notifications, client_interactions, ledger_disputes

WhatsAppInbox → whatsapp-operator-reply → send-whatsapp → Provider
War Room tabs → admin-create-draft → (optional) send-whatsapp
OrderManagement / AdminSettings / utils/whatsapp.ts → send-whatsapp
send-whatsapp-automation → send-whatsapp (no src/ invokers found)
```

**Not invoked from `src/`:** `whatsapp-identify-sender`, `whatsapp-message-stitcher`, `banyan-central-parser`, `send-whatsapp-automation`, `whatsapp-otp`.

---

## E) Database / RPC / migration inventory

### E.1 WhatsApp core tables

| Object | Migration / source | Purpose | Read users | Write users | RLS | Indexes / idempotency | Gaps |
|--------|-------------------|---------|------------|-------------|-----|----------------------|------|
| `whatsapp_messages` | Baseline + no-op `20260518075520_*` | Raw + stitched message rows | Staff (authenticated) | Service role (webhook, stitcher, operator-reply, send-whatsapp) | Enabled (staff policies on baseline) | `packet_id`, stitch columns | No outbound idempotency key |
| `whatsapp_message_packets` | Baseline + no-op migrations | Stitched conversation units | Staff + inbox UI | Service role (stitcher) | Enabled | — | No version lock for routing |
| `whatsapp_stitched_packets` | Baseline (introspection confirms exists) | Legacy/alternate stitch store | Staff | Service role | Enabled | — | Overlap with `whatsapp_message_packets` — reconcile |
| `whatsapp_contacts` | `20260517151438_*` (no-op align) | WA contact registry | Staff | Service role | Enabled | — | Not wired to identify-sender in UI |
| `whatsapp_config` | Provider abstraction migration | API keys / instance | Staff | Service role | Enabled | — | Secrets in DB — rotation process unclear |
| `whatsapp_buffer` | `20260417113513_ee89e417-*.sql` | Banyan pre-parse message bundle | Staff read | Service role + staff insert policy | Enabled | `idx_whatsapp_buffer_sender`, status index | No message-level dedupe in buffer |
| `whatsapp_automations` | `20260517203808_*` | Automation send log | Staff | Service role | Enabled | — | No frontend visibility |
| `debug_webhooks` | `20260411124819_*` | Raw webhook + WAMID dedup audit | Staff | Staff insert + service role | Enabled | WAMID used for dedup | Mixed concerns (debug + production dedup) |

### E.2 Intake / intelligence tables

| Object | Migration | Purpose | RLS | Gaps |
|--------|-----------|---------|-----|------|
| `suggested_orders` | `20260417113513_*` | Banyan AI extraction queue | Enabled; ops manage policy | Central Pool bypasses governed promotion |
| `shadow_clients` | `20260417113513_*` | Unknown sender staging | Enabled | Merged manually in War Room client writes |
| `client_interactions` | `20260328155611_*` + alters | Customer timeline | Enabled | Written from send-whatsapp/webhook; sales tab separate CRUD |

### E.3 Audit tables (schema only — unwired)

| Object | Migration | Purpose | RLS | Gaps |
|--------|-----------|---------|-----|------|
| `whatsapp_override_log` | `20260518210953_*`, reconciled `20260518220000_*` | TOOL 5 operator override audit | Enabled; insert for operations/director roles | **Zero app/Edge writes in repo** |
| `whatsapp_suggestions_log` | Same | TOOL 3/4 suggestion audit | Enabled; view policy | **Zero app/Edge writes in repo** |

### E.4 Order / identity / catalogue (WhatsApp-touched)

| Object | WA usage | Notes |
|--------|----------|-------|
| `orders` | All three pipelines write | `wamid` dedup in admin-create-draft + webhook |
| `order_items` | Webhook auto, Central Pool, admin-create-draft | Ungoverned paths skip alias confidence gates |
| `companies` | Webhook lead creation, War Room merges | Shadow → active promotion scattered |
| `users` | Sender classification, shadow employee phone | Secondary phone logic in ShadowClientSection |
| `products` / `product_aliases` | AI parse + AliasDrawer | Client-side alias teaching bypasses Edge |
| `b2b_applications` | War Room activation | Linked from shadow promotion |
| `ledger_disputes` / `bi_monthly_ledgers` | Webhook complaint keywords | Finance side effect from WA |
| `notifications` | Webhook order events | Staff alerts |
| `support_tickets` | War Room read only | Not created from WA webhook in grep |

### E.5 Cron / infrastructure

| Job | Source | Target |
|-----|--------|--------|
| `banyan-flush-buffer` | `20260417113513_*` | HTTP POST to production ref `banyan-central-parser` every 30s |

**Gap:** Cron URL hardcoded to production project ref in migration — staging isolation risk.

### E.6 RPCs

No dedicated WhatsApp RPCs found in migrations grep. Logic lives in Edge Functions and client PostgREST.

---

## F) Pipeline map

### Pipeline A — WhatsApp Inbox → operator / manual action

```
Provider webhook
  → whatsapp-webhook (insert whatsapp_messages)
  → whatsapp-message-stitcher (async fetch)
  → whatsapp_message_packets
  → WhatsAppInbox (select + Realtime)
  → [optional] whatsapp-classify-intent / whatsapp-route-packet (suggestions)
  → whatsapp-operator-reply → send-whatsapp → customer
```

| Aspect | Status |
|--------|--------|
| **Complete** | Inbound capture, stitching, rich inbox UI, suggestion tools, operator reply chain |
| **Partial** | identify-sender not wired; suggestions not persisted to audit tables; packet routing not enforced server-side |
| **Unsafe** | operator-reply without JWT/idempotency; duplicate send on double-click |
| **Duplicate risk** | Low vs B/C for *display*; high if operator also acts in War Room on same sender |
| **Future state** | **Primary human comms surface**; all routing overrides → `whatsapp_override_log`; replies require verified JWT + idempotency key |

### Pipeline B — Banyan parser / AI → suggested_orders

```
Provider webhook
  → whatsapp-webhook (insert whatsapp_buffer + debug_webhooks)
  → pg_cron (30s) → banyan-central-parser
  → suggested_orders (+ shadow_clients / companies match)
  → SuggestedOrdersTab / CentralOrderPool (human review)
  → admin-create-draft (War Room) OR direct orders insert (Central Pool — BAD)
```

| Aspect | Status |
|--------|--------|
| **Complete** | Buffer, cron, Vision parser, suggested_orders schema, War Room tab |
| **Partial** | Company matching; confidence thresholds; no unified intake record ID |
| **Unsafe** | CentralOrderPool direct insert; client-side suggested_orders status updates |
| **Duplicate risk** | **HIGH** vs Pipeline C (same message may also auto-create order) |
| **Future state** | **Primary AI extraction path**; deprecate Central Pool direct insert; single promotion via `admin-create-draft` only |

### Pipeline C — Webhook auto-intake → draft/order

```
Provider webhook
  → whatsapp-webhook (aiParseOrder + classifySender)
  → orders / order_items / companies / notifications / client_interactions
  (hold/clarification/re-parse sub-flows for low confidence)
```

| Aspect | Status |
|--------|--------|
| **Complete** | AI parse, alias catalog, hold/release logic, complaint keyword branch |
| **Partial** | Quotation entity; human approval gate |
| **Unsafe** | **Unsupervised production order writes**; finance ledger dispute inserts |
| **Duplicate risk** | **CRITICAL** — same WAMID may also fill buffer AND packets |
| **Future state** | **Deprecate / feature-flag off** for staging; replace with “intake record pending approval” only |

### Pipeline D — War Room / CMD / Central Order Pool

```
Multiple feeds:
  - orders (Pipeline C + manual)
  - suggested_orders (Pipeline B)
  - debug_webhooks (raw intelligence)
  - shadow companies
CMDWarRoom + tabs → client-side order/company mutations
SuggestedOrdersTab / ShadowClientSection / RawIntelligenceTab → admin-create-draft
CentralOrderPool → direct orders insert (conflict)
CmdOperationalCommPulse → read-only WA metrics
```

| Aspect | Status |
|--------|--------|
| **Complete** | Broad triage UI, finance integration, alias teaching |
| **Partial** | Governance consistency; audit trail |
| **Unsafe** | Direct PostgREST writes on orders/companies/debug_webhooks |
| **Duplicate risk** | **HIGH** — three promotion mechanisms |
| **Future state** | War Room becomes **approval console** only; all writes through governed Edge adapters |

### Pipeline E — Customer support / ticket / complaint

```
whatsapp-webhook complaint keywords → ledger_disputes + templated reply intent
CMDWarRoom reads support_tickets (not WA-created in repo)
SupportChat → audit_logs callback request (no WA send)
ClientInteractionsTab → manual CRM entries
send-whatsapp / client_interactions → outbound timeline
```

| Aspect | Status |
|--------|--------|
| **Complete** | Keyword complaint detection; client timeline logging |
| **Partial** | No support_ticket auto-creation from WA; OrderTrace WA transcript placeholder |
| **Unsafe** | Ledger dispute creation without operator confirm |
| **Future state** | Unified **support case** entity linked to `packet_id`; human confirm before finance writes |

---

## G) Duplicate / legacy / conflict map

| Category | Items | Action |
|----------|-------|--------|
| **Duplicate UI** | `SuggestedOrdersTab` vs `CentralOrderPool` | Deprecate Central Pool or redirect to War Room tab |
| **Duplicate pipelines** | A (packets) vs B (buffer) vs C (auto order) | Gate B+C behind feature flags; A for comms only until unified |
| **Legacy** | `VerificationWarRoom.tsx` redirect | Keep redirect; remove dead links over time |
| **Legacy** | `whatsapp_stitched_packets` vs `whatsapp_message_packets` | Schema reconciliation in future migration (not WA-01B) |
| **Mock-only** | `AiOrderModal`, `AIOrderUpload` | Do not wire to WA until customer intake charter |
| **Unused Edge** | `whatsapp-identify-sender` (no src caller) | Wire in WA-02A identity PR or remove |
| **Unsafe direct writes** | `CentralOrderPool`, `CMDWarRoom`, `ShadowClientSection`, `RawIntelligenceTab`, `WarRoomOrderCard` | **Do not touch for feature expansion** until adapter pattern; gate in WA-03 |
| **Disable/gate** | Pipeline C in `whatsapp-webhook` | Feature flag `WA_AUTO_ORDER_ENABLED=false` (future PR) |
| **Disable/gate** | `send-whatsapp` from AdminSettings test button in staging | Process gate |
| **Authoritative path (target)** | Pipeline A read + Pipeline B suggest + **`admin-create-draft` promote** | All other order creation paths deprecated |
| **Do not touch in WA-02/WA-03** | `whatsapp-webhook` auto-order block, `CentralOrderPool` confirm handler, cron migration URL | Until identity + gating design signed |
| **Must become authoritative** | `admin-create-draft`, `whatsapp_message_packets`, `suggested_orders`, `whatsapp-operator-reply` (after hardening) | Single promotion + single reply adapter |

---

## H) Safety risk register

| ID | Risk | Severity | Location | Mitigation (future) |
|----|------|----------|----------|---------------------|
| R1 | All WA Edge `verify_jwt=false` | Critical | `supabase/config.toml` | Per-function JWT or HMAC; never rely on URL secrecy |
| R2 | Unsupervised order creation | Critical | `whatsapp-webhook` Pipeline C | Feature flag off in staging; intake-only mode |
| R3 | Duplicate orders same message | Critical | Pipelines B + C parallel | Single intake record; WAMID mutex across tables |
| R4 | Operator duplicate send | High | `whatsapp-operator-reply` | Idempotency-Key + packet reply lock |
| R5 | Central Pool bypass | High | `CentralOrderPool.tsx` | Remove direct insert; route to admin-create-draft |
| R6 | War Room client writes | High | warroom/* + CMDWarRoom | Server-side adapters + audit |
| R7 | Audit tables unwired | High | `whatsapp_*_log` | Wire TOOL 3/4/5 on persist actions |
| R8 | Cron hits production ref | High | Migration `banyan-flush-buffer` | Env-specific cron or config table |
| R9 | Service role everywhere | Critical | All WA Edge functions | Narrow policies; user-scoped where possible |
| R10 | Finance side effects from WA | High | webhook → ledger_disputes | Human approval gate |
| R11 | identify-sender unused | Medium | Edge only | Wire or delete to avoid drift |
| R12 | send-whatsapp-automation headless | Medium | Edge only | Document triggers; gate until idempotency |

---

## I) Recommended target architecture

### Target flow

```
WhatsApp inbound (provider)
  → whatsapp-webhook (ingress only: validate signature, WAMID dedup, persist raw)
  → whatsapp_messages (immutable inbound log)
  → whatsapp-message-stitcher (idempotent)
  → whatsapp_message_packets (conversation unit)
  → identity resolver (whatsapp-identify-sender → company/user/shadow)
  → catalogue/product resolver (Banyan or inline parser → proposed lines)
  → unified intake record (new: links packet_id + proposed lines + confidence)
  → human approval (War Room / Inbox action)
  → draft quote/order (admin-create-draft — sole promotion adapter)
  → governed order conversion (existing order state machine)
  → production/dispatch chain (unchanged Golden Chain)
  → customer timeline (client_interactions + whatsapp_messages outbound)
  → support cases (optional ticket linked to packet)
```

### Single source of truth

| Domain | SSOT |
|--------|------|
| Raw messages | `whatsapp_messages` |
| Conversations | `whatsapp_message_packets` |
| AI extractions | `suggested_orders` (until unified intake table exists) |
| Promoted commerce | `orders` via **`admin-create-draft` only** |
| Operator actions audit | `whatsapp_override_log` + `whatsapp_suggestions_log` |
| Outbound send log | `whatsapp_messages` (outbound rows) + `client_interactions` |

### Deprecate

- Pipeline C auto-order block in `whatsapp-webhook`
- `CentralOrderPool` direct `orders` insert
- Client-side `orders`/`companies` mutations in War Room (replace with Edge adapters)
- Parallel `whatsapp_stitched_packets` if redundant

### Harden

- **Idempotency:** webhook ingress, stitcher, operator-reply, send-whatsapp, admin-create-draft (extend WAMID to all paths)
- **JWT:** enable `verify_jwt=true` where browser invokes; HMAC for webhooks/cron
- **Audit:** persist every TOOL 3/4 suggestion and TOOL 5 override; verified `operator_id` from JWT not client JSON

---

## J) First 5 next PRs

| # | PR title | Risk | Expected files | Notes |
|---|----------|------|----------------|-------|
| 1 | **WA-02A: WhatsApp identity resolver design + wire identify-sender to inbox** | Medium | `docs/WA-02A_IDENTITY_DESIGN.md`, `WhatsAppInbox.tsx`, `whatsapp-identify-sender/index.ts`, tests | Design audit **still required** before WA-02 writes |
| 2 | **WA-02B: Feature-flag Pipeline C auto-order off (staging default false)** | High | `whatsapp-webhook/index.ts`, `src/config/waFlags.ts`, docs | No prod enable without sign-off |
| 3 | **WA-03: Retire CentralOrderPool direct insert — route to admin-create-draft** | High | `CentralOrderPool.tsx`, tests | Removes RED bypass |
| 4 | **WA-04: Operator reply idempotency + JWT hardening** | Critical | `supabase/config.toml`, `whatsapp-operator-reply/index.ts`, `WhatsAppInbox.tsx`, `send-whatsapp/index.ts` | Idempotency-Key header contract |
| 5 | **WA-05: Wire whatsapp_suggestions_log + whatsapp_override_log** | Medium | `whatsapp-classify-intent`, `whatsapp-route-packet`, `whatsapp-operator-reply`, migration if RPC needed | Closes audit table gap |

### WA-02 proceed?

| Question | Answer |
|----------|--------|
| Proceed directly to WA-02 implementation? | **No** — complete **WA-02A identity design audit** first; gate Pipeline C |
| WA-02A still needed? | **Yes** — `whatsapp-identify-sender` unused; shadow/company merge rules undefined at inbox |
| Safe to start now? | **WA-02A docs + read-only wire** only; no production/staging writes |

---

## K) Exact next Cursor prompt

```text
PR-WA-02A — WhatsApp Identity Resolver Design Audit

Repo: oasisbaklawa2006/Oasis-Baklawa-Central
Base branch: main
New branch: cursor/wa-02a-identity-resolver-design-audit-d522

Goal:
Design-only audit for customer/company/contact identity resolution across WhatsApp pipelines A/B/C.

Hard rules:
- Documentation only — no app code, edge code, migrations, deploy, or verify_jwt changes.

Deliverable:
docs/WHATSAPP_IDENTITY_RESOLVER_DESIGN_AUDIT.md covering:
1) Current identity logic in whatsapp-webhook classifySender, whatsapp-identify-sender, ShadowClientSection, banyan-central-parser company match
2) Phone normalization rules (10-digit vs 91 prefix) and conflict cases
3) staff vs client vs lead vs shadow classification matrix
4) SSOT recommendation for contact_id, company_id, user_id on whatsapp_message_packets
5) Merge/conflict rules when same phone maps to multiple companies
6) Wire plan to invoke identify-sender from WhatsAppInbox (read-only phase)
7) Gating checklist before WA-02B Pipeline C disable PR

Reference:
docs/WHATSAPP_COMPLETE_MODULE_BUILD_AUDIT.md (PR-WA-01B)

Validation: npm run typecheck && npm run build
```

---

## Validation (PR-WA-01B)

Documentation-only change — no app or Edge code modified.

Commands run after doc add:

```bash
npm run typecheck
npm run build
```

---

## Files changed (this PR)

| File | Change |
|------|--------|
| `docs/WHATSAPP_COMPLETE_MODULE_BUILD_AUDIT.md` | **Added** — complete module build audit (this document) |

---

*End of PR-WA-01B audit.*
