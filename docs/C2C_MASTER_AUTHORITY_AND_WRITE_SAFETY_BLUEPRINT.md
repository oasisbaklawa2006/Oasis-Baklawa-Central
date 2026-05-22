# C2C — Master authority and write-safety blueprint

**Status:** Planning and governance only. This document does **not** authorize migrations, Edge edits, database writes, TOOL 5 implementation, or queue work.

**Audience:** Security, backend, operations, product, and engineering leads approving any future WhatsApp write-path expansion.

---

## 1. Current system state

### What exists today

- **Operator inbox (read-only UI track):** `/admin/operator-inbox` and URL alias `/admin/whatsapp` render the same client bundle. Features include virtualized packet list, filters, local saved views (localStorage), per-packet local notes (localStorage), CSV export from **visible in-memory rows only**, read-only observability aggregates (best-effort; partial failures surfaced in UI), read-only governance bar (disabled actions), failed-message read-only panel (strict outbound operator-reply semantics), keyboard shortcuts, and responsive / accessibility polish.
- **Data access:** Client reads open `whatsapp_message_packets` (and related selects) plus batched message loads. Realtime subscription triggers **silent** list refresh (no full-page blocking shell on refresh).
- **Edge invocation (unchanged inventory):** Three `supabase.functions.invoke` call sites from the inbox UI for reply, classify, and route suggestions.

### Read-only observability

- **Complete for C2B scope:** Strip-level metrics are read-only; failures degrade to partial metrics without blocking the inbox list.
- **Not a substitute for audit:** Observability counts and samples are **not** immutable compliance logs.

### Existing invokes (frozen count and purpose)

| Invoke | Purpose |
|--------|---------|
| `whatsapp-operator-reply` | Operator-initiated outbound send. |
| `whatsapp-classify-intent` | On-demand intent suggestion. |
| `whatsapp-route-packet` | On-demand routing suggestion. |

No **new** invokes have been added in the read-only track; expansion remains explicitly out of scope until this blueprint is accepted and gated work is scheduled.

### Frozen areas (until governance and staging gates lift)

- **Migrations** and **Supabase repair / db push / db pull**.
- **Supabase CLI** in CI or operator workflows for schema drift repair.
- **Deploy** (manual or otherwise) as part of *this* documentation sprint — deployment remains a separate controlled process.
- **Edge function edits** and **new `functions.invoke` targets**.
- **Client `insert` / `update` / `delete` / `rpc`** for WhatsApp governance from the inbox (beyond current explicitly approved invoke paths).
- **TOOL 5 implementation** (persistence, automation, reassignment execution).
- **Queue implementation** and **production write-path expansion** without staging pilot and rollback plan.

---

## 2. Existing write surfaces inventory

> **Note:** Auth and JWT posture below must be **verified in repository and Supabase dashboard** during Phase 1 authority review. This table states expectations and questions, not audited certification.

### `whatsapp-operator-reply`

| Dimension | Description |
|-----------|-------------|
| **Caller** | Authenticated staff user in `WhatsAppInbox` UI (`src/components/WhatsAppInbox.tsx`); `supabase.functions.invoke` with body including `packet_id`, `contact_id`, `phone_number`, `message`, `operator_id`. |
| **Auth model** | User session via Supabase client; JWT attached by client SDK — **verify** Edge `verify_jwt` and role checks at review. |
| **`verify_jwt` posture** | **Expected:** `true` (or equivalent) so anonymous browser cannot invoke. **Authority review:** confirm in function config and code. |
| **Payload trust assumptions** | Body fields partially mirror UI state; **risk** if Edge trusts client-supplied `operator_id` without reconciling to JWT subject. |
| **Risks** | Duplicate send if retried without idempotency key; wrong packet if race with stitcher; PII exfiltration via crafted packet id if RLS weak (mitigate at DB + Edge). |
| **Current auditability** | **TBD** at review: structured logs, `auth.uid()` correlation, append-only audit table. Without immutable audit, disputes are not forensically defensible. |

### `whatsapp-classify-intent`

| Dimension | Description |
|-----------|-------------|
| **Caller** | Same inbox UI; body `{ packet_id, contact_id }`. |
| **Auth model** | Staff session; read-heavy but may persist or side-effect — **review** function implementation. |
| **`verify_jwt` posture** | **Expected:** `true`. Confirm. |
| **Payload trust assumptions** | IDs must match RLS-scoped rows; **risk** of enumeration if counts leak. |
| **Risks** | Cost abuse (LLM / CPU); prompt injection via stitched content; storing suggestions without governance. |
| **Current auditability** | **TBD:** log who invoked classify for which packet; correlate to model version. |

### `whatsapp-route-packet`

| Dimension | Description |
|-----------|-------------|
| **Caller** | Same inbox UI; body includes packet/contact and optional prior intent object. |
| **Auth model** | Staff session. |
| **`verify_jwt` posture** | **Expected:** `true`. Confirm. |
| **Payload trust assumptions** | Optional `intent` from client — **higher trust risk**; Edge must validate shape and not treat as authoritative without server-side re-fetch. |
| **Risks** | Route suggestion applied automatically in future without human ack → policy violation; same cost / abuse vectors as classify. |
| **Current auditability** | **TBD:** decision object and operator id in immutable log before any auto-apply exists. |

---

## 3. TOOL 5 authority concept (conceptual only)

TOOL 5 is the **governed operator tooling layer**: human-in-the-loop controls that may eventually **mutate** workflow state (assignments, priorities, acknowledgements, overrides). **No implementation** is defined here—only concepts to align stakeholders.

| Concept | Meaning (conceptual) |
|---------|----------------------|
| **Manual override** | A senior authority reverses or supersedes an automated or peer decision, with reason and audit trail. |
| **Reassignment** | Moving responsibility for a packet/thread from one queue, team, or operator to another, with policy checks. |
| **Escalation** | Raising visibility or SLA tier when thresholds breach; may notify or reprioritize — not silent automation without rules. |
| **Priority override** | Changing explicit priority fields used for routing or display, bounded by role. |
| **Route override** | Choosing a non-default route or team after suggestion or policy violation, with accountability. |
| **Operator acknowledgement** | Explicit human confirmation that a suggestion, draft, or risk was read before next automation step — breaks “silent apply” chains. |

---

## 4. Authority levels

> **Allowed future actions** are what the org *may* grant after migrations, RLS, Edge hardening, and audit exist — **not** what exists today.

| Role | Allowed future actions (examples) | Forbidden (default) | Audit expectations |
|------|-----------------------------------|----------------------|----------------------|
| **Operator** | Reply (governed), acknowledge suggestions, add notes (if ever server-backed), request escalation. | Reassign others’ packets; finance actions; change global routing rules. | Every outbound action tied to `auth.uid()`; reason on override. |
| **Supervisor** | Reassign within team; approve limited overrides; pause automation for a thread. | Schema changes; service role. | Same + supervisor id on cross-operator actions. |
| **Finance observer** | Read finance-related packet metadata where RLS permits; export within policy. | Send WhatsApp; reassign operations queues. | Read access logged if sensitive. |
| **Operations** | Operational routing adjustments within policy; bulk holds if product-defined. | JWT admin; raw SQL. | Immutable log for bulk actions. |
| **Admin** | User/role management (outside this doc’s scope); configure non-production flags if process allows. | Bypass audit; impersonate without log. | Admin actions highly visible and correlated. |
| **Super_admin** | Break-glass within legal/policy; emergency disable of automation. | “Invisible” actions — still must leave audit. | Break-glass reason mandatory; alerting. |
| **service_role** | Server-only tasks (cron, internal reconciler) with no browser exposure. | Direct exposure to client. | Machine principal id; job correlation id; no human anonymity. |

---

## 5. Immutable audit requirements

Before any production write expansion:

1. **Append-only audit** — no in-place edits or deletes of audit rows; retention policy is legal/product owned.
2. **Actor identity** — always record JWT `sub` / `auth.uid()` (or explicit service principal id); never trust client-only `operator_id` without match.
3. **Timestamp source** — server-generated timestamp (DB `now()` or Edge trusted clock), not client clock alone.
4. **Packet snapshot** — key fields at action time: `packet_id`, `contact_id`, status, fragment count, last_message_at hash or truncated stitched hash.
5. **Previous / new values** — JSON diff or column-level old/new for mutations; NULL previous for creates.
6. **Reason requirements** — mandatory free-text or enum for override, reassignment, priority change, and break-glass.
7. **Correlation ids** — single id threading reply + webhook + internal jobs for one user intent.
8. **Replay protection** — idempotency keys or nonce store so duplicate POSTs cannot double-send or double-route.

---

## 6. Conflict handling model

| Mechanism | Intent |
|-----------|--------|
| **Optimistic locking** | Packet (or thread) row carries `version` or `updated_at` check; updates fail if stale, forcing UI refresh. |
| **Stale packet protection** | Edge refuses send if packet closed or contact changed since client loaded data. |
| **Concurrent operator edits** | Last-writer-wins forbidden for governed fields; use lock, claim, or merge rules per field type. |
| **Double-route prevention** | Idempotency + state machine: e.g. cannot `route` twice to production dispatch without supervisor ack. |
| **Duplicate-send prevention** | Idempotency key on `operator-reply`; dedupe window; WhatsApp idempotency aligned with provider rules. |
| **Packet versioning concept** | Monotonic `packet_version` incremented on material stitcher events; Edge requires client to echo last seen version. |

---

## 7. JWT and Edge safety

| Rule | Description |
|------|-------------|
| **`verify_jwt=true` expectation** | Default for all user-invokable Edge functions that touch writes or privileged reads. |
| **Exceptions policy** | Any `verify_jwt=false` function must be **server-to-server only** (network restriction, secret header, or Vercel/Supabase private networking) and listed in a allowlist doc. |
| **Service-only routes** | Cron or worker triggers use **service role** with narrowed internal API, not exposed `invoke` from browser. |
| **Anti-forgery** | Edge re-loads authoritative row state from DB; rejects body fields that contradict DB (e.g. closed packet). |
| **Client-trust rejection** | Never treat browser localStorage or client-computed “role” as proof of privilege. |
| **Operator impersonation risks** | Shared accounts forbidden where audit requires individual identity; session timeout and re-auth for sensitive overrides. |

---

## 8. Queue and automation future rules

| Rule | Description |
|------|-------------|
| **Automation authority boundaries** | Each automated action maps to a documented policy version and role-equivalent “bot principal.” |
| **Human override precedence** | Any human override halts automation for that packet until ack or timer per policy. |
| **Retry idempotency** | Retries use same idempotency key; exponential backoff; dead-letter queue with reason. |
| **Dedupe rules** | Natural keys (e.g. provider message id + direction) prevent duplicate enqueue. |
| **Escalation hierarchy** | Machine → operator → supervisor → ops on-call; each transition logged with SLA timestamps. |

---

## 9. Staging-only pilot plan

| Mode | Description |
|------|-------------|
| **Shadow mode** | Automation computes intended action; logs only; no external side effects. |
| **Dry-run mode** | Edge returns “would apply” diff without commit, or uses transaction rollback. |
| **Replay logs** | Record inputs/outputs for deterministic replay in lower env for debugging. |
| **Limited operators** | Named allowlist of real users on staging; no public beta. |
| **Rollback expectations** | Feature flags off; queue drain; revert Edge version; DB forward-only migrations require compensating migration plan (avoid if possible in pilot). |
| **Feature flags** | Per-environment toggles for each capability row in the gating matrix. |

---

## 10. Explicit freeze list

Until **authority review completes** and **staging write safety** is explicitly approved:

- **No migrations** for WhatsApp governance or audit unless under a separate CR-approved change window.
- **No repair / db push / db pull** for schema reconciliation outside that process.
- **No production writes** beyond what is already deployed and contractually accepted today.
- **No TOOL 5 implementation** or **queue implementation** under this freeze.

**Next step:** Phase 1 — Authority review using `docs/C2C_WRITE_PATH_THREAT_MODEL.md`, `docs/C2C_IMPLEMENTATION_GATING_MATRIX.md`, and `docs/C2C_SAFE_SEQUENCE_ROADMAP.md`.
