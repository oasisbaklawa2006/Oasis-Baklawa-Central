# C2C — Production write freeze charter

**Purpose:** Define **why** the production write freeze exists, **what** it constrains, and **how** it thaws or re-freezes. This is a **governance** document — not a substitute for legal review.

---

## 1. Why freeze exists

- **C2C technical debt classes** (Edge ingress trust, idempotency, queue semantics) can cause **irreversible customer harm** (duplicate messages, wrong-party content) and **financial harm** (double release, inconsistent audit) faster than rollback can repair reputation.
- The program requires **evidence-based** progression: documentation, acceptance criteria, drills, and metrics — not velocity alone.

---

## 2. What is frozen

| Category | Frozen meaning |
|----------|----------------|
| **C2C production write expansion** | No new customer-visible send paths, automation, or authority features in production **under this program** until thaw conditions met. |
| **Schema migrations** | None for C2C pilot objectives while charter in doc-only / governance consolidation phase (global program rule). |
| **Edge logic edits** | None for C2C objectives during doc-only phase. |
| **New `invoke` sites** | None during doc-only phase. |
| **Staging pilot** | **Unauthorized** until `C2C_STAGING_PILOT_ACCEPTANCE_CRITERIA.md` satisfied for declared scope. |

*Existing historical production behaviors outside pilot scope continue under **separate** org risk acceptance — this charter does not retroactively halt all business operations.*

---

## 3. What is allowed

- **Read-only** code paths, bugfixes that **provably** do not expand writes, observability **read** queries.
- **Documentation** updates: audits, scorecards, runbooks, acceptance criteria, risk register.
- **Operational** responses (support, manual DB remediation) **outside** this repo’s change policy — governed by company incident process, not this file.

---

## 4. What is docs-only

- Anything labeled **governance / readiness / consolidation** in `docs/C2C_*.md` produced under the program’s doc-only global rules.
- Tabletops, scorecards, indices — **no runtime effect**.

---

## 5. What is read-only safe

- Operator inbox **read** surfaces, suggestions that **do not** persist automated decisions, analytics on existing data, exports of already-authorized data.

---

## 6. What requires staging only

- First application of: new idempotency keys, JWT posture changes affecting clients, queue workers, packet locks, shadow send modes, correlation plumbing end-to-end.

---

## 7. What requires authority review

- Any change that **binds** an action to an **actor** (human vs system) or crosses **tenant** boundaries.
- Any new **override** or **break-glass** capability (including future TOOL 5).

---

## 8. What requires audit guarantees

- Finance-adjacent actions, customer-visible messaging, packet ownership changes, role elevation, bulk actions affecting many rows.

---

## 9. What requires replay guarantees

- All externally reachable HTTP handlers that can cause **side effects** (Edge functions, webhooks), and any **retrying** worker.

---

## 10. What requires rollback guarantees

- Any pilot or production change that touches send paths, wallets, order status transitions used for dispatch/finance, or auth ingress.

---

## 11. What explicitly must not happen yet

- Declaring “pilot started” without acceptance criteria sign-off.
- Shipping idempotency **only** on the client.
- Using **production** customer identifiers in staging shadow sends without legal/privacy clearance.
- Expanding **TOOL 5** authority without a separate signed charter.
- **Silent** widening of pilot scope (tables, roles, rate limits) without document update.

---

## 12. Conditions for thawing freeze (production-oriented)

All must be true for **C2C-class production write expansion**:

1. `C2C_EXECUTIVE_READINESS_SCORECARD.md` — no **RED** in rows marked production-blocking for in-scope features.
2. `C2C_STAGING_PILOT_ACCEPTANCE_CRITERIA.md` — all relevant gates **PASS** in staging with attached evidence.
3. `C2C_ARCHITECTURAL_RISK_REGISTER.md` — no open **production blocker** risks without explicit executive waiver.
4. Rollback drill success per `C2C_SAFE_IMPLEMENTATION_SEQUENCE.md` PHASE 7 (and repeat after material change delta).
5. Named **go/no-go** approvers (security, finance, engineering leadership) — roster recorded outside this doc.

---

## 13. Conditions for re-freezing

- Any **duplicate customer message** incident in pilot or prod attributed to new path.
- **Privilege escalation** or JWT bypass suspicion confirmed or highly likely.
- **Audit divergence** that affects dispute resolution or regulatory response.
- **Rollback drill failure** during or after rollout.
- Material **migration** or **Edge** deploy without pre-approved change record (per org process).

Re-freeze = **stop widening scope**, preserve forensics, revert to last known-good, update risk register.

---

## 14. Emergency stop principles

1. **Stop sending first** — reduce customer blast radius before root-cause completion.
2. **Preserve evidence** — logs, rows, correlation IDs; avoid destructive “cleanup” until triage done.
3. **Communicate** — internal incident channel + customer template if user-visible.
4. **Do not “fix forward” under fire** without second reviewer for same change class that failed.
5. **Re-freeze** until post-incident actions update acceptance criteria and scorecard.

---

## Cross-links

- `C2C_MASTER_GOVERNANCE_INDEX.md`
- `C2C_STAGING_PILOT_ACCEPTANCE_CRITERIA.md`
- `C2C_EXECUTIVE_READINESS_SCORECARD.md`
