# C2C — Dry-run observability spec

**Purpose:** Define **minimum** observability for the staging-only dry-run pilot so evidence is auditable, replay reviewable, and rollback verifiable. **No implementation** in this PR.

---

## Identifiers and traces

| Concept | Definition | Format / notes |
|---------|------------|----------------|
| **correlation_id** | Single thread id for one dry-run attempt from UI through all stages | UUID v4; propagated on every span and log line |
| **replay_id** | Short-lived nonce proving freshness of request | UUID or high-entropy string; TTL e.g. 10 minutes (implementation) |
| **idempotency_key** | Client-supplied key for safe retries | Stable string per user intent; max length TBD |
| **simulated_provider_message_id** | Fake provider id returned by mock | UUID; must never match a real provider id pattern from prod logs |
| **dry_run_outcome_id** | Aggregate id for final terminal state | UUID |
| **actor_trace** | Verified subject for the action | `actor_sub` from JWT + `actor_role` snapshot at request time |
| **queue_trace** | Queue hop correlation | `queue_job_id`, `enqueue_seq`, `dequeue_seq` |
| **retry_trace** | Retry attempts | `retry_attempt` integer monotonic per `queue_job_id` |
| **rollback_trace** | Rollback sub-flow | `rollback_trace_id` UUID; parent `correlation_id` |
| **lifecycle timestamps** | Ordered times | `received_at`, `validated_at`, `queued_at`, `audit_written_at`, `mock_sent_at`, `completed_at` (all ISO-8601 UTC) |

---

## Dry-run completion states

| State | Meaning |
|-------|---------|
| `dryrun_received` | Request accepted at edge |
| `dryrun_validated` | Validation passed |
| `dryrun_queued` | Simulated enqueue succeeded |
| `dryrun_audit_written` | Simulated audit append succeeded |
| `dryrun_mock_sent` | Mock provider returned success |
| `dryrun_retry_simulated` | Retry branch exercised (still idempotent) |
| `dryrun_rollback_simulated` | Rollback branch exercised |
| `dryrun_completed` | Terminal success |
| `dryrun_failed` | Terminal failure with `reason_code` |
| `dryrun_aborted` | Operator or system abort before terminal |
| `dryrun_duplicate_suppressed` | Same idempotency key replay handled |

---

## Dry-run failure states (non-terminal vs terminal)

| State | Typical cause |
|-------|----------------|
| `validation_failed` | Missing key / wrong env |
| `audit_blocked` | Audit sink failure |
| `queue_stuck` | Lease / worker issue (future) |
| `mock_provider_error` | Injected test failure |
| `rollback_stuck` | Rollback SLO exceeded |
| `timed_out` | Watchdog |

---

## Dashboard expectations (minimum)

| Panel | Content |
|-------|---------|
| Throughput | Dry-runs started / completed / failed per hour |
| Idempotency | Count of `duplicate_suppressed` (should be ≥ 0; spikes investigated) |
| Latency | p50/p95 stage timings (`validation`, `queue`, `audit`, `mock`) |
| Safety | **Confirmed mock** invocations = 100% of “send” stages; real provider call count = **0** |
| Rollback | Rollback success rate; SLO breach count |

---

## Minimum logs required (structured)

Each log line **must** include: `correlation_id`, `dry_run_outcome_id` (once assigned), `scenario_id`, `level`, `message`, `stage`, `duration_ms` (optional).

Forbidden: logging **production** secrets or **full** message bodies containing real PII in staging pilot v1 (use hashes).

---

## Staging alert requirements

| Alert | Condition | Severity |
|-------|-----------|----------|
| `DryRunRealProviderCall` | Any egress to disallowed provider host | P0 |
| `DryRunProdKeyFingerprint` | Config matches prod project fingerprint | P0 |
| `DryRunIdempotencyViolation` | Two logical sends for same key | P0 |
| `DryRunRollbackSLOBreach` | Rollback exceeds agreed threshold | P1 |
| `DryRunAuditGap` | Completed without prior audit stage | P0 |

---

## Validation evidence requirements

For go/no-go binder, export **one JSON bundle per dry-run** containing:

- All identifiers above  
- Ordered state transitions with timestamps  
- Retry and rollback traces (or explicit `null` if branch skipped)  
- Redacted payload hash (`sha256` of canonicalized body)

---

## Cross-links

- `C2C_DRYRUN_MESSAGE_FLOW.md`
- `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`
- `C2C_STAGING_ISOLATION_CHARTER.md`
