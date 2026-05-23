# C2C — Not ready for production (summary)

**This document is intentionally blunt.** It exists to prevent optimistic misreadings of governance maturity.

---

## The system is

| Statement | Meaning |
|-------------|---------|
| **Read-only safe** | Current operator read paths and suggest-only flows are acceptable **under existing RLS and training**, for their **current** scope. |
| **Governance mature** | Documentation, freezes, roadmaps, checklists, and approval models now describe **what “safe” means.** |
| **Architecture-reviewed** | Audits and inventories characterize **real** surfaces (Edge, client writes, queues). |
| **NOT production-write ready** | **C2C-class production write expansion** (new authority, new sends, new automation) is **not** cleared — evidence and implementation for gates are still outstanding. |

---

## Exact missing capabilities (for C2C production-write bar)

1. **Verified ingress** on all write-adjacent Edge routes in scope (JWT or equivalent per function).
2. **Server-side idempotency store** with TTL and dedupe semantics proven under concurrency.
3. **Correlation IDs** end-to-end on pilot paths (not only design text).
4. **Server-side queue worker** with lease semantics for anything customer-visible.
5. **Packet locks / versioning** for concurrent operator execution (when writes exist).
6. **Production observability** with SLO alerts for duplicate send and auth anomalies.
7. **Finance and dispatch hard isolation** proofs for any expanded messaging scope.

---

## Exact unresolved risks

- **Replay and spoofing** against `verify_jwt = false` surfaces until each is compensated or closed.
- **Duplicate sends** from human retry + multi-tab + missing idempotency keys.
- **Audit divergence** if audit writes are not transactional with mutations.
- **Credential bleed** between staging and production during pilot work.
- **Privilege creep** via “small” PRs that add hidden side effects.

---

## Exact remaining blockers

- **Staging execution freeze** — no GO checklist completion with attached evidence.
- **Production freeze** — no executive + security + (where needed) finance sign-off for production pilot.
- **Implementation gap** — designs exist; **instrumented staging dry-run** not yet executed as of doc-only phase.

---

## Exact reasons production writes remain frozen

1. **Evidence before implementation** rule is not yet satisfied for production-class paths.
2. **Scorecard** (or successor) still shows **RED** for ingress, replay, idempotency, and Edge trust for C2C goals.
3. **Risk register** retains production blockers without waivers.
4. **No** sustained staging soak with duplicate-send metric at zero for scoped sends.

---

## Exact prerequisites before any production pilot

- Stage **7–8** of `C2C_AUTHORITY_EVOLUTION_ROADMAP.md` satisfied with artifacts.
- `C2C_PRE_IMPLEMENTATION_EVIDENCE_REQUIREMENTS.md` satisfied **in full** for scope.
- `C2C_GOVERNANCE_APPROVAL_MODEL.md` production pilot signatures collected.
- Game-day passed; rollback drill passed **after** last material change.

---

## What would be reckless right now

- Turning on **real** customer sends “to validate UX” without sandbox allowlist and idempotency.
- Sharing **production service role** keys with staging workers to “speed up debugging.”
- Merging **silent** helper that adds `invoke` or DB write without manifest update.
- Declaring “we’re done” because **docs merged** — docs do not rotate keys or prove metrics.

---

## What is safe right now

- **Reading** code and logs; **writing** governance docs; **operating** the product as already approved by the business outside this C2C expansion track.
- **Dry-run design** review meetings that do not touch environments.

---

## What is next safest

1. Obtain **written GO** and satisfy `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`.
2. Execute **Stage 1** dry-run in **isolated staging** with mock provider only.
3. Collect **evidence bundle** and only then discuss Stage 2–3.

---

## What must never be skipped

- **Isolation** verification before any execution.
- **Kill switch** drill before any send stage.
- **Replay** tests before calling any provider (even sandbox).
- **Two-person** rule for production pilot and finance-bound stages.

---

## Cross-links

- `C2C_EXECUTION_FREEZE_MANIFEST.md`
- `C2C_REAL_WRITE_BLOCKERS_AFTER_DRYRUN.md`
- `C2C_EXECUTIVE_READINESS_SCORECARD.md`
- `C2C_ARCHITECTURAL_RISK_REGISTER.md`
