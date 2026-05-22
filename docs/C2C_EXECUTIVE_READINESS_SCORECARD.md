# C2C — Executive readiness scorecard

**Purpose:** One-page posture for **staging pilot** vs **production write** readiness. **Docs only** — statuses reflect governance review, not automated tests.

---

## RAG definitions

| Signal | Meaning |
|--------|---------|
| **RED** | No acceptable mitigation in place for pilot-class scope; fundamental redesign or freeze required before writes. |
| **AMBER** | Partial mitigation or strong reliance on process/RLS/ops discipline; may allow **narrow** staging experiment only with explicit waivers and extra monitoring. |
| **GREEN** | Control design **and** evidence appropriate for the target environment (staging or production) for the **declared scope** — requires named validation artifacts. |

*GREEN in this scorecard does not certify legal compliance; it means “meets program-defined technical bar when evidence is attached.”*

---

## Scorecard

| Area | Status | Risk | Ready for staging? | Ready for production? | Blocking gaps |
|------|--------|------|--------------------|-----------------------|----------------|
| JWT validation | **RED** | Critical | No | No | Many write-adjacent Edge entries use `verify_jwt = false` in repo config; handlers often rely on service role without binding verified user identity at ingress. |
| Replay protection | **RED** | Critical | No | No | No systematic nonces / signed request TTLs / idempotency store for operator sends. |
| Auditability | **AMBER** | High | Partial | No | Client and Edge inserts vary by path; asymmetric audit on some success vs failure paths; `operator_id` in JSON ≠ cryptographically verified actor at Edge gate. |
| Queue safety | **AMBER** | High | Partial | No | Browser-driven outbox processing; no demonstrated row lease / single-consumer semantics for pilot-class notifications. |
| Retry safety | **AMBER** | Medium | Partial | No | Provider fallback exists for WA; no capped exponential worker with dedupe for operator path; user retry ambiguity. |
| Idempotency | **RED** | Critical | No | No | No standard `Idempotency-Key` on `invoke` for sends; duplicate outbound rows possible cross-tab / retry. |
| Packet ownership | **AMBER** | High | Partial | No | Server-side packet↔contact↔phone coherence and version locks not established as program-wide guarantees. |
| Operator authority | **AMBER** | High | Partial | No | Suggest flows OK; execute paths need locks + verified actor + audit parity before widening. |
| Finance authority | **AMBER** | Critical | Partial | No | Strong business reliance on existing flows; C2C pilot must **isolate** finance side effects until locks + idempotency proven. |
| Rollback capability | **AMBER** | High | Partial | No | Process-level rollback assumed; kill switches and reversible deploy path need **evidence** per environment. |
| Observability | **AMBER** | Medium | Partial | No | Logs and some tables exist; unified correlation IDs and dashboards for duplicate-send / replay not program-complete. |
| Realtime consistency | **AMBER** | Medium | Yes (reads) | Partial | Debounced reload model acceptable for reads; not a substitute for authoritative ordering on writes. |
| Optimistic UI safety | **GREEN** | Low | Yes | Yes (reads) | Inbox reply path largely “confirm then refresh”; residual human double-submit risk until idempotency lands. |
| Staging isolation | **AMBER** | High | Unknown | No | Depends on env config not represented in repo; must prove data + key isolation before pilot. |
| Migration governance | **GREEN** | N/A (freeze) | N/A | N/A | Program forbids migration churn in doc-only phases; when thawing, migrations become RED until reviewed. |
| Edge trust model | **RED** | Critical | No | No | Service-role-heavy model + broad JWT-off surface = highest systemic risk class for C2C goals. |
| TOOL 5 readiness | **RED** | N/A | No | No | Explicitly not implemented; must remain non-authoritative until separate charter. |

---

## Overall readiness conclusion

- **Staging write pilot:** **Not ready** — multiple **RED** rows (JWT validation, replay protection, idempotency, Edge trust model) must move at least to **AMBER with waivers** or **GREEN** with evidence for a **narrow** declared scope.
- **Production write expansion (C2C-hardened):** **Not ready** — finance authority, rollback, and observability must be **GREEN** with artifacts, not intent-only.

---

## Largest blockers

1. **Ingress trust model** for Edge functions that perform or trigger writes (`verify_jwt` posture + compensating controls).
2. **Idempotency + dedupe** for customer-visible WhatsApp and finance-adjacent notifications.
3. **Queue isolation** — move pilot-critical sends off opportunistic browser processing.

---

## Unsafe shortcuts (explicitly discouraged)

- “We will monitor manually” without automated duplicate-send detection.
- Turning on writes in staging **without** correlation IDs because “it’s just staging.”
- Relying on **URL secrecy** of Edge functions as the primary control.
- Expanding `service_role` usage to “speed up” features without narrowing policies.
- Skipping rollback drill because staging “looks fine” in happy-path testing.

---

## Minimum viable safe pilot (target shape — not authorization)

When (and only when) gates are met, the smallest defensible pilot tends to be:

- **Single** operator cohort, **single** region, **low** rate cap.
- **One** send path behind **verified JWT or HMAC** ingress.
- **Mandatory** idempotency key end-to-end.
- **Dedicated** worker or transactional outbox — not multi-tab admin UI processor.
- **48h** minimum shadow mode with duplicate-send metric = **zero** above noise floor.

This does **not** replace formal sign-off — see `C2C_STAGING_PILOT_ACCEPTANCE_CRITERIA.md`.

---

## Cross-links

- `C2C_MASTER_GOVERNANCE_INDEX.md`
- `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md`
- `C2C_ARCHITECTURAL_RISK_REGISTER.md`
