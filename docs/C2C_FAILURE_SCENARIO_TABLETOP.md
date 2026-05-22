# C2C — Failure scenario tabletop

**Method:** For each scenario: **symptom**, **blast radius**, **current mitigation**, **missing mitigation**, **observability signal**, **rollback requirement**, **block production? (Y/N)**.

This is a **pre-staging** governance exercise — not an incident log.

---

## Scenarios

### 1. Duplicate operator send

| Field | Content |
|-------|---------|
| Symptom | Customer receives two identical or near-identical WhatsApp texts |
| Blast radius | Reputational + potential compliance complaint |
| Current mitigation | `replySending` disables button in single tab |
| Missing mitigation | Idempotency key, server dedupe, packet send lease |
| Observability | `whatsapp_messages` duplicate outbound rows; `debug_webhooks` duplicates |
| Rollback requirement | Ability to freeze `whatsapp-operator-reply` / `send-whatsapp` at edge gateway |
| Block production? | **Y** until idempotency proven |

---

### 2. Stale packet ownership

| Field | Content |
|-------|---------|
| Symptom | Reply attributed to wrong thread or wrong contact phone |
| Blast radius | Wrong customer sees sensitive context |
| Current mitigation | UI selects packet from visible list; phone from joined contact |
| Missing mitigation | Server-side coherence check packet↔contact↔phone; version column |
| Observability | Mismatch in DB foreign keys; customer support tickets |
| Rollback requirement | Disable sends; mark packet `open`/`closed` consistently |
| Block production? | **Y** for automated routing; **Y** if ingress is public without JWT |

---

### 3. Retry storm

| Field | Content |
|-------|---------|
| Symptom | Spike in Edge invocations and provider API usage |
| Blast radius | Cost overrun + provider rate ban |
| Current mitigation | Provider-level single-call fallback only |
| Missing mitigation | Exponential backoff queue; global rate limiter |
| Observability | Edge logs; provider HTTP 429; `debug_webhooks` volume |
| Rollback requirement | Kill switch on `send-whatsapp` |
| Block production? | **Y** for unsupervised automation |

---

### 4. Queue replay

| Field | Content |
|-------|---------|
| Symptom | Same outbox email or WA notification delivered multiple times |
| Blast radius | Customer annoyance; finance mis-signaling |
| Current mitigation | Status flip to `sent` after successful invoke |
| Missing mitigation | Row lease + idempotent provider send id |
| Observability | Multiple `sent_at` updates impossible — instead duplicate rows if re-inserted |
| Rollback requirement | Pause `processOutboxQueue` triggers in admin UI |
| Block production? | **Y** for finance-critical templates without worker redesign |

---

### 5. Partial failure after audit write

| Field | Content |
|-------|---------|
| Symptom | Audit says action happened; downstream did not |
| Blast radius | Forensics lie; operators trust wrong state |
| Current mitigation | Some flows write audit near mutation; varies by page |
| Missing mitigation | Transactional outbox pattern (DB txn wraps audit + mutation) |
| Observability | Divergence between `audit_logs` and domain tables |
| Rollback requirement | Manual reconciliation playbook |
| Block production? | **Y** for regulated finance claims |

---

### 6. Audit write succeeds but send fails

| Field | Content |
|-------|---------|
| Symptom | Compliance log shows send; customer got nothing |
| Blast radius | False confidence during dispute |
| Current mitigation | `send-whatsapp` writes audit on **failure** path for API errors |
| Missing mitigation | Unified lifecycle state machine linking audit ↔ message row |
| Observability | `audit_logs` vs `whatsapp_messages.status` |
| Rollback requirement | Corrective audit entry policy (human) |
| Block production? | **N** for general ops if processes exist; **Y** if audit is legal evidence |

---

### 7. Send succeeds but audit fails

| Field | Content |
|-------|---------|
| Symptom | Message delivered; no audit trail |
| Blast radius | Non-repudiation loss |
| Current mitigation | `whatsapp_messages` row may still exist for operator path |
| Missing mitigation | Mandatory structured log export to SIEM independent of `audit_logs` insert |
| Observability | Gap in `audit_logs`; provider dashboard may still show send |
| Rollback requirement | Backfill script (ops) — not defined in repo |
| Block production? | **Y** if audit is contractual |

---

### 8. Finance release race

| Field | Content |
|-------|---------|
| Symptom | Double release, wrong wallet balance, duplicate dispatch eligibility |
| Blast radius | Monetary loss |
| Current mitigation | DB updates scoped by `eq("id", …)`; UI flows sequential |
| Missing mitigation | Serializable transactions / row locks / idempotency keys |
| Observability | `wallet_transactions` duplicates; conflicting `order_status_history` |
| Rollback requirement | Finance freeze + manual ledger correction |
| Block production? | **Y** without locking proof |

---

### 9. Packet reassignment race

| Field | Content |
|-------|---------|
| Symptom | Two operators act on same packet concurrently |
| Blast radius | Duplicate sends or conflicting classifications persisted (when writes exist) |
| Current mitigation | Suggest-only classify/route in inbox |
| Missing mitigation | Packet lock + version |
| Observability | Overlapping `whatsapp_messages` timestamps; operator console logs |
| Rollback requirement | Administrative packet reset (process) |
| Block production? | **Y** when routing writes enabled |

---

### 10. WebSocket stale state

| Field | Content |
|-------|---------|
| Symptom | UI shows outdated packet list while sends already happened |
| Blast radius | Operator confusion; duplicate user actions |
| Current mitigation | Debounced reload on realtime events |
| Missing mitigation | Per-packet version in UI banner; conflict modal |
| Observability | Client-side refresh counters (partially present via observability hook) |
| Rollback requirement | Force full page reload SOP |
| Block production? | **N** alone; **Y** combined with missing idempotency |

---

### 11. Operator disconnect during action

| Field | Content |
|-------|---------|
| Symptom | Unknown outcome after click |
| Blast radius | Duplicate retry from human |
| Current mitigation | Alert-based error surfacing |
| Missing mitigation | Deterministic client retry token; server dedupe |
| Observability | Edge logs; partial DB rows |
| Rollback requirement | Operator checks `whatsapp_messages` |
| Block production? | **Y** without dedupe |

---

### 12. JWT bypass attempt

| Field | Content |
|-------|---------|
| Symptom | Unauthenticated caller invokes `verify_jwt=false` function |
| Blast radius | Full service-role power if handler uses service key without checks |
| Current mitigation | URL obscurity + platform network controls (assumed ops) |
| Missing mitigation | JWT verify, signed webhooks, mTLS |
| Observability | Anomalous IP; spike in `debug_webhooks` |
| Rollback requirement | Revoke anon abuse; rotate keys |
| Block production? | **Y** for any externally exposed write |

---

### 13. Replayed request

| Field | Content |
|-------|---------|
| Symptom | Identical HTTP replay produces duplicate side effects |
| Blast radius | Same as duplicate send / duplicate finance |
| Current mitigation | None systematic |
| Missing mitigation | Nonces, idempotency keys, short-lived signed tokens |
| Observability | Identical payloads in logs within seconds |
| Rollback requirement | Disable endpoint |
| Block production? | **Y** |

---

### 14. Expired request replay

| Field | Content |
|-------|---------|
| Symptom | Old signed URL or token reused |
| Blast radius | Same as replay |
| Current mitigation | Depends on provider tokens (not uniform) |
| Missing mitigation | Timestamp + TTL enforcement in handler |
| Observability | Clock skew logs |
| Rollback requirement | Token version bump |
| Block production? | **Y** |

---

### 15. Malicious client replay

| Field | Content |
|-------|---------|
| Symptom | Attacker harvests valid request and repeats |
| Blast radius | Data exfiltration or spam |
| Current mitigation | Session cookies / CORS (browser); not enough for Edge |
| Missing mitigation | User-bound signatures, CSRF for cookie flows, rotate refresh |
| Observability | Auth anomalies |
| Rollback requirement | Block user / IP |
| Block production? | **Y** |

---

### 16. localStorage corruption

| Field | Content |
|-------|---------|
| Symptom | Notes / filters lost or JSON parse throws |
| Blast radius | UX only for notes; **must not** affect server authority |
| Current mitigation | Try/catch patterns in persistence helpers (verify per file before relying) |
| Missing mitigation | Schema version + migration of local prefs |
| Observability | Client console errors |
| Rollback requirement | Clear localStorage key SOP |
| Block production? | **N** for server safety if no secrets in local notes |

---

### 17. Stale optimistic UI

| Field | Content |
|-------|---------|
| Symptom | Operator believes message sent; it failed |
| Blast radius | SLA breach perception |
| Current mitigation | Alerts on failure; silent reload on success |
| Missing mitigation | Explicit pending / delivered markers per message id in thread |
| Observability | `whatsapp_messages.status` |
| Rollback requirement | Resend flow with dedupe |
| Block production? | **N** if operators trained; **Y** for unsupervised automation |

---

### 18. Packet lock expiry race

| Field | Content |
|-------|---------|
| Symptom | Two operators both hold expired locks and act |
| Blast radius | Duplicate writes |
| Current mitigation | Locks not implemented in reviewed inbox path |
| Missing mitigation | Lock TTL + renewal + server enforcement |
| Observability | Overlapping actions in audit trail |
| Rollback requirement | Manual arbitration |
| Block production? | **Y** when locks are introduced incorrectly |

---

## Summary

Most **production-block** answers cluster around: **idempotency**, **JWT / ingress hardening**, **finance locking**, and **queue worker redesign**. Read-only suggest flows and pure UX localStorage issues are lower intrinsic blast radius but still affect operator trust.
