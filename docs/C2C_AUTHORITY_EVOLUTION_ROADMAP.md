# C2C — Authority evolution roadmap

**Purpose:** Ordered **stages** from read-only through production rollout **candidate** — each with allowed/forbidden actions and evidence expectations. **Planning only.**

**Rule:** Do not skip stages for “speed.” Later stages inherit all earlier safeguards unless explicitly waived with executive sign-off.

---

## Stage 0 — Read-only

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | Inbox read, suggestions without persistence, exports, governance docs |
| **Forbidden actions** | Any pilot execution, any new send path, finance/dispatch hooks |
| **Required safeguards** | Existing RLS and roles; no new Edge ingress |
| **Required auditability** | Current operational audit patterns only |
| **Required replay guarantees** | N/A for non-mutating suggest flows |
| **Rollback expectations** | N/A |
| **Production blocker conditions** | Any unsolicited write in scope |

---

## Stage 1 — Dry-run simulation

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | Staging mock pipeline only — per `C2C_FIRST_STAGING_DRYRUN_PILOT.md` |
| **Forbidden actions** | Real provider calls; prod DB; finance/dispatch |
| **Required safeguards** | Mock adapter, staging keys, kill switch |
| **Required auditability** | Simulated audit precedes mock “send” state |
| **Required replay guarantees** | Idempotency key dedupe for dry-run |
| **Rollback expectations** | State flag rollback; zero external side effects |
| **Production blocker conditions** | Any real send; any prod credential |

---

## Stage 2 — Isolated staging shadow writes

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | Writes to **staging-only** tables shadowing prod shape; no customer devices |
| **Forbidden actions** | Customer-visible traffic; shared queues with prod |
| **Required safeguards** | Separate project or provable key isolation |
| **Required auditability** | Append-only shadow audit |
| **Required replay guarantees** | Shadow ingress idempotent |
| **Rollback expectations** | Truncate or archive shadow dataset |
| **Production blocker conditions** | Shadow data contains prod PII dumps |

---

## Stage 3 — Replay-safe staging sends

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | **Sandbox provider** sends to **allowlisted** test destinations only |
| **Forbidden actions** | Arbitrary customer numbers; prod provider billing accounts |
| **Required safeguards** | Rate limits, allowlist, egress monitoring |
| **Required auditability** | Full correlation id on send + provider ack |
| **Required replay guarantees** | Duplicate HTTP replay does not double-send |
| **Rollback expectations** | Kill switch + DLQ human reconciliation |
| **Production blocker conditions** | Duplicate sandbox send; missing DLQ |

---

## Stage 4 — Audited limited operator actions

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | Narrow operator mutations (e.g. single reply) with locks and JWT-bound actor |
| **Forbidden actions** | Bulk send; automation without human boundary |
| **Required safeguards** | Packet lock, verified actor, idempotency store |
| **Required auditability** | Immutable audit chain for pilot tables |
| **Required replay guarantees** | Same idempotency key → one provider job |
| **Rollback expectations** | Compensating internal state + customer comms runbook if needed |
| **Production blocker conditions** | Spoofed operator_id; lock expiry race unresolved |

---

## Stage 5 — Staged authority escalation

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | Additional operator powers behind feature flags with SoD |
| **Forbidden actions** | Break-glass without two-person rule |
| **Required safeguards** | Escalation tickets, time-bound elevation, extra logging |
| **Required auditability** | Every escalation row immutable |
| **Required replay guarantees** | Escalation tokens single-use |
| **Rollback expectations** | Revoke elevation; audit trail preserved |
| **Production blocker conditions** | Single-person unlimited elevation |

---

## Stage 6 — Finance-bound authority

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | Finance-adjacent actions only with locks + idempotency + SoD |
| **Forbidden actions** | Messaging path directly mutating wallets without finance gate |
| **Required safeguards** | Serializable transactions or equivalent; finance approval queue |
| **Required auditability** | Double-entry style logs or compensating pairs |
| **Required replay guarantees** | Payment idempotency keys |
| **Rollback expectations** | Finance freeze playbook |
| **Production blocker conditions** | Any double release; audit divergence |

---

## Stage 7 — Production candidate review

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | Paper review + test harness in staging only |
| **Forbidden actions** | Prod traffic shift |
| **Required safeguards** | Full scorecard green for in-scope rows |
| **Required auditability** | Evidence binder complete |
| **Required replay guarantees** | Chaos tests archived |
| **Rollback expectations** | Production rollback rehearsed on paper + last staging drill |
| **Production blocker conditions** | Open P0 risks without waiver |

---

## Stage 8 — Limited production pilot

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | Small cohort, low rate, monitored sends or mutations in scope |
| **Forbidden actions** | Full rollout; bulk; silent automation |
| **Required safeguards** | Feature flags, SLO alerts, on-call |
| **Required auditability** | Live audit meets legal bar if applicable |
| **Required replay guarantees** | Live dedupe metrics = 0 anomalies |
| **Rollback expectations** | Kill switch tested post-deploy |
| **Production blocker conditions** | Any SLO breach on duplicate or bypass |

---

## Stage 9 — Production rollout candidate

| Dimension | Content |
|-----------|---------|
| **Allowed actions** | Widen cohort after sustained success under metrics |
| **Forbidden actions** | Widening without new go/no-go |
| **Required safeguards** | Gradual ramp with automatic halt triggers |
| **Required auditability** | Continuous sampling audit |
| **Required replay guarantees** | Periodic replay tests in staging mirror of prod config |
| **Rollback expectations** | Versioned rollback per release train |
| **Production blocker conditions** | Missing per-release review |

---

## Cross-links

- `C2C_EXECUTION_FREEZE_MANIFEST.md`
- `C2C_SAFE_IMPLEMENTATION_SEQUENCE.md`
- `C2C_REAL_WRITE_BLOCKERS_AFTER_DRYRUN.md`
- `C2C_OPERATOR_SAFETY_PRINCIPLES.md`
