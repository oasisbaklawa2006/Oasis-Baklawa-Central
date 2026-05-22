# C2C — Idempotency and replay review

**Scope:** Documentation-only analysis of duplicate-send, replay, queue, and UI concurrency patterns in the current codebase (no edits).

---

## 1. Current duplicate-send risks

| Risk | Locus | Mechanism |
|------|-------|-----------|
| Double-click / double Enter on Send | `WhatsAppInbox` `handleSendReply` | `replySending` mitigates within one tab; **no** idempotency key on request body |
| Retry after network timeout | Same | User may retry when uncertain if first request succeeded → **second outbound row** possible |
| Parallel tabs | Same session | Each tab can submit; **no** cross-tab mutex |
| Admin `send-whatsapp` buttons | `OrderManagement`, `AdminSettings` | Independent triggers; provider may deliver twice |
| Outbox processor | `processOutboxQueue` | Two admins / two tabs could process overlapping `pending` batches before status flips |

---

## 2. Current replay risks

| Class | Notes |
|-------|--------|
| **HTTP replay to Edge** | Functions with `verify_jwt = false` accept replays if URL + anon key leak or if WAF rules are weak |
| **Webhook provider retries** | WhatsApp / MSG91 / Click2API may retry delivery of **their** callbacks — handler must dedupe by provider message id |
| **Cron HTTP replay** | pg_cron scheduled POSTs could duplicate if job definitions overlap during deploy windows |
| **Internal Edge chain** | `whatsapp-operator-reply` → `send-whatsapp` is a second hop; partial failures leave `whatsapp_messages` in intermediate states until update |

---

## 3. Queue replay risks

- **`notification_outbox`:** Rows remain `pending` until processed; **re-processing** the same row after a partial success (email sent, DB update failed) depends on ordering of operations in the loop — currently update to `sent` happens after invoke returns success; **still vulnerable** if invoke succeeds but update throws (unlikely in JS flow, but network partition to DB is possible in theory).
- **No lease field** observed in the reviewed processor — cannot prove single-consumer semantics under concurrency.

---

## 4. Missing idempotency keys

- Client `invoke` calls lack a standard **`Idempotency-Key`** (or UUID in body) reused on retry.
- `send-whatsapp` does not accept an application-level dedupe token in the reviewed contract.
- `whatsapp-operator-reply` creates a **new** DB row per invocation — natural duplicate if upstream retries.

---

## 5. Missing correlation guarantees

- No uniform **`x-correlation-id`** or `trace_id` propagated from UI → Edge → `debug_webhooks` / `audit_logs` / provider logs.
- Operator actions log fragments to console in Edge — **not** queryable correlation.

---

## 6. Missing dedupe guarantees

- No global **“sent fingerprint”** table (hash of recipient + normalized body + time window).
- Provider `messageId` stored on success paths for some flows — good for **manual** reconciliation but not wired as a **hard dedupe gate** on ingress for all paths.

---

## 7. UI retry ambiguity

- **Alerts on failure** (`alert(...)`) — user cannot tell “did it send?” vs “did logging fail?” without checking DB or customer device.
- **Silent refresh** on success may reorder list — operator may not see their message anchor immediately if batch fetch errors (`messagesBatchWarnings` path).

---

## 8. Event ordering ambiguity

- **Realtime debounce** (~480ms) collapses bursts — last writer wins in UI state, not necessarily message timeline order for concurrent packets.
- **Postgres realtime** does not guarantee causal ordering across tables — classify then route suggestions may race with inbound messages closing a packet.

---

## 9. Safe read-only assumptions

- Viewing stitched packets and local-only **notes / saved views** in `localStorage` does not create duplicate sends.
- Read-only observability panels depend on **SELECT** paths — replay of reads is safe (aside from load).

---

## 10. Required future protections

1. **Idempotency-Key** on: operator reply, `send-whatsapp`, finance-adjacent notifications, draft creation.
2. **Dedupe store** keyed by provider message id + internal UUID.
3. **Exactly-once-ish outbox** via `FOR UPDATE SKIP LOCKED` worker (database or Edge cron with lease).
4. **Correlation ID** middleware contract for all `invoke` sites.
5. **Dead-letter queue** for failed sends with explicit human reconciliation UX (not silent drop).

---

## 11. Staging validation scenarios (recommended)

| # | Scenario | Pass criteria |
|---|----------|----------------|
| S1 | Double-click send within 200ms | At most one provider send; one outbound row |
| S2 | Retry after 504 from Edge | Dedupe rejects second provider send OR returns same `messageId` |
| S3 | Two tabs same operator | Second tab blocked or no-op with visible reason |
| S4 | Webhook duplicate delivery | Second insert suppressed or merged |
| S5 | Outbox partial failure | Row in `failed` with error; **no** silent duplicate email |
| S6 | Provider success, DB update failure | Reconciler detects orphan provider id and heals row |

---

## 12. Production-stop conditions (governance)

Treat as **hard stops** for removing write freeze (non-exhaustive):

- **Any** high-volume customer-facing send path without idempotency + correlation + alertable DLQ.
- **Any** finance or wallet mutation without row-level locking semantics proven under test.
- **Outbox** still processed from arbitrary browser sessions without worker identity.
- **JWT-off** Edge functions that perform writes remain reachable without stronger network controls **and** signed requests.

---

## Code anchors (inspection)

- `src/components/WhatsAppInbox.tsx` — `handleSendReply`, realtime debounce, `replySending`
- `src/utils/notificationOutbox.ts` — `processOutboxQueue`
- `supabase/functions/whatsapp-operator-reply/index.ts` — insert then `send-whatsapp` fetch
- `supabase/functions/send-whatsapp/index.ts` — provider fallback, `retry_count: 0` insert field
- `supabase/config.toml` — `verify_jwt` map
