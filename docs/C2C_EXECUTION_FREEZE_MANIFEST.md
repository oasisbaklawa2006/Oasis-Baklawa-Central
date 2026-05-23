# C2C — Master execution freeze manifest

**Purpose:** Single source of truth for what is **forbidden** until governance gates clear. **Documentation only** — does not change runtime configuration.

**Supersedes nothing:** Other charters (`C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md`, dry-run docs) remain complementary; this manifest is the **execution-oriented** rollup.

---

## 1. Current platform state

- **Main** carries C2C governance, dry-run pilot **design**, audits, scorecards, and freeze charters as **documentation**.
- **WhatsApp operator** experience on main is **read-first** with bounded operator actions per existing product behavior; C2C program treats **expansion** of authority as **frozen** until evidence gates pass.
- **No staging execution** of the dry-run pilot is authorized by docs alone — implementation and env work are **out of scope** until explicitly approved.

---

## 2. Production write freeze status

**ACTIVE.** No C2C-class **production** write expansion (new sends, new automation, new authority surfaces) may proceed under this program without thaw conditions documented in `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md` and this manifest.

---

## 3. Staging execution freeze status

**ACTIVE.** No **staging execution** of pilot scenarios (dry-run workers, mock pipelines, scheduled jobs) may begin until `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md` (and related evidence) is satisfied and **written authorization** exists per `C2C_GOVERNANCE_APPROVAL_MODEL.md`.

*Design and documentation work continues.*

---

## 4. What is allowed today

- **Read-only** use of production and staging apps as already permitted by org policy.
- **Documentation:** audits, roadmaps, manifests, principles, evidence checklists, approval models.
- **Local inspection** of code without merging runtime changes under this sprint’s global rules.
- **Planning meetings** that produce signed notes (outside repo).

---

## 5. What is forbidden today

| Category | Forbidden |
|----------|-----------|
| Schema | New **migrations** for C2C objectives |
| Tooling | **Supabase CLI** operations for this program track |
| Release | **Manual deploys** to satisfy pilot curiosity |
| Code | **Runtime** changes, **Edge** edits, **new** `invoke` sites |
| Data | **DB writes** staged as “just testing” without approved staging isolation |
| Pilot | **Staging execution** of dry-run or shadow pipelines without GO sign-off |
| Authority | **TOOL 5**, **finance**, **dispatch** hooks in any new pilot code |

---

## 6. Explicitly frozen capabilities

- **Unsupervised queue automation** for customer-visible messages.
- **Retry / resend** systems without idempotency and DLQ design **and** evidence.
- **Bulk** operator actions affecting many recipients without batch controls.
- **JWT-off** ingress changes that widen anonymous write surface without compensating controls.
- **Production pilot** or **production rollout** of new C2C authority paths.

---

## 7. Explicitly allowed read-only capabilities

- Operator **inbox read**, suggestions that do **not** auto-persist routing, exports of data already authorized to the role.
- Governance **read** of logs and dashboards for incident response unrelated to pilot (existing ops).

---

## 8. Docs-only permitted work

- Any `docs/C2C_*.md` (and cross-links) that do not embed secrets.
- Runbooks and checklists that reference **process**, not live keys.

---

## 9. Why freezes still exist

- **Ingress trust**, **idempotency**, and **queue isolation** are not yet evidenced for **execution** in staging.
- **Split trust model** (Edge service role vs client RLS) remains a systemic review burden.
- **Dry-run design** is not **execution proof** — it defines what to measure, not that measurement is live.

---

## 10. Conditions to thaw staging freeze

All must be true:

1. **GO** recorded on `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md` with attached evidence bundle.
2. **Isolation** sign-off per `C2C_STAGING_ISOLATION_CHARTER.md`.
3. **Approval** per `C2C_GOVERNANCE_APPROVAL_MODEL.md` for “staging execution (dry-run).”
4. **Kill switch** and **rollback** drill completed once in staging.

---

## 11. Conditions to thaw production freeze

All staging thaw conditions, plus:

1. Scorecard / successor artifact shows **no RED** for production-targeted rows in scope.
2. **Risk register** closure or signed waivers for residual risks.
3. **Go/no-go** memo with security + finance + engineering leadership (roster outside this file).
4. **Game-day** outcomes archived.

---

## 12. Emergency re-freeze triggers

- Duplicate or misrouted **customer-visible** message attributed to pilot path.
- Suspected **JWT bypass** or **privilege escalation**.
- **Audit divergence** affecting disputes or compliance response.
- **Rollback drill failure** or inability to disable send path within SLO.
- **Credential leak** suspicion between staging and production.

**Action:** immediate execution freeze reinstatement; incident review; update manifests.

---

## 13. Unsafe shortcuts explicitly forbidden

- “We’ll test in prod with a flag” without signed override process.
- Shared **service role** keys across environments.
- **Skipping** correlation IDs because staging is informal.
- **Client-only** idempotency without server dedupe store.
- Declaring success from **happy-path** manual testing only.

---

## 14. “No silent authority expansion” rule

Any new capability that can **change customer-visible state**, **move money**, **release dispatch**, or **override human decisions** must be:

- Named in a doc or ADR **before** merge,
- Reviewed under approval model,
- Behind explicit flags with audit.

**Silent** expansion (accidental new side effect in unrelated PR) is a **freeze violation** and triggers re-freeze until triage completes.

---

## 15. “No implementation before evidence” rule

Implementation work on frozen surfaces **must not** begin until the **evidence categories** in `C2C_PRE_IMPLEMENTATION_EVIDENCE_REQUIREMENTS.md` are satisfied for that surface — not “planned,” **attached** (logs, dashboards, test output, sign-off).

---

## Cross-links

- `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md`
- `C2C_FIRST_STAGING_DRYRUN_PILOT.md`
- `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`
- `C2C_GOVERNANCE_APPROVAL_MODEL.md`
- `C2C_NOT_READY_FOR_PRODUCTION_SUMMARY.md`
- `C2C_MASTER_GOVERNANCE_INDEX.md`
