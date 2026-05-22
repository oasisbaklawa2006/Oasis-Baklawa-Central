# C2C — Write observability requirements

**Purpose:** Define what must be **visible** when staging (and later production) writes exist. **Documentation only** — no dashboards or code in this sprint.

---

## 1. Required logs (structured)

| Log event | Fields (minimum) | Retention |
|-----------|-------------------|-----------|
| `write_attempt_start` | correlation_id, request_id, actor_id, action, packet_id, client_version | ≥ 30d staging |
| `write_attempt_denied` | deny_reason_enum, auth_context_hash (no secrets) | same |
| `write_attempt_success` | new_version, provider_message_id (if any) | same |
| `write_attempt_error` | exception_class, safe_message, retryable_flag | same |
| `audit_append` | audit_row_id, correlation_id, outcome | align with audit policy |

---

## 2. Correlation IDs

| Requirement | Detail |
|-------------|--------|
| **Single end-to-end id** | Generated at Edge entry; returned to client; echoed in audit and provider callbacks. |
| **Format** | UUID v4 or ULID; document max length for DB columns. |
| **Propagation** | Mandatory across: Edge → DB → external API → webhooks (future). |

---

## 3. Request IDs

| Requirement | Detail |
|-------------|--------|
| **Per HTTP request** | Distinct from correlation if fan-out (one user action → multiple internal requests). |
| **Header** | e.g. `x-request-id` from client optional; server always sets authoritative id. |

---

## 4. Actor tracking

| Field | Source |
|-------|--------|
| `actor_sub` | JWT `sub` |
| `actor_role` | Mapped role at decision time |
| `impersonation_of` | null unless break-glass (must be explicit) |

---

## 5. Packet version tracking

| Metric / field | Use |
|----------------|-----|
| `packet_version` or `row_version` | Optimistic locking |
| `version_mismatch_total` | Alert if spike — indicates UX or realtime issue |
| `last_mutation_at` | Server timestamp |

---

## 6. Mutation timing

| Signal | Use |
|--------|-----|
| Latency p50/p95/p99 | Edge handler + DB transaction + external API |
| `db_lock_wait_ms` | Detect contention early |
| `external_api_latency_ms` | WhatsApp / provider SLA tracking |

---

## 7. Duplicate detection

| Signal | Use |
|--------|-----|
| `idempotency_replay_total` | Same key, no double effect — expected small |
| `idempotency_conflict_total` | Same key, different body — alert CRITICAL |
| `duplicate_provider_message_total` | Should be **zero**; page immediately |

---

## 8. Retry visibility

| Requirement | Detail |
|-------------|--------|
| **Classify retries** | user-initiated vs worker backoff vs infra retry |
| **Max attempts** | Cap with alert on exhaustion |
| **UI** | Show “in progress” with safe timeout message |

---

## 9. Failure classification

| Class | Examples | User messaging |
|-------|----------|----------------|
| **Transient** | Provider 5xx, network blip | Retry with backoff |
| **Conflict** | Version mismatch | Refresh + merge UX |
| **Permanent** | Closed packet, policy deny | Clear error; no blind retry |
| **Security** | JWT invalid | Re-auth; generic message |

---

## 10. Audit reconciliation visibility

| Job / report | Frequency | Pass criteria |
|--------------|-------------|---------------|
| `audit_vs_attempts` | Daily in pilot | counts match |
| `orphan_mutations` | Daily | zero rows (mutation without audit) |
| `orphan_audits` | Daily | explainable (e.g. denied before mutate) |

---

## 11. Dashboard requirements (staging)

| Panel | Minimum widgets |
|-------|-----------------|
| **Write health** | success / denied / error rates by action |
| **Auth** | JWT failures, role denials |
| **Conflicts** | version mismatch rate |
| **Duplicates** | idempotency replay vs conflict |
| **Audit** | append failures, reconciliation gap |
| **SLO** | p95 latency budget vs threshold |

---

## 12. Alert thresholds (initial guidance)

| Alert | Suggested staging threshold |
|-------|----------------------------|
| `duplicate_provider_message_total > 0` | Page immediately |
| `audit_append_failure_total > 0` over 5m | Page |
| `auth_fail_rate` spike > 10× baseline | Warn → page if sustained |
| `conflict_rate` > X% of writes | Warn; tune X per pilot volume |

Thresholds are **starting points**; calibrate with baseline after shadow mode.

---

## Cross-links

- Pilot gating: `docs/C2C_STAGING_WRITE_PILOT_MASTER_PLAN.md`  
- Lifecycle: `docs/C2C_WRITE_LIFECYCLE_SEQUENCE.md`  
- Rollback: `docs/C2C_ROLLBACK_AND_RECOVERY_STRATEGY.md`  
- Threats: `docs/C2C_WRITE_PATH_THREAT_MODEL.md`
