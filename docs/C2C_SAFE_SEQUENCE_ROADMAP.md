# C2C — Safe sequence roadmap

This roadmap sequences **governance, architecture, and pilots** before production mutation or automation. It does not commit calendar dates.

---

## PHASE 0 — Current read-only platform (NOW)

| Item | Detail |
|------|--------|
| **Goals** | Stable inbox UX; observability strip; local features; threat-informed documentation. |
| **Blockers** | None for read-only doc/UI work. |
| **Required approvals** | Standard engineering merge review. |
| **Rollback expectations** | Revert client bundle; no DB rollback required for client-only features. |
| **Stop conditions** | Recurring PostgREST 400/406 on reads; security finding on existing invokes — pause write-path discussion until triaged. |

---

## PHASE 1 — Authority review

| Item | Detail |
|------|--------|
| **Goals** | Sign off on blueprint, threat model, gating matrix; verify JWT + RLS reality vs assumptions; assign owners for audit design. |
| **Blockers** | Missing access to Supabase dashboard / Edge source for reviewers. |
| **Required approvals** | Security + backend leads; optional legal for messaging retention. |
| **Rollback expectations** | N/A (review only); outcomes recorded as ADRs or checklist updates. |
| **Stop conditions** | Unresolved **Critical** findings on JWT or IDOR — freeze Phase 2 planning until mitigations designed. |

---

## PHASE 2 — Staging write pilot

| Item | Detail |
|------|--------|
| **Goals** | Exercise reply/classify/route (and any new endpoints) under staging RLS with real-shaped traffic; measure conflicts and duplicates. |
| **Blockers** | Staging project parity; test accounts; feature flags; idempotency design. |
| **Required approvals** | Ops + eng manager for staging traffic; cost approval for LLM if used. |
| **Rollback expectations** | Disable flags; drain queues; revert Edge deploy. |
| **Stop conditions** | Any duplicate customer send; unexplained cross-tenant read — halt pilot. |

---

## PHASE 3 — Immutable audit activation

| Item | Detail |
|------|--------|
| **Goals** | Append-only audit online for all write paths in staging; correlation ids; actor binding. |
| **Blockers** | Migrations **only** when explicitly approved (outside current doc-only freeze). |
| **Required approvals** | DBA + security + compliance on retention and PII in audit payloads. |
| **Rollback expectations** | Stop writes that depend on audit if sink fails; never delete audit for rollback — forward compensating entries only. |
| **Stop conditions** | Audit loss or tamper test success in staging — block prod. |

---

## PHASE 4 — Controlled TOOL 5 pilot

| Item | Detail |
|------|--------|
| **Goals** | Introduce **one** governed capability at a time (e.g. acknowledgement or reassignment) behind flags with full audit. |
| **Blockers** | Phase 3 complete; role matrix enforced in Edge and UI. |
| **Required approvals** | Product + ops + security per capability. |
| **Rollback expectations** | Per-feature flag off; DB may require forward fix migrations. |
| **Stop conditions** | Escalation abuse metrics; audit gaps; operator workflow regression beyond SLO. |

---

## PHASE 5 — Queue authority model

| Item | Detail |
|------|--------|
| **Goals** | Design and ship queue with idempotency, dedupe, replay safety, and human override precedence. |
| **Blockers** | Phase 4 lessons; infrastructure for queue (provider choice) approved. |
| **Required approvals** | SRE for queue ops; security for replay; finance if billing events. |
| **Rollback expectations** | Drain queues; disable producers; preserve audit of attempted actions. |
| **Stop conditions** | Replay-induced duplicate external side effect — halt automation globally if needed. |

---

## PHASE 6 — Production automation

| Item | Detail |
|------|--------|
| **Goals** | Gradual automation with SLAs, monitoring, and break-glass documented. |
| **Blockers** | Phases 1–5 evidence; production audit sink healthy; on-call runbooks. |
| **Required approvals** | Executive risk acceptance for residual risk. |
| **Rollback expectations** | Feature flags + kill switch; comms template for customer impact. |
| **Stop conditions** | Regulatory inquiry driver; material incident — return to Phase 1 or 2 posture per postmortem. |

---

## Cross-phase invariants

- **No production write expansion** without a row in `docs/C2C_IMPLEMENTATION_GATING_MATRIX.md` marked ready with evidence links.
- **No silent automation** — human acknowledgement or policy-defined exception only.
- **Client never authoritative** for identity, role, or immutable business facts.
