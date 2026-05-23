# C2C — Real write blockers after dry-run (explicit)

**Purpose:** State clearly that a **successful staging dry-run pilot does not authorize** production writes, real customer sends, finance, dispatch, automation at scale, or TOOL 5. This document is the **blocker map** after dry-run success.

---

## Frozen / blocked even after successful dry-run

| Area | Still blocked? | Why |
|------|----------------|-----|
| **Production writes** (C2C pilot class) | **Yes** | Dry-run proves instrumentation, not production safety under load/attack |
| **TOOL 5** | **Yes** | Explicit program exclusion until separate charter |
| **Finance authority** | **Yes** | No wallet / payout / payment state changes in v1 pilot design |
| **Queue automation** (unsupervised) | **Yes** | Workers need separate soak and SoD review |
| **Bulk actions** (customer-visible) | **Yes** | Amplifies blast radius and idempotency stress |
| **Dispatch triggers** | **Yes** | Physical logistics and compliance coupling |
| **Real staging sends** (actual provider) | **Yes** for v1 | Next gate requires new acceptance slice — not implied by dry-run |

---

## Exact remaining blockers (typical)

1. **Production ingress hardening** — `verify_jwt` / compensating controls proven on **prod** Edge routes, not only staging mock path.
2. **Production idempotency store** — separate namespace, backups, and DR plan.
3. **Production observability** — SLO dashboards + paging, not staging-only tiles.
4. **Legal / privacy** — consent and data retention for real message content logging.
5. **Finance SoD** — approvals for any path that can touch money-adjacent tables.
6. **Load + abuse testing** — rate limits and WAF rules in production configuration.
7. **Migration governance** — any schema change under formal review and rollback-tested.
8. **Customer comms runbook** — templates for send failures and duplicates.

---

## Exact future requirements (before real staging sends)

| # | Requirement |
|---|-------------|
| F1 | New acceptance criteria doc slice: **“Staging real-send (sandbox provider)”** with explicit phone allowlist |
| F2 | Sandbox provider credentials + billing separation |
| F3 | DLQ + human reconciliation for failed sandbox sends |
| F4 | Cross-review of RLS for any table touched by send logging |
| F5 | Sign-off from security + ops + product |

---

## Exact production go-live prerequisites (high level)

All **future staging real-send** requirements, plus:

| # | Prerequisite |
|---|--------------|
| P1 | Sustained staging soak with **non-zero** traffic shape similar to prod peaks (scaled down) |
| P2 | `C2C_EXECUTIVE_READINESS_SCORECARD.md` (or successor) — no RED for in-scope production rows |
| P3 | `C2C_ARCHITECTURAL_RISK_REGISTER.md` — no open production blockers without executive waiver |
| P4 | Game-day: duplicate send, finance race (if scope ever touches finance), JWT bypass attempt |
| P5 | Named go/no-go memo with rollback drill reference within last N days (N defined by org) |

---

## One-line policy

> **Dry-run success proves we can measure a fake send safely — not that we may perform a real one.**

---

## Cross-links

- `C2C_FIRST_STAGING_DRYRUN_PILOT.md`
- `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md`
- `C2C_STAGING_PILOT_ACCEPTANCE_CRITERIA.md`
- `C2C_SAFE_IMPLEMENTATION_SEQUENCE.md`
