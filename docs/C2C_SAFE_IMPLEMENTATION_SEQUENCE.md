# C2C — Safe implementation sequence

**Purpose:** **Hard-ordered** phases for moving from governance-only work to a **limited staging pilot** and eventual production decision. Order matters — later phases assume earlier evidence exists.

**Global constraint (this program):** Phases that change runtime, Edge, schema, or deploy are **out of scope** until governance explicitly exits doc-only mode. This document defines **what must happen next**, not an execution ticket.

---

## PHASE 0 — Docs + audit + freeze

| Item | Detail |
|------|--------|
| **Prerequisites** | Program charter accepted; write freeze communicated. |
| **Forbidden shortcuts** | Skipping threat / idempotency / JWT audits “because we know the code.” |
| **Required evidence** | Published doc set + index (`C2C_MASTER_GOVERNANCE_INDEX.md`); risk register started. |
| **Rollback expectations** | N/A (no production behavior change). |
| **Stop conditions** | None — continuous documentation improvement allowed. |

---

## PHASE 1 — JWT hardening review

| Item | Detail |
|------|--------|
| **Prerequisites** | PHASE 0 complete; per-function inventory of ingress (JWT off vs on). |
| **Forbidden shortcuts** | Blanket `verify_jwt = true` without fixing webhook/cron/OTP callers. |
| **Required evidence** | Matrix: function → ingress decision → compensating control (HMAC, mTLS, IP allowlist, signed body) → owner sign-off. |
| **Rollback expectations** | Config revert path documented per environment. |
| **Stop conditions** | Any pilot-class function **without** a signed ingress decision → **stop** implementation. |

---

## PHASE 2 — Idempotency + correlation design

| Item | Detail |
|------|--------|
| **Prerequisites** | PHASE 1 decisions for pilot-scope functions frozen in writing. |
| **Forbidden shortcuts** | Client-only UUID in body without server-side dedupe store. |
| **Required evidence** | Idempotency key schema, TTL, dedupe key (e.g. hash), correlation ID propagation diagram UI→Edge→DB→provider. |
| **Rollback expectations** | Feature flag to disable new headers / keys if clients misbehave. |
| **Stop conditions** | Cannot demonstrate dedupe across **two tabs** and **retry** → do not enter PHASE 6. |

---

## PHASE 3 — Immutable audit guarantees

| Item | Detail |
|------|--------|
| **Prerequisites** | PHASE 2 design approved for pilot tables. |
| **Forbidden shortcuts** | Best-effort `audit_logs.insert` after the fact without transactional linkage to mutation. |
| **Required evidence** | Pattern chosen: transactional outbox, two-phase log, or DB trigger — with failure tests. |
| **Rollback expectations** | Audit-only mode: mutations disabled if audit path unhealthy (circuit breaker policy). |
| **Stop conditions** | Measured audit divergence in staging > **zero** tolerance for pilot scope → halt widen. |

---

## PHASE 4 — Lock semantics

| Item | Detail |
|------|--------|
| **Prerequisites** | PHASE 3 pattern proven on non-customer-facing staging objects (optional dry run). |
| **Forbidden shortcuts** | UI “lock” banner without server-enforced TTL and renewal. |
| **Required evidence** | Lock row schema, TTL, heartbeat, forced release, and concurrent-operator test logs. |
| **Rollback expectations** | Admin break-glass unlock with mandatory audit row. |
| **Stop conditions** | Lock expiry race reproduced without safe resolution → redesign locks before pilot. |

---

## PHASE 5 — Queue isolation

| Item | Detail |
|------|--------|
| **Prerequisites** | PHASE 4 locks defined for packet (or equivalent resource) if concurrent writes exist. |
| **Forbidden shortcuts** | “Run processOutboxQueue more carefully” as the isolation story. |
| **Required evidence** | Worker identity, `SKIP LOCKED` or equivalent, DLQ, metrics for stuck rows. |
| **Rollback expectations** | Drain queue to paused state without data loss; replay from checkpoint. |
| **Stop conditions** | Duplicate delivery in staging soak → **stop** widening scope. |

---

## PHASE 6 — Replay-safe staging shadow mode

| Item | Detail |
|------|--------|
| **Prerequisites** | PHASE 2–5 evidence attached for pilot slice. |
| **Forbidden shortcuts** | Shadow mode that still hits production provider endpoints with real customer numbers. |
| **Required evidence** | Shadow logs proving duplicate requests collapse to single side effect **or** single explicit “would send” record. |
| **Rollback expectations** | Shadow flag off → zero provider calls within SLO. |
| **Stop conditions** | Any shadow leak to prod DB or prod provider → immediate halt + incident review. |

---

## PHASE 7 — Rollback validation

| Item | Detail |
|------|--------|
| **Prerequisites** | PHASE 6 passed; kill switches identified. |
| **Forbidden shortcuts** | Rollback plan only in chat — must be versioned runbook. |
| **Required evidence** | Timed drill: freeze send path, verify metric drop, restore, verify recovery ≤ agreed SLO. |
| **Rollback expectations** | Same as drill — validated, not theoretical. |
| **Stop conditions** | Rollback exceeds SLO or fails once → **no pilot** until second successful drill. |

---

## PHASE 8 — Observability verification

| Item | Detail |
|------|--------|
| **Prerequisites** | Correlation IDs from PHASE 2 wired into logs/metrics for pilot paths. |
| **Forbidden shortcuts** | Relying solely on Supabase dashboard filters without alerts. |
| **Required evidence** | Dashboards / alerts for: duplicate send rate, Edge 5xx, provider 429, queue depth, DLQ rate. |
| **Rollback expectations** | On-call runbook with query pack links. |
| **Stop conditions** | Blind spots on any pilot-class side effect → stop. |

---

## PHASE 9 — Limited staging pilot

| Item | Detail |
|------|--------|
| **Prerequisites** | `C2C_STAGING_PILOT_ACCEPTANCE_CRITERIA.md` all **PASS** for declared scope. |
| **Forbidden shortcuts** | Expanding scope mid-pilot without new acceptance review. |
| **Required evidence** | Daily report: errors, duplicates, finance touches, anomalies; sign-off log. |
| **Rollback expectations** | Pilot suspension ≤ agreed time if red metric fires. |
| **Stop conditions** | Any **RED** scenario from `C2C_FAILURE_SCENARIO_TABLETOP.md` reproduced → suspend. |

---

## PHASE 10 — Authority validation

| Item | Detail |
|------|--------|
| **Prerequisites** | PHASE 9 stable over org-defined window. |
| **Forbidden shortcuts** | “RBAC looks fine” without test cases for negative paths. |
| **Required evidence** | Test matrix: forbidden role → forbidden action → denied with audit. |
| **Rollback expectations** | Role flag revert; emergency deny-all for pilot role. |
| **Stop conditions** | Any successful privilege escalation in staging → production denied. |

---

## PHASE 11 — Production go / no-go review

| Item | Detail |
|------|--------|
| **Prerequisites** | PHASE 10 + scorecard GREEN for production-targeted rows; risk register signed. |
| **Forbidden shortcuts** | Production cutover without finance + security named approvers. |
| **Required evidence** | Signed go/no-go memo; support playbook; comms template for customer-visible failures. |
| **Rollback expectations** | Same as PHASE 7, proven again post-implementation delta. |
| **Stop conditions** | Any unresolved **production blocker = Y** in acceptance criteria → **NO-GO**. |

---

## Ordering rule

If a later phase feels “almost done” while an earlier phase lacks evidence, **the program state regresses** — update scorecard to RED/AMBER and widen freeze communication.

---

## Cross-links

- `C2C_MASTER_GOVERNANCE_INDEX.md`
- `C2C_STAGING_PILOT_ACCEPTANCE_CRITERIA.md`
- `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md`
