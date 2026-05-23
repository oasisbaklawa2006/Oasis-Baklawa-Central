# C2C — Execution-independent test strategy

**Purpose:** Define how **future** implementation must be **provably testable before any real execution** (staging or production). **Not authorization** to run tests against live systems without GO checklists.

---

## Deterministic replay testing

| Field | Content |
|-------|---------|
| Required tooling | Hermetic test harness; fixed clock; recorded HTTP envelopes (redacted); in-memory or fixture DB only. |
| Required evidence | Pass/fail matrix showing replay within TTL → `duplicate_suppressed` or identical outcome id. |
| Production blocker if absent | **Yes** — cannot prove safe under HTTP replay. |
| Staging-only requirement | First replay proofs may run in CI only; staging replay uses **synthetic** datasets. |
| Prohibited shortcuts | “Manual replay in prod console”; non-deterministic wall clock without injection. |

---

## Idempotency testing

| Field | Content |
|-------|---------|
| Required tooling | Double-submit automation; two-browser/session simulation; same `Idempotency-Key` header. |
| Required evidence | Metrics or logs: single logical side effect; `duplicate_suppressed` events counted. |
| Production blocker if absent | **Yes**. |
| Staging-only requirement | Staging project or isolated schema with **no** prod keys. |
| Prohibited shortcuts | Client-only UUID without server dedupe store assertion. |

---

## Duplicate-send simulation

| Field | Content |
|-------|---------|
| Required tooling | Load script with bounded concurrency; mock transport counting “logical sends.” |
| Required evidence | Histogram: logical sends = 1 for N concurrent attempts with same key. |
| Production blocker if absent | **Yes** for customer-visible paths. |
| Staging-only requirement | Mock transport mandatory until sandbox allowlist approved. |
| Prohibited shortcuts | “We tried twice manually and it looked fine.” |

---

## Stale-state simulation

| Field | Content |
|-------|---------|
| Required tooling | Version counter or ETag simulation; concurrent tabs in Playwright. |
| Required evidence | Second commit rejected or prompts refresh; no silent overwrite. |
| Production blocker if absent | **Yes** when concurrent operators exist. |
| Staging-only requirement | Synthetic users only. |
| Prohibited shortcuts | UI-only disable without server version check. |

---

## Queue isolation testing

| Field | Content |
|-------|---------|
| Required tooling | Two consumers with lease model; `SKIP LOCKED` tests where applicable. |
| Required evidence | At most one consumer processes a job; DLQ receives poison messages only once. |
| Production blocker if absent | **Yes** for queued sends. |
| Staging-only requirement | Separate queue namespace from prod. |
| Prohibited shortcuts | Two tabs processing `notification_outbox` style tables. |

---

## Rollback testing

| Field | Content |
|-------|---------|
| Required tooling | Kill switch or feature flag; timers; metric dashboards. |
| Required evidence | Timestamped drill log: traffic drops to zero within SLO after disable. |
| Production blocker if absent | **Yes**. |
| Staging-only requirement | First drills in staging; prod drills only with explicit window. |
| Prohibited shortcuts | “We can redeploy if needed” without measured rollback. |

---

## JWT / auth simulation

| Field | Content |
|-------|---------|
| Required tooling | Negative curl / supertest; token forgery attempts; clock skew tests. |
| Required evidence | 401/403 on missing or invalid JWT for write paths; positive path with valid token. |
| Production blocker if absent | **Yes** for write-adjacent Edge. |
| Staging-only requirement | Staging JWT issuer or test keys only. |
| Prohibited shortcuts | Disabling auth “temporarily” in staging that could leak to prod config. |

---

## Operator conflict simulation

| Field | Content |
|-------|---------|
| Required tooling | Two actors same packet; lock acquire/release tests. |
| Required evidence | Second actor blocked or queued; audit shows contention outcome. |
| Production blocker if absent | **Yes** when execute authority enabled. |
| Staging-only requirement | Synthetic operator identities. |
| Prohibited shortcuts | Last-write-wins without visibility. |

---

## Observability validation

| Field | Content |
|-------|---------|
| Required tooling | Log/metric sink in test; alert simulation (PagerDuty dry-run or webhook catcher). |
| Required evidence | Alert fires on injected duplicate-send metric threshold. |
| Production blocker if absent | **Yes** for any pilot with customer visibility. |
| Staging-only requirement | Staging dashboards first. |
| Prohibited shortcuts | “We’ll grep logs if needed.” |

---

## Audit reconciliation validation

| Field | Content |
|-------|---------|
| Required tooling | Script comparing audit stream to domain state; failure injection after mutation before audit. |
| Required evidence | Zero divergence in happy path; explicit `audit_blocked` terminal state on failure injection. |
| Production blocker if absent | **Yes** for finance or regulated comms. |
| Staging-only requirement | Shadow audit tables acceptable. |
| Prohibited shortcuts | Best-effort audit insert in client only. |

---

## Dry-run verification

| Field | Content |
|-------|---------|
| Required tooling | Mock provider; egress denylist assertion in CI. |
| Required evidence | Network capture or mock call count = 0 to real provider hosts. |
| Production blocker if absent | **Yes** before first real send. |
| Staging-only requirement | Mandatory dry-run phase per `C2C_FIRST_STAGING_DRYRUN_PILOT.md`. |
| Prohibited shortcuts | “Dry-run” that still hits prod API URL. |

---

## Shadow-mode validation

| Field | Content |
|-------|---------|
| Required tooling | Diff job comparing shadow vs primary read models. |
| Required evidence | Bounded diff rate; no PII leakage labels on shadow exports. |
| Production blocker if absent | **Yes** before promoting shadow logic to live writes. |
| Staging-only requirement | Shadow tables in staging project only. |
| Prohibited shortcuts | Shadow writes to prod replica without legal review. |

---

## Cross-links

- `C2C_EVIDENCE_ARTIFACT_STANDARD.md`  
- `C2C_STAGING_DATA_ISOLATION_RULES.md`  
- `C2C_PRE_IMPLEMENTATION_EVIDENCE_REQUIREMENTS.md`  
- `src/types/c2cMockStateFixtures.ts`
