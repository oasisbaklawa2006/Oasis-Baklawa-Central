# C2C — Staging pilot dependency graph

**Purpose:** Ordered **authority and safety** chain before limited staging writes. Documentation only.

---

## Ordered dependency chain

```text
authority review
  → contract reconciliation
    → JWT validation hardening (gateway + in-function)
      → audit guarantees (immutable append-only)
        → replay protection (idempotency keys / dedupe)
          → queue idempotency (if/when queues exist)
            → lock semantics (optimistic version / claims)
              → staging-only shadow writes
                → dry-run validation
                  → rollback validation
                    → observability validation
                      → pilot approval (sign-off)
                        → limited staging write pilot
```

Each arrow is a **hard dependency**: skipping an upstream node invalidates downstream safety claims.

---

## Blockers

| Blocker | Impact |
|---------|--------|
| No signed authority review | Cannot interpret “approved pilot” |
| Contract drift (UI vs Edge) | Tests and monitoring measure wrong thing |
| `verify_jwt` unresolved | Cannot attribute actions to humans |
| Audit not append-only | Forensics and rollback decisions unsafe |
| No idempotency | Duplicate sends / double routing |
| Queues without dedupe | Replay storms |

---

## Unsafe shortcuts (must never be skipped)

| Shortcut | Why fatal |
|----------|-----------|
| “We’ll add audit later” | Incidents without evidence |
| “JWT is enough without RLS review” | IDOR persists with user JWT |
| “Shadow mode optional” | Automation diverges from real path |
| “Skip rollback drill in staging” | Production panic without muscle memory |
| “Trust client operator_id” | Spoofing and repudiation |

---

## What must never be skipped

1. **Rollback-first principle** — every pilot capability has a **flag-off** and **non-destructive** audit story.  
2. **Human attribution** — no anonymous automation principal for customer-visible sends.  
3. **Replay protection** before scaling traffic.  
4. **Observability validation** before expanding operator cohort.

---

## Rollback-first principle

Design writes so that **disabling ingress** (Edge flag / deploy pin) stops new harm **without** requiring database restores. **Audit is never deleted** during rollback (see `docs/C2C_ROLLBACK_AND_RECOVERY_STRATEGY.md`).

---

## Why UI completion ≠ authority safety

The read-only inbox can be **feature-complete** (filters, virtual list, local tools) while Edge still has **`verify_jwt=false`** and service-role handlers. **UX polish does not reduce** IDOR, duplicate-send, or audit gaps — those are **orthogonal** workstreams gated by this graph.

---

## Alignment with other docs

| Document | Role |
|----------|------|
| `docs/C2C_LIVE_AUTHORITY_SURFACE_AUDIT.md` | Inputs to authority review |
| `docs/C2C_EDGE_CONTRACT_RECONCILIATION.md` | Contract reconciliation node |
| `docs/C2C_STAGING_WRITE_PILOT_MASTER_PLAN.md` | Pilot scope + stop conditions |
| `docs/C2C_WRITE_OBSERVABILITY_REQUIREMENTS.md` | Observability validation node |
| `docs/C2C_PRE_IMPLEMENTATION_AUTHORITY_CHECKLIST.md` | Executable checklist |
