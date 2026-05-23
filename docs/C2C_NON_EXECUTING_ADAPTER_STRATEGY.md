# C2C — Non-executing adapter strategy

**Status:** Architecture **placeholder** only. **Not implemented.** **No runtime execution.** **No sends** are possible from this document or from the scaffold files added alongside it (flags are hard-disabled and unwired).

---

## Future architecture (conceptual)

| Layer | Responsibility |
|-------|----------------|
| **Adapter layer** | Single boundary translating domain “send intent” into transport-specific I/O (mock, sandbox, production). |
| **Execution boundary** | Code that checks execution flags, JWT, idempotency, and environment fingerprint **before** any I/O. |
| **Mock transport** | Returns deterministic IDs and latency; **no** network egress to real providers when mock is active. |
| **Disabled senders** | Production and staging “real send” paths compile to **no-op** or **throw** until flags thaw with evidence. |
| **Replay simulator** | Offline or staging-only harness reapplies captured envelopes to verify idempotency. |
| **Queue shadow processor** | Metrics-only consumer of shadow topic or table — **no** dequeue side effects. |
| **Audit mirror** | Optional secondary append stream for forensics — privacy gated. |
| **Staging-only routing** | Build-time or deploy-time config ensures staging bundles cannot resolve production URLs. |

---

## Execution flow (future, not active)

1. Operator intent → **validation** (JWT, actor, idempotency key).  
2. **Execution boundary** reads frozen flags → **deny** while defaults hold.  
3. If ever enabled in staging dry-run: **mock transport** only.  
4. Observability emits events **without** provider call.  
5. Audit append precedes any simulated “sent” state.

---

## Explicit non-guarantees (today)

- **Not implemented:** no adapter interface files are required in this sprint beyond types/flags/docs.  
- **No runtime execution:** app does not import `c2cExecutionFlags` for branching yet (must stay so until GO).  
- **No sends possible from current repo state** introduced by this sprint: flags are false, unwired, and types carry no behavior.

---

## Cross-links

- `docs/C2C_EXECUTION_FLAG_ARCHITECTURE.md`  
- `src/types/c2cDryRunContracts.ts`  
- `src/config/c2cExecutionFlags.ts`  
- `C2C_FIRST_STAGING_DRYRUN_PILOT.md`
