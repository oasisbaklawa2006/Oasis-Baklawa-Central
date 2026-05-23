# C2C — What is not implemented (explicit audit)

**This repository is governance-prepared, not execution-complete.**

The following sections list what **does not exist** in runnable form for the C2C / dry-run / authority program, even where docs or types exist.

---

## What exists only in docs

- Execution flag **runtime** wiring, kill-switch services, and environment fingerprint checks.  
- Staging **isolation enforcement** (automated scans for prod keys in staging).  
- Full **evidence bundle** storage and signing infrastructure.  
- **Automated** replay and duplicate-send test pipelines in CI for C2C paths (beyond general app tests).

---

## What exists only as types

- `src/types/c2cAuthority.ts` — vocabulary only; **no** enforcement.  
- `src/types/c2cDryRunContracts.ts` — shapes only; **no** API.  
- `src/types/c2cMockStateFixtures.ts` — fixtures for future tests/docs; **not** consumed by app.

---

## What exists only as placeholders

- `src/config/c2cExecutionFlags.ts` — all `false`; **not** read by runtime paths in this repo state.  
- `src/config/c2cGovernanceConstants.ts` — labels and numeric targets; **not** used by monitoring.

---

## What does NOT exist in runtime (application)

- A unified **command bus** for C2C sends with idempotency + audit in one transaction.  
- **Server-enforced** packet locks for operator execute paths in new pilot code.  
- **Browser UI** integration showing DRY-RUN / STAGING banners tied to real env detection (for pilot).  
- **Automatic** rejection of requests missing idempotency keys on new pilot routes.

---

## What does NOT exist in Edge (for this program)

- New Edge functions or edits implementing dry-run pipeline, mock adapter, or flag checks **for C2C pilot**.  
- JWT hardening changes driven solely by this scaffold track (forbidden without separate authorized PR).

---

## What does NOT exist in queues

- Dedicated **staging** worker with lease semantics for C2C dry-run jobs.  
- DLQ and replay-safe consumer for pilot-class messages.

---

## What does NOT exist in retries

- Capped exponential backoff worker with **idempotent** retry classification for C2C pilot sends.  
- Global **retry-disable** enforcement beyond static constant (no runtime enforcement).

---

## What does NOT exist in JWT validation (C2C pilot scope)

- Per-function **production-proven** JWT or HMAC posture for new pilot entrypoints.  
- Automated tests proving **reject** on spoofed `operator_id` body for pilot routes.

---

## What does NOT exist in observability (C2C pilot scope)

- Live dashboards and alerts named in `C2C_DRYRUN_OBSERVABILITY_SPEC.md` wired to pilot metrics.  
- Correlation ID middleware in client and Edge for pilot paths.

---

## What does NOT exist in rollback execution

- One-click or sub-minute **verified** kill switch tied to pilot send path in staging/prod.  
- Automated rollback **rehearsal** schedule for C2C flags.

---

## Closing line

**Governance docs and types are not a substitute for built, tested, and observed runtime controls.**

---

## Cross-links

- `C2C_NOT_READY_FOR_PRODUCTION_SUMMARY.md`  
- `C2C_PROGRAM_STATUS_AFTER_FREEZE_PHASE.md`  
- `C2C_IMPLEMENTATION_ENTRY_CRITERIA.md`
