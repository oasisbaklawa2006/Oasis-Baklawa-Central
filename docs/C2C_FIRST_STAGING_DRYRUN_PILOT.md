# C2C — First staging dry-run pilot (candidate definition)

**Status:** Design-only. **No staging execution authorized** by this document.  
**Scope:** Staging environment, **shadow mode**, **dry-run** — no customer-visible sends, no production writes, no finance, no dispatch, no TOOL 5.

---

## 1. Pilot purpose

- Prove **end-to-end instrumentation**: correlation IDs, actor traces, idempotency keys, queue semantics, rollback paths, and audit records — **without** delivering messages to real customers or mutating production state.
- Train operators and engineers on **pilot cadence** (start, monitor, abort, post-run review) under the production write freeze.
- Produce **evidence artifacts** (logs, dashboards, exported traces) required by `C2C_STAGING_PILOT_ACCEPTANCE_CRITERIA.md` before any **real** staging send is considered.

---

## 2. Why this pilot is safest first

| Property | Rationale |
|----------|-----------|
| Shadow-only | No outbound traffic to WhatsApp / SMS / email providers for pilot-class actions |
| No production | Blast radius bounded to staging project and synthetic identities |
| Audit-first | Every dry-run step emits a durable **simulated audit** record (or log line with mandatory fields) before “completion” |
| Replay-safe design | Same dry-run request with same idempotency key collapses to one **logical** dry-run outcome in design |
| No finance / dispatch | Eliminates monetary and logistics side effects entirely |
| Rollback-first | “Completion” is a **state flag** on a dry-run record, trivially reset or discarded |

---

## 3. Explicit exclusions

The following are **out of scope** for this pilot candidate (any attempt = abort):

- **Customer-visible sends** (any real provider API call with production or non-test destination numbers).
- **Production** database, auth, storage, or Edge deployment targets.
- **TOOL 5** (any override / break-glass automation not explicitly chartered elsewhere).
- **Finance authority** (wallet, payout, invoice, payment status, credit release).
- **Dispatch authority** (status transitions that gate or confirm physical shipment).
- **Queue automation** that performs writes without a human “start dry-run” boundary.
- **Bulk** outbound or bulk status changes beyond a **small fixed cap** of synthetic rows (e.g. ≤ 3) if bulk simulation is ever tested — default is **single** dry-run thread.

---

## 4. Shadow-only architecture (conceptual)

```
[Operator UI (staging)] 
    → [Pilot API / worker boundary — STAGING ONLY]
        → [Validator: JWT, actor, idempotency key present]
        → [Simulated queue: in-memory or staging-only table "dry_run_queue"]
        → [Simulated audit sink: staging table or structured logs]
        → [Provider adapter: NO-OP or MOCK — returns deterministic fake IDs]
        → [Observability: metrics + traces with correlation_id]
```

- **No** shared queues with production.  
- **No** shared credentials with production.  
- **No** “fallback to prod” code paths.

---

## 5. Dry-run execution flow (high level)

1. Operator starts **dry-run session** (staging) with declared **scenario id** (e.g. `DRYRUN_OPERATOR_REPLY_V1`).
2. System validates **identity**, **idempotency key**, and **staging project** fingerprint.
3. Enqueues a **simulated job** (never calls real provider).
4. Writes **simulated audit** row: `intent=operator_reply`, `state=accepted`, `correlation_id`, `replay_key`.
5. Simulates provider: returns `simulated_provider_message_id` (UUID).
6. Simulates retry path (optional branch): second internal hop **must** dedupe via same idempotency key — **no second logical send**.
7. Simulates rollback: sets dry-run record to `rolled_back`, emits observability event.
8. Marks **dry-run completion** with timestamps and pass/fail against success criteria.

*(Implementation is future work; this section defines the intended behavior.)*

---

## 6. No-send guarantees

| Guarantee | How it is enforced (design) |
|-----------|----------------------------|
| No real WhatsApp / Click2API / MSG91 traffic | Provider adapter is **mock-only** in pilot profile; network egress denylist for provider hosts optional extra layer |
| No accidental prod | Staging Supabase URL + staging anon key only in client config; human checklist confirms env banner |
| No PII from prod | Test phone numbers from a **published test range** or purely synthetic E.164 that routes nowhere |

---

## 7. Audit-first guarantees

- **Before** marking simulated “delivered,” a **simulated audit** entry must exist with the same `correlation_id`.
- Audit records are **append-only** in design (no silent delete); corrections use a new row or `correction_of` link (future schema).
- Operator **actor_id** must come from **verified** staging JWT in the eventual implementation — not from unauthenticated JSON during dry-run hardening phase.

---

## 8. Replay protection assumptions

- Every dry-run HTTP request carries **`Idempotency-Key`** (or equivalent body field) and optional **`Replay-Id`** (nonce) with short TTL in design.
- Replaying the **same** body + key within TTL returns **same** `dry_run_outcome_id` without creating duplicate simulated sends.
- Replays **outside** TTL are rejected or create a **new** dry-run only if explicitly allowed by scenario config (default: reject).

---

## 9. Rollback assumptions

- Rollback = transition dry-run aggregate state to `aborted` or `rolled_back` and emit `rollback.trace_id`.
- **No** compensating provider call (nothing to undo externally).
- Rollback must complete within a defined **SLO** (for example under 30 seconds) in implementation; this doc only requires that the design includes a measurable completion signal.

---

## 10. Staging isolation requirements

See **`C2C_STAGING_ISOLATION_CHARTER.md`** for full detail. Minimum bar:

- Separate Supabase project (or strictly isolated schema + keys **not** accepted by production — project-level isolation preferred).
- Separate Vercel / hosting preview pointing **only** at staging.
- No shared **service role** key between prod and staging for pilot workers.

---

## 11. Operator visibility rules

- UI must show persistent **“DRY-RUN — NO REAL SEND”** banner (implementation phase).
- Operator sees: scenario name, idempotency key used, correlation id, simulated provider id, final state.
- Operators **must not** paste production customer numbers into staging during exercises (training item).

---

## 12. Failure handling

| Failure class | Outcome |
|----------------|---------|
| Validation failure | `dry_run_failed` + reason code; **no** simulated provider hop |
| Simulated queue stuck | Watchdog marks `timed_out`; alert fires |
| Audit write failure | **Halt** progression; state = `audit_blocked` — never simulate “sent” |
| Observability sink down | Pilot may continue only if local structured log fallback is defined; else abort |

---

## 13. Abort conditions

Abort immediately if **any** of:

- Unexpected **non-staging** URL or key detected in configuration fingerprint.
- Attempt to call **real** provider adapter (detected by integration test or manual gate).
- Duplicate simulated send count greater than zero for same idempotency key (design violation).
- Finance or dispatch tables referenced by pilot code path (static analysis / allowlist failure in future CI).

---

## 14. Success criteria

| # | Criterion |
|---|-----------|
| S1 | 100% of dry-run completions include `correlation_id`, `actor_id`, `idempotency_key` in observability export |
| S2 | Replay of identical request within TTL produces **one** logical outcome id |
| S3 | Zero real provider API calls attributed to pilot (verified by egress logs or mock assertion) |
| S4 | Rollback drill produces `rolled_back` state and matching trace within SLO |
| S5 | Post-run report signed by engineering + one operator delegate |

---

## 15. Production-forbidden behaviors

- Using production keys, production Edge URLs, or production databases for dry-run.
- “Shadow sending” to real customer devices for “confidence.”
- Enabling TOOL 5, finance hooks, or dispatch hooks under dry-run flag.
- Declaring pilot “done” without go/no-go checklist (`C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`).

---

## Cross-links

- `C2C_DRYRUN_MESSAGE_FLOW.md`
- `C2C_STAGING_ISOLATION_CHARTER.md`
- `C2C_DRYRUN_OBSERVABILITY_SPEC.md`
- `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`
- `C2C_REAL_WRITE_BLOCKERS_AFTER_DRYRUN.md`
- `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md`
- `C2C_MASTER_GOVERNANCE_INDEX.md`
