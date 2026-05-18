# Sprint C2 Readiness Report

**Generated:** planning artifact — reflects repository state at time of authoring.  
**Scope:** Assess current WhatsApp / governance foundations before **TOOL 5** (manual override) and **TOOL 6** (read-only intelligence, if any persistence is later approved).  
**Constraints:** No code changes, migrations, deploy, commit, or push as part of this document.

---

## 1. Current WhatsApp architecture map

### 1.1 TOOL 0–4 (Edge Functions in repo)

| TOOL | Slug | Role | DB access from Edge |
|------|------|------|---------------------|
| **0** | `whatsapp-message-stitcher` | Batch-stitch raw inbound rows into packets | **Writes:** inserts `whatsapp_message_packets`, updates `whatsapp_messages` (`packet_id`, `packet_sequence`, `is_raw`, `stitched_at`, etc.) via **service role** |
| **1** (reply path) | `whatsapp-operator-reply` | Operator-composed outbound message | **Writes:** inserts `whatsapp_messages` (outbound), invokes `send-whatsapp` with service key |
| **2** | `whatsapp-identify-sender` | Classify sender (customer / employee / spam / unknown) | **Read-only** `SELECT` on `users`, `whatsapp_contacts` (service role) |
| **3** | `whatsapp-classify-intent` | Intent suggestion | **Read-only** `SELECT` on `whatsapp_messages` (service role); returns JSON only |
| **4** | `whatsapp-route-packet` | Routing suggestion | **Read-only** `SELECT` on `whatsapp_message_packets` (`stitched_content`, etc.); returns JSON only |

**Related (not numbered as TOOL 0–4):**

- `whatsapp-webhook` — inbound pipeline (large handler; **service role**; writes depend on internal branches).
- `whatsapp-otp` — OTP flow (**service role**).
- `send-whatsapp` / `send-whatsapp-automation` — outbound delivery (**service role**; invoked by operator-reply with bearer service key).

### 1.2 Inbox UI

- **`src/components/WhatsAppInbox.tsx`** — Lists **open** `whatsapp_message_packets`, loads nested `whatsapp_messages`, **realtime** subscription on `whatsapp_message_packets`, operator reply via `supabase.functions.invoke("whatsapp-operator-reply", { body: { … operator_id: user?.id } })`.
- **`src/pages/OperatorInbox.tsx`** — Thin wrapper rendering `WhatsAppInbox`.

### 1.3 Deployed functions (configured project)

Per `supabase/config.toml` and prior deploy practices, the WhatsApp-related Edge slugs include at minimum:

`whatsapp-webhook`, `whatsapp-otp`, `whatsapp-message-stitcher`, `whatsapp-operator-reply`, `whatsapp-identify-sender`, `whatsapp-classify-intent`, `whatsapp-route-packet`, plus `send-whatsapp` / `send-whatsapp-automation` where used.

*(Exact remote `functions list` is environment-specific; this report uses **repo + config** as source of truth for names and JWT flags.)*

### 1.4 Current data flow (high level)

```text
[Meta / provider] --> whatsapp-webhook --> whatsapp_messages (raw inbound, is_raw, etc.)
                              |
                              v
              whatsapp-message-stitcher (POST/cron)
                              |
         whatsapp_message_packets + link whatsapp_messages.packet_id
                              |
         Realtime + SELECT <-- WhatsAppInbox (authenticated app user)
                              |
    invoke whatsapp-classify-intent / whatsapp-route-packet (read-only suggestions)
                              |
    invoke whatsapp-operator-reply --> insert outbound row --> send-whatsapp --> provider
```

---

## 2. Current write-capable surfaces in the app

| Surface | Mechanism | Notes |
|---------|-----------|--------|
| **Edge `whatsapp-message-stitcher`** | Service role | Mutates packets + message rows |
| **Edge `whatsapp-operator-reply`** | Service role + internal `fetch` to `send-whatsapp` with service bearer | Inserts outbound `whatsapp_messages` |
| **Edge `whatsapp-webhook`** | Service role | Ingestion / side effects (review separately for blast radius) |
| **Edge `send-whatsapp`*** | Service role | Provider send |
| **Browser `WhatsAppInbox`** | `supabase.from(...).select` only for WhatsApp tables in current code | **No** direct `.insert`/`.update`/`.delete` on WhatsApp tables from TSX |
| **Browser `WhatsAppInbox`** | `functions.invoke` | **Operator reply** (write path **delegated** to Edge); **TOOL 3/4** invoke (read-only on DB) |

\*Shared infrastructure, not TOOL-numbered.

---

## 3. Existing auth patterns

### 3.1 JWT usage (browser app)

- **`src/integrations/supabase/client.ts`** — `createClient` with **publishable (anon) key** + `persistSession`; user JWT attached automatically for **RLS-bound** PostgREST and **`functions.invoke`** when a session exists.

### 3.2 Service role usage (Edge)

- All listed WhatsApp Edge handlers use **`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`** (or equivalent) for DB access — **bypasses RLS** from the Edge runtime’s perspective.

### 3.3 `verify_jwt` patterns (`supabase/config.toml`)

- **All** configured functions in this file use **`verify_jwt = false`**, including every WhatsApp slug (`whatsapp-webhook`, `whatsapp-message-stitcher`, `whatsapp-operator-reply`, `whatsapp-identify-sender`, `whatsapp-classify-intent`, `whatsapp-route-packet`, `whatsapp-otp`, `send-whatsapp`, `send-whatsapp-automation`).

**Implication for Sprint C2:** TOOL 5 **must not** inherit “JWT off + service role + browser callable” without a deliberate redesign (see Sprint C2 governance doc). Current pattern is optimized for **webhooks and internal automation**, not **governed human override**.

---

## 4. Existing role system

### 4.1 Roles in codebase (`src/lib/auth-routing.ts`)

**Staff destinations** (keys of `STAFF_ROLE_DESTINATIONS`) include, among others:

`SUPER_ADMIN`, `OWNER`, `ADMIN`, `FINANCE_HEAD`, `FINANCE_EXEC`, `FINANCE_AUDITOR`, `OPERATIONS_MANAGER`, `PRODUCTION_MANAGER`, HOD / PROD / TV / store / dispatch / assembly / sales / support / catalogue / security roles — see file for the authoritative full set.

**`STAFF_ROLES`** = `new Set(Object.keys(STAFF_ROLE_DESTINATIONS))`.

**Buyer / client roles:** `B2B_BUYER`, `SPECIAL_BUYER`, `HORECA_BUYER`, `WHOLESALE_BUYER`, `BULK_BUYER`, `BUYER`, `CLIENT`, `CUSTOMER_USER` (`BUYER_ROLES`).

### 4.2 TOOL 2 overlap

- `whatsapp-identify-sender` duplicates an extended **staff role allowlist** for “employee” detection (aligned with routing destinations conceptually).

### 4.3 Likely operator / admin roles for TOOL 5 (proposal — needs product sign-off)

Candidates for **manual packet override**:

- **`SUPER_ADMIN`**, **`OWNER`**, **`ADMIN`** — full governance.
- **`OPERATIONS_MANAGER`** — operational truth on dispatch / queues.
- **`SUPPORT_EXECUTIVE`** — customer-impacting corrections (if product allows).
- Possibly **`DISPATCH_HEAD`** / **`DISPATCH_MANAGER`** — if overrides are logistics-only.

**Exclude by default:** buyer roles, TV display roles, narrow production floor roles — unless explicitly justified.

---

## 5. Existing packet / message schema usage (repo evidence)

### 5.1 `whatsapp_messages`

- **Stitcher:** `select` raw inbound; `update` sets `packet_id`, `packet_sequence`, `is_raw`, `stitched_at`.
- **Operator reply:** `insert` outbound row (`direction: outbound`, `provider: operator_reply`, `status: pending`, etc.).
- **Inbox:** `select` `id, content, message_type, direction, created_at, packet_sequence` filtered by `packet_id`.
- **TOOL 3:** `select` inbound rows by `packet_id` (+ optional `contact_id`).

**Note:** Tables are referenced with `as any` in TS because generated `Database` types may not list them.

### 5.2 `whatsapp_message_packets`

- **Stitcher:** `insert` with `contact_id`, `stitched_content` (JSON with `summary` + `text`), `fragment_count`, timestamps, `status: "open"`.
- **Inbox:** `select` open packets with join shape for `whatsapp_contacts`.
- **Realtime:** listens to `whatsapp_message_packets`.
- **TOOL 4:** `select` `id, stitched_content, contact_id` by packet id.

### 5.3 `stitched_content` usage

- **Written** by stitcher as structured object `{ summary, text }`.
- **Read** by Inbox (`packetPreviewSummary`) and TOOL 4 (optional `intent_type` inside object for routing hint — not written by TOOL 3/4 today).

### 5.4 Migrations in repo

- **No** migration file in `supabase/migrations/` was found that **`CREATE TABLE`s** `whatsapp_messages` or `whatsapp_message_packets` (grep shows only unrelated `whatsapp_message_id` reference).  
- **Conclusion:** Schema likely lives **outside this repo’s migrations** or predates tracked migrations — a **governance gap** for reproducible C2 work.

---

## 6. Gaps before TOOL 5

| Gap | Detail |
|-----|--------|
| **Missing migrations (in repo)** | No authoritative SQL here for `whatsapp_*` core tables → C2 schema work must **import or add** migrations before reviewable RLS. |
| **Missing RLS (documented)** | Edge uses **service role** everywhere; **RLS** for operator/browser paths on packets/messages is not described in-repo for WhatsApp tables. |
| **Missing audit schema** | No `whatsapp_override_log` / `whatsapp_suggestions_log` (or equivalents) in repo — required for TOOL 5/C2 governance. |
| **Missing transactional strategy** | Packet update + audit insert must be **one transaction** (RPC or single Edge + RPC) — not present for overrides. |
| **Identity / auth mismatch for governance** | `verify_jwt = false` on write-adjacent slugs; `whatsapp-operator-reply` accepts **`operator_id` in body** (logged only today) — **not** suitable as trust root for TOOL 5. |
| **C2 planning doc** | `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` defines principles; this report tracks **current-state vs those principles**. |

---

## 7. Risks if TOOL 5 is implemented incorrectly

1. **Forged operator** — trusting body `operator_id` → false audit trail.  
2. **Unauthorized override** — any caller hits Edge with anon key if JWT remains off → arbitrary packet corruption.  
3. **Partial writes** — packet updated without audit row → non-compliance and debugging hell.  
4. **Race conditions** — concurrent overrides without versioning → lost updates.  
5. **RLS bypass + leaked URL** — service role in Edge without tight input validation → data exfiltration or mass update.  
6. **Blast radius on `whatsapp_message_packets`** — bad state breaks inbox, routing suggestions, and operator UX.  
7. **Confusion with TOOL 3/4** — if TOOL 5 writes “intent” into `stitched_content` without clear rules, read-only tools become misleading.

---

## 8. Recommended Sprint C2 phases

| Phase | Name | Deliverables |
|-------|------|----------------|
| **C2A** | Schema | Migrations: audit tables; any new columns/enums on packets; indexes; **document** source of truth for existing WhatsApp tables (import SQL if external). |
| **C2B** | Auth / RLS | RLS policies for `authenticated` vs `service_role`; tighten **which** roles can `SELECT` audit; **no** silent broad grants. |
| **C2C** | Safe override write path | New Edge or **RPC-first** design: **`verify_jwt = true`**, `auth.uid()` identity, role check, transactional update + audit insert; deprecate body `operator_id` for trust. |
| **C2D** | UI approval flow | Inbox / admin UI: explicit override UX, confirmations, dry-run preview (optional), **no** silent apply. |
| **C2E** | Audit observability | Dashboards / queries / alerts on `whatsapp_override_log`; correlation ids; retention and PII redaction policy. |

 sequencing: **C2A → C2B → C2C** before UI-heavy **C2D**; **C2E** can start after first audit writes land.

---

## 9. What must remain read-only (explicit)

Unless **Sprint C2** explicitly approves a new write contract and implements the full governance stack:

1. **`whatsapp-classify-intent`** — **read-only** `SELECT` + JSON response only; **no** packet/message mutations.  
2. **`whatsapp-route-packet`** — **read-only** `SELECT` + JSON response only; **no** packet/message mutations.  
3. **WhatsAppInbox suggestion panels** — display only; **no** “apply intent/route” actions without C2D + C2C.  
4. **TOOL 6 (default)** — if introduced as “intelligence,” **default** remains **no persistence**; any logging table requires C2A/B + explicit product approval (see governance doc).

**TOOL 0 / webhook / operator-reply** are **not** read-only; they are existing **pipeline** writes — C2 should **not** accidentally weaken them, but TOOL 5 must **not** duplicate their insecure patterns.

---

## References (in-repo)

- `supabase/functions/whatsapp-*/index.ts` — behavior per TOOL.  
- `supabase/config.toml` — `verify_jwt` flags.  
- `src/components/WhatsAppInbox.tsx` — inbox + invokes.  
- `src/lib/auth-routing.ts` — role universe.  
- `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` — approved C2 principles and gates.

---

*End of report.*
