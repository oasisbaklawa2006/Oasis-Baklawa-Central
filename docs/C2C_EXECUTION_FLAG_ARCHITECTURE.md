# C2C — Execution flag architecture (design only)

**Status:** This document defines a **future** flag model for staging-safe and production-safe execution.  

**No flag in this document is implemented or active** in application runtime beyond the separate **hard-disabled constant object** in `src/config/c2cExecutionFlags.ts` (all `false`, not read by the app in this sprint).

---

## Principles

| Principle | Meaning |
|-----------|---------|
| **Default OFF** | Every execution path starts disabled until evidence + GO checklist + approvals exist. |
| **Environment isolation** | Staging flags never read production secrets; production build must not enable staging-only flags. |
| **Staging-only gating** | First real execution happens only in isolated staging with mock transport and egress controls (future). |
| **Immutable production freeze defaults** | Production defaults remain **deny** for C2C expansion until executive thaw — not toggled by a single engineer. |
| **Kill switches** | Global **master deny** overrides any sub-flag (future wiring). |

---

## Flag catalog (design)

Legend: **Default** = value at repo rest · **Enabler** = role allowed to turn ON · **Evidence** = minimum proof · **Rollback** = how to disable · **Prod** = production restriction

| Flag key (future) | Intended purpose | Default | Who may enable | Evidence required | Rollback behavior | Production restrictions |
|-------------------|------------------|---------|----------------|---------------------|-------------------|-------------------------|
| `ENABLE_REAL_SENDS` | Any customer-visible provider send | OFF | Exec + Security + written thaw | Idempotency + JWT + audit + soak | Instant OFF; drain queue | **Forbidden default ON**; requires signed thaw |
| `ENABLE_STAGING_SENDS` | Sandbox / allowlisted sends only | OFF | Ops + Security | Isolation charter + GO checklist | Instant OFF | Must never point at prod keys |
| `ENABLE_QUEUE_PROCESSING` | Worker consumes queue jobs | OFF | Ops + Tech lead | Lease semantics + DLQ design | Stop worker; mark jobs paused | Not until staging proof |
| `ENABLE_QUEUE_SHADOW` | Shadow queue metrics without side effects | OFF | Tech lead | Shadow pipeline design | OFF | Staging only |
| `ENABLE_RETRIES` | Automated retry of failed operations | OFF | Security + Tech lead | Retry classification + caps | OFF | Never without idempotency |
| `ENABLE_RETRY_MASTER` (conceptual) | Same as retries — prefer single master | OFF | Same | Same | OFF | Same |
| `ENABLE_DISPATCH_WRITES` | Dispatch / logistics state changes | OFF | Exec sponsor + Ops | Locks + finance isolation | OFF | **Blocked** in C2C early stages |
| `ENABLE_FINANCE_WRITES` | Wallet / payment mutations | OFF | Finance + Exec | SoD + audit + locks | OFF | **Blocked** in C2C early stages |
| `ENABLE_TOOL5_WRITES` | TOOL 5 authority | OFF | Separate charter only | N/A | OFF | **Always OFF** until charter |
| `ENABLE_DRY_RUN_EXECUTION` | Runs mock dry-run pipeline in staging | OFF | Approvers per approval model | Pre-pilot GO + isolation | OFF | Staging only |
| `ENABLE_SHADOW_WRITES` | Writes to shadow tables only | OFF | Security + Tech lead | Shadow schema isolation | Truncate shadow / OFF | Staging only |
| `ENABLE_REPLAY_SIMULATION` | Simulated replay harness | OFF | Security | Replay test binder | OFF | Staging only |
| `ENABLE_MOCK_TRANSPORT` | Provider adapter uses mock I/O | OFF | Tech lead (staging) | Egress proof | OFF | Should be ON before any real send in staging |
| `ENABLE_AUDIT_MIRROR_RUNTIME` | Duplicate audit stream to mirror sink | OFF | Security | Privacy review | OFF | Optional; never default prod |
| `KILL_SWITCH_ALL_C2C_EXECUTION` | Hard stop all C2C-class execution | ON (future meaning “armed to deny”) | Ops / Security / Exec | Incident | Immediate deny-all | Must exist in prod as **deny** default for pilot class |

*Note: kill switch polarity may be implemented as “armed” vs “tripped” in code later; architecture requires a **single obvious** global deny.*

---

## Dry-run mode

- **Purpose:** Exercise correlation, idempotency, audit ordering, and rollback **without** provider I/O.  
- **Default:** OFF.  
- **Enablement:** Only after `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md` PASS.  
- **Production:** Dry-run **never** enables real sends.

## Shadow-write mode

- **Purpose:** Persist to **staging-only** shadow tables for diffing.  
- **Default:** OFF.  
- **Production:** **Disallowed** until separate production shadow charter.

## Replay mode

- **Purpose:** Deterministic replay of captured events in isolated harness.  
- **Default:** OFF.  
- **Production:** **Disallowed** as “live replay”; only offline tooling.

## Queue-disable master switch

- **Purpose:** Prevent any dequeue / lease acquisition globally.  
- **Default:** deny processing (aligned with `ENABLE_QUEUE_PROCESSING: false`).  
- **Rollback:** Flip to deny; verify depth stops decreasing.

## Retry-disable master switch

- **Purpose:** Prevent retry workers from scheduling.  
- **Default:** deny (aligned with `ENABLE_RETRIES: false`).

---

## Explicit non-implementation statement

**No flag in this document is implemented or active** as a runtime feature flag system in the application beyond the **documentation** and the **static constant object** `C2C_EXECUTION_FLAGS`, which is **not imported** by app entrypoints in this change and consists solely of literal `false` values.

---

## Cross-links

- `src/config/c2cExecutionFlags.ts`  
- `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md`  
- `C2C_EXECUTION_FREEZE_MANIFEST.md`  
- `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`
