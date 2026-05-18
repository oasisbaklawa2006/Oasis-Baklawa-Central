# Sprint C2: Manual Control & Audit Governance (TOOL 5 / TOOL 6)

This document defines **Sprint C2** scope and guardrails for **TOOL 5** (manual override / control) and **TOOL 6** (intelligence / suggestions) **before any implementation**.  
Implementation of TOOL 5/6 **must not begin** until this design is reviewed and explicitly approved.

---

## 1. Why TOOL 5/6 were blocked from Sprint C1

Sprint C1 intentionally delivered **read-only** and **low-blast-radius** capabilities:

- **TOOL 0** — Message stitcher (controlled pipeline; separate security review).
- **TOOL 1** — Inbox + operator reply UI (existing patterns).
- **TOOL 2** — Sender identification (read-oriented classification).
- **TOOL 3** — Intent classification **return-only** (no DB writes in Edge).
- **TOOL 4** — Route suggestion **return-only** (no DB writes in Edge).
- **WhatsAppInbox** — Read-only suggestion UI calling TOOL 3/4 via `supabase.functions.invoke`.

**TOOL 5/6** were deferred because early sketches implied:

- **Writes** to `whatsapp_message_packets` and new **audit** tables.
- **Trust-sensitive** behavior: who overrode what, and whether “informational” paths still **persisted** data.
- **Weak identity patterns** if `operator_id` were taken from the **request body** or if **write-capable** functions used **`verify_jwt = false`**.
- **Schema and RLS** not yet defined in-repo for audit tables.

Sprint C1’s contract was **no governance-grade writes** and **no silent persistence** disguised as informational tooling. TOOL 5/6 belong in a **governance** sprint with migrations, RLS, and strict auth.

---

## 2. Security principles

1. **Least privilege** — Only roles that may change packet state or create audit records can invoke write paths.
2. **Authenticate first** — Browser- or operator-facing write endpoints require **verified JWT**; no anonymous writes.
3. **Authorize explicitly** — Role / permission checks **in Edge** (and ideally reinforced in **RLS**).
4. **Identity from credentials** — Operator identity from **`auth.uid()`** (JWT), never from client-supplied IDs.
5. **Atomicity** — Packet mutation and audit insert must succeed or fail **together** where possible.
6. **No silent side effects** — “Informational” tools do not write unless the product explicitly defines persistence, auth, retention, and RLS.
7. **Defense in depth** — RLS limits damage even if Edge logic regresses; Edge still validates business rules.
8. **Auditability** — Every override produces an immutable, queryable record with server-trusted actor and timestamp.
9. **No `verify_jwt = false` on write-capable functions** exposed to broad callers; service-only patterns need a **separate**, non-browser secret and threat model.

---

## 3. Required schema migrations (planning — not implemented here)

Sprint C2 **starts** with migrations (to be authored after design approval). Expected areas:

### 3.1 Audit / governance tables (names indicative — finalize in design review)

| Table | Purpose |
|-------|---------|
| **`whatsapp_override_log`** (or equivalent) | Immutable log of manual packet/control overrides: actor, packet id, before/after snapshot or JSON diff, reason, correlation id, timestamps. |
| **`whatsapp_suggestions_log`** (optional — only if TOOL 6 persists) | If product requires persistence: redacted payload, actor, TTL/retention metadata; **not** used for “silent informational” without explicit approval. |

### 3.2 `whatsapp_message_packets` (if overrides change columns)

- Document which columns TOOL 5 may change (e.g. status, routing hints — **exact list TBD**).
- Add constraints / enums if needed to prevent invalid state transitions.

### 3.3 Indexes

- Index on `(packet_id, created_at)` for audit tables.
- Index on `(operator_user_id, created_at)` for support queries.

### 3.4 Migrations deliverable

- Forward migration + rollback strategy (where Postgres allows).
- **No** migration files are created by this planning doc.

---

## 4. Required RLS policies

Principles for **both** audit tables and any packet columns touched by operators:

1. **`service_role`** — May bypass RLS for **server-only** maintenance; **not** the default for operator JWT flows.
2. **`authenticated`** — Operators: **SELECT** on audit rows they are allowed to see (scoped by role — e.g. own overrides vs org-wide).
3. **Writes** — Prefer **no direct client INSERT/UPDATE** on `whatsapp_message_packets` from the browser; use **Edge + RPC** or Edge with user JWT and **narrow** policies if unavoidable.
4. **`whatsapp_override_log`** — Typically **INSERT** only via **SECURITY DEFINER** RPC or service path; **SELECT** restricted by role.
5. **Separation** — Read-only analytics roles may **SELECT** redacted views only.

Exact SQL is **out of scope** for this document until table shapes are frozen.

---

## 5. JWT / auth requirements

| Requirement | Detail |
|---------------|--------|
| **Write-capable Edge Functions** | **`verify_jwt = true`** in `supabase/config.toml` (or equivalent platform setting) so the gateway **requires** a valid user JWT unless a **separate**, reviewed server-to-server design exists. |
| **Client** | Inbox or admin UI calls `supabase.functions.invoke` **with session**; anon key without session must **not** satisfy auth for writes. |
| **Edge handler** | Obtain JWT from `Authorization` / gateway context; validate user; optional: fetch `users` row for role. |
| **No JWT-off for public write surfaces** | Rejected for TOOL 5; any exception needs written threat model + HMAC/service token + IP allowlist (not default). |

---

## 6. Operator identity via `auth.uid()`, never request body

- **Primary key for “who did this”** = **`auth.uid()`** from the verified JWT.
- Resolve **`users.id`** (or staff profile id) **server-side** from `auth.uid()` if logs store internal user ids.
- **Reject** or **ignore** any `operator_id` / `user_id` fields in the request body for **authorization or audit** (optional body fields for **UI correlation only** must never override trust).
- Log **both** `auth.uid()` and resolved staff id if they differ in edge cases, for forensics.

---

## 7. Role / permission validation

- Maintain an **allowlist** of roles permitted to perform **manual override** (TOOL 5), aligned with `src/lib/auth-routing` / staff role enums used elsewhere.
- Check role **in Edge** after JWT verification (e.g. query `users.role` for `auth.uid()`).
- Optionally mirror with **RLS** (`auth.uid()` in policy) or **RPC** `SECURITY DEFINER` that asserts role.
- Return **403** with stable error code when forbidden (no stack traces to client).

---

## 8. Transactional packet update + audit insert

- **Goal:** Never commit a packet change without a corresponding audit row (or explicit transactional boundary).
- **Preferred:** Single **Postgres function** (RPC) `SECURITY DEFINER` that:
  1. Validates caller (`auth.uid()`), role, packet existence, and allowed transition.
  2. Updates `whatsapp_message_packets` (or relevant table).
  3. Inserts into `whatsapp_override_log`.
  4. Returns success + ids — **one transaction**.
- **Alternative:** Edge uses **service role** only if unavoidable, but then **must** re-implement all checks and still prefer **one** DB transaction via RPC or `supabase.rpc()`.

---

## 9. TOOL 5 — Safe manual override design (target)

**Purpose:** Allow a **governed** manual action on a packet (e.g. status, assignment hint, escalation flag — **exact fields TBD**).

**Properties:**

- **Name:** e.g. `whatsapp-manual-override` (slug TBD).
- **Auth:** JWT required; **`verify_jwt = true`**.
- **Input:** `packet_id`, `action` / `patch` (validated enum or schema), `reason` (required string), optional `client_request_id` for idempotency — **no trusted identity in body**.
- **Processing:** Resolve operator from **`auth.uid()`**; validate role; load packet with **row lock or version check**; apply transition rules; **transaction**: update packet + insert override log.
- **Output:** `{ success, packet_id, log_id, applied_at }` — no sensitive internals unless required.
- **Observability:** Server logs with correlation id; rate limit consideration.

---

## 10. TOOL 6 — Truly read-only intelligence design (target)

**Purpose:** Optional **analytics / hints** for operators **without** persistence unless explicitly approved.

**Default (recommended):**

- **Pure read** or **compute-only** response: JSON with suggestions, scores, explanations.
- **No** inserts to `whatsapp_suggestions_log` unless Sprint C2 explicitly approves persistence with RLS, retention, and redaction.

**If persistence is later approved:**

- Rename contract to **“audited suggestion capture”** (not “informational only”).
- JWT + role gate; **redacted** storage; retention job; RLS on log table; **no** `verify_jwt = false`.

---

## 11. Testing checklist (pre–production)

- [ ] Migration applies cleanly on staging; tables and indexes exist.
- [ ] RLS: unauthenticated cannot read/write audit or packet via PostgREST.
- [ ] RLS: wrong role cannot `SELECT` sensitive audit rows.
- [ ] Edge: no JWT → **401** on TOOL 5 (and any persisted TOOL 6).
- [ ] Edge: JWT with valid user but **wrong role** → **403**.
- [ ] Edge: valid override → packet updated + **exactly one** log row; rollback on failure → **no** partial update.
- [ ] Concurrent edits: two operators / double-submit → **version conflict** or idempotent behavior defined and tested.
- [ ] Body spoofing: forged `operator_id` in body → **ignored**; audit shows **`auth.uid()`** user.
- [ ] Load test: logging path cannot be abused for DoS (size limits, rate limits).
- [ ] Regression: Sprint C1 read-only TOOL 3/4 remain unchanged and still return-only.

---

## 12. Explicit non-goals (Sprint C2 planning phase)

- **No** TOOL 5/6 **implementation** in this repo until design sign-off.
- **No** new Edge Function code, **no** app code changes, **no** migrations, **no** deploy — **planning document only** for this deliverable.
- **No** `verify_jwt = false` on **write** or **audit-insert** paths without a separately approved service-to-service design.
- **No** “informational” APIs that **secretly write** to the database.
- **No** trust of **operator identity** from request body.

---

## Approval gate

**Sign-off required from:** product owner + engineering lead (or equivalent) on:

- Exact packet fields TOOL 5 may change.
- Whether TOOL 6 persists anything; if yes, data minimization and retention.
- Final table names, RLS matrix, and Edge vs RPC split.

Until then, **freeze** TOOL 5/6 implementation.
