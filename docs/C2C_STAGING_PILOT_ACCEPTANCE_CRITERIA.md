# C2C — Staging pilot acceptance criteria

**Purpose:** **Objective gates** before authorizing any **staging write pilot**. Until all **PASS** for the **declared pilot scope**, the pilot is **not approved**. **Docs only** — this file does not enable features.

**Severity key:** **P0** = pilot blocker · **P1** = pilot allowed only with written waiver + extra controls · **P2** = must fix before production even if pilot proceeds.

---

## Gate template (how to read)

Each gate lists: **Required evidence** · **Validation method** · **Blocking severity** · **Production blocker? (Y/N)**

---

## JWT validation

| Field | Content |
|-------|---------|
| Required evidence | Signed matrix: each pilot-scope Edge function → `verify_jwt` decision → compensating control if false → owner initials. |
| Validation method | Config review + staged curl tests: unauthenticated request must **fail** for write paths unless documented HMAC/webhook path. |
| Blocking severity | **P0** if absent |
| Production blocker? | **Y** |

---

## Actor validation

| Field | Content |
|-------|---------|
| Required evidence | Actor ID on every pilot mutation sourced from **verified** JWT or worker SA with narrow IAM — not free-form JSON. |
| Validation method | Negative test: tampered `operator_id` in body does not elevate privilege; logs show rejected attempts. |
| Blocking severity | **P0** |
| Production blocker? | **Y** |

---

## Replay protection

| Field | Content |
|-------|---------|
| Required evidence | Documented nonce/TTL or signed request body for pilot ingress; replay of captured request fails or dedupes. |
| Validation method | Replay same HTTP body within and outside TTL; expect single side effect. |
| Blocking severity | **P0** |
| Production blocker? | **Y** |

---

## Duplicate prevention

| Field | Content |
|-------|---------|
| Required evidence | Idempotency store + key lifecycle; cross-tab and double-click tests attached. |
| Validation method | Automated or scripted double-submit + manual two-browser test; duplicate send count = 0. |
| Blocking severity | **P0** |
| Production blocker? | **Y** |

---

## Queue isolation

| Field | Content |
|-------|---------|
| Required evidence | Pilot-class messages exit browser-only processors; worker uses lease / `SKIP LOCKED`; DLQ defined. |
| Validation method | Two workers or simulated concurrency — at most one successful delivery per logical message. |
| Blocking severity | **P0** for finance/customer-visible pilot traffic |
| Production blocker? | **Y** |

---

## Immutable audit

| Field | Content |
|-------|---------|
| Required evidence | Chosen pattern (transactional outbox / trigger / etc.) with failure injection test results. |
| Validation method | Force DB failure after side effect and before audit — system must enter safe explicit state, never “silent success.” |
| Blocking severity | **P1** (pilot) / **P0** if finance-linked |
| Production blocker? | **Y** if legal/finance claims audit as evidence |

---

## Rollback capability

| Field | Content |
|-------|---------|
| Required evidence | Dated rollback drill log with timestamps; kill switch or config revert proven ≤ org SLO. |
| Validation method | Tabletop + live staging drill per `C2C_SAFE_IMPLEMENTATION_SEQUENCE.md` PHASE 7. |
| Blocking severity | **P0** |
| Production blocker? | **Y** |

---

## Observability

| Field | Content |
|-------|---------|
| Required evidence | Dashboards or saved queries for pilot metrics: sends, failures, duplicates, queue depth, DLQ. |
| Validation method | Fault injection generates visible alert within agreed minutes. |
| Blocking severity | **P1** |
| Production blocker? | **Y** |

---

## Correlation IDs

| Field | Content |
|-------|---------|
| Required evidence | End-to-end ID appears in UI log (optional), Edge log, DB row, provider callback (where applicable). |
| Validation method | Trace single action through all stores using one ID. |
| Blocking severity | **P1** |
| Production blocker? | **N** for tiny pilots if waived with **P1** waiver; **Y** for production scale |

---

## Retry semantics

| Field | Content |
|-------|---------|
| Required evidence | Documented max attempts, backoff, jitter, idempotent retry classification (safe vs unsafe). |
| Validation method | Chaos: provider 429/5xx — no unbounded loop; DLQ populated correctly. |
| Blocking severity | **P1** |
| Production blocker? | **Y** for automation; **N** for manual-only pilot if bounded |

---

## Stale UI handling

| Field | Content |
|-------|---------|
| Required evidence | UX rules for unknown outcome (timeout): show pending, offer **single** safe retry with same idempotency key. |
| Validation method | User test script for timeout + refresh + retry. |
| Blocking severity | **P2** |
| Production blocker? | **N** alone |

---

## WebSocket / realtime consistency

| Field | Content |
|-------|---------|
| Required evidence | Documented ordering limits; UI does not allow destructive action on stale version without refresh prompt. |
| Validation method | Rapid concurrent updates — UI prompts or blocks per version rule. |
| Blocking severity | **P2** |
| Production blocker? | **N** if writes blocked until refresh |

---

## Packet locking

| Field | Content |
|-------|---------|
| Required evidence | Lock acquire/release/expire tests; break-glass audited. |
| Validation method | Two operators contend — second blocked or queued with visible reason. |
| Blocking severity | **P1** when concurrent writes on same packet in scope |
| Production blocker? | **Y** if concurrent writes without lock proof |

---

## Authority enforcement

| Field | Content |
|-------|---------|
| Required evidence | Negative RBAC matrix executed in staging for pilot roles. |
| Validation method | Automated tests or scripted checks with screenshots/logs. |
| Blocking severity | **P0** |
| Production blocker? | **Y** |

---

## Finance isolation

| Field | Content |
|-------|---------|
| Required evidence | Pilot cannot touch wallet / payout tables unless explicitly in scope; scoped RLS proof or service account separation. |
| Validation method | Attempt forbidden finance RPC or insert — must fail. |
| Blocking severity | **P0** if pilot is non-finance but shares DB role |
| Production blocker? | **Y** if violated |

---

## Partial failure handling

| Field | Content |
|-------|---------|
| Required evidence | State machine for multi-step flows; compensating transactions or explicit “needs reconciliation” flags. |
| Validation method | Inject failure after step 2 of N — no ambiguous “success” toast; support query resolves state. |
| Blocking severity | **P1** |
| Production blocker? | **Y** for multi-leg money/message flows |

---

## Pilot authorization record (fill in when approving)

| Field | Value |
|-------|--------|
| Scope summary | |
| Approvers | |
| Start / end dates | |
| Rate limits | |
| Waivers (if any) | |

---

## Cross-links

- `C2C_MASTER_GOVERNANCE_INDEX.md`
- `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md`
- `C2C_EXECUTIVE_READINESS_SCORECARD.md`
