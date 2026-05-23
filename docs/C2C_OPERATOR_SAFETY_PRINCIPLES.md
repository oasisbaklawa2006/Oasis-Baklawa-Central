# C2C — Operator safety principles

**Purpose:** Non-negotiable principles for operator-facing authority, messaging, and automation. **Governance doc only.**

Each principle includes: **rationale** · **risk prevented** · **violation consequence** · **staging implication** · **production implication**

---

## 1. Audit first

| Field | Content |
|-------|---------|
| Rationale | If it is not logged durably, it did not happen for disputes and learning. |
| Risk prevented | False confidence, non-repudiation loss |
| Violation consequence | Incident + mandatory re-freeze for pilot class |
| Staging implication | Simulated audit must precede mock “send” |
| Production implication | Transactional or append-only audit before customer-visible effects |

---

## 2. Replay-safe first

| Field | Content |
|-------|---------|
| Rationale | HTTP and human retries are guaranteed in the real world. |
| Risk prevented | Duplicate customer messages, double charges |
| Violation consequence | Pilot halt; root-cause review |
| Staging implication | Replay tests mandatory before GO |
| Production implication | Idempotency store + metrics on duplicate suppression |

---

## 3. Rollback-first

| Field | Content |
|-------|---------|
| Rationale | Ability to stop harm quickly beats perfect forward fixes. |
| Risk prevented | Runaway sends, cascading bad state |
| Violation consequence | Ops escalation; customer comms may be required |
| Staging implication | Kill switch drill in staging before any send stage |
| Production implication | SLO-bound rollback with verified metric drop |

---

## 4. No blind retries

| Field | Content |
|-------|---------|
| Rationale | Retries without classification amplify duplicates and storms. |
| Risk prevented | Retry storms, provider bans |
| Violation consequence | Rate-limit lockout; cost spike |
| Staging implication | Retry only with idempotent classification and caps |
| Production implication | DLQ + human triage for unsafe retries |

---

## 5. No implicit authority

| Field | Content |
|-------|---------|
| Rationale | Side effects must be named, reviewed, and flagged — not accidental. |
| Risk prevented | Silent authority expansion |
| Violation consequence | PR blocked; charter review |
| Staging implication | Allowlisted tables/functions per pilot package |
| Production implication | Static analysis or CI guards for pilot directories |

---

## 6. Least privilege

| Field | Content |
|-------|---------|
| Rationale | Fewer powers means fewer catastrophic mistakes and smaller blast radius. |
| Risk prevented | Cross-tenant exposure, admin abuse |
| Violation consequence | Access review; credential rotation |
| Staging implication | Staging operators are not prod superusers by default |
| Production implication | Scoped roles per action class |

---

## 7. No silent automation

| Field | Content |
|-------|---------|
| Rationale | Automation without visibility becomes “nobody owns it” failures. |
| Risk prevented | Unbounded sends, wrong-segment messaging |
| Violation consequence | Automation disabled until redesigned |
| Staging implication | Every automated step emits visible event to operator dashboard |
| Production implication | paging on anomaly; human approval windows for sensitive classes |

---

## 8. Immutable audit

| Field | Content |
|-------|---------|
| Rationale | Tamper-evident history preserves trust after incidents. |
| Risk prevented | Cover-up, forensic ambiguity |
| Violation consequence | Legal exposure; compliance failure |
| Staging implication | No delete of audit rows; corrections append |
| Production implication | WORM or append-only store policy for high-risk modules |

---

## 9. Deterministic retries

| Field | Content |
|-------|---------|
| Rationale | Same inputs should converge, not diverge, under retry. |
| Risk prevented | Schrödinger sends (maybe sent, maybe not) |
| Violation consequence | Customer confusion; support load |
| Staging implication | Deterministic mock latency and outcomes for tests |
| Production implication | Bounded state machine with explicit terminal states |

---

## 10. Explicit operator visibility

| Field | Content |
|-------|---------|
| Rationale | Operators must see mode (dry-run, shadow, live), scope, and outcome. |
| Risk prevented | Wrong-environment operation |
| Violation consequence | Human error incidents |
| Staging implication | Banners: DRY-RUN, STAGING, NO REAL SEND |
| Production implication | LIVE mode indicators + correlation id copy affordance |

---

## 11. Freeze over unsafe rollout

| Field | Content |
|-------|---------|
| Rationale | A delayed feature is cheaper than a trust incident. |
| Risk prevented | Irreversible reputational harm |
| Violation consequence | Mandatory re-freeze per manifest |
| Staging implication | NO-GO if any checklist P0 fails |
| Production implication | Feature flags default OFF for new authority |

---

## 12. Observability before execution

| Field | Content |
|-------|---------|
| Rationale | If you cannot measure it, you cannot prove safety. |
| Risk prevented | Blind incidents, slow MTTR |
| Violation consequence | Execution blocked until observability spec implemented |
| Staging implication | Dashboards and alerts live before first dry-run |
| Production implication | SLO-driven paging before widening cohort |

---

## 13. Shadow before production

| Field | Content |
|-------|---------|
| Rationale | Validate control plane without customer blast radius. |
| Risk prevented | First-time failures in prod |
| Violation consequence | Rollback under fire |
| Staging implication | Stages 1–3 of authority roadmap before stage 8 |
| Production implication | Shadow metrics compared to live with diff alerts |

---

## 14. Finance isolation

| Field | Content |
|-------|---------|
| Rationale | Messaging mistakes must not become money mistakes. |
| Risk prevented | Wallet corruption, unauthorized release |
| Violation consequence | Finance freeze; executive incident |
| Staging implication | Dry-run and early stages exclude finance tables |
| Production implication | Hard module boundary + code ownership review |

---

## 15. Dispatch isolation

| Field | Content |
|-------|---------|
| Rationale | Dispatch signals physical reality and compliance. |
| Risk prevented | Wrong shipment state, regulatory exposure |
| Violation consequence | Logistics halt; customer impact |
| Staging implication | No dispatch RPCs in messaging pilot package |
| Production implication | Explicit handoff contract between messaging and dispatch modules |

---

## 16. Authority escalation requires evidence

| Field | Content |
|-------|---------|
| Rationale | Power expansion must be provably safe, not politically fast. |
| Risk prevented | Privilege creep, TOOL-5-style risk without charter |
| Violation consequence | Revert permissions; audit review |
| Staging implication | Two-person approval for new staging powers |
| Production implication | Executive + security sign-off per roadmap stage |

---

## Cross-links

- `C2C_EXECUTION_FREEZE_MANIFEST.md`
- `C2C_AUTHORITY_EVOLUTION_ROADMAP.md`
- `C2C_PRE_IMPLEMENTATION_EVIDENCE_REQUIREMENTS.md`
