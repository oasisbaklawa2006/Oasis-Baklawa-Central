# C2C — Stage 1 owner assignment worksheet

**Purpose:** Map each **governance domain** to **role-level** and **named** primary/backup owners, approval and escalation paths, and evidence duties. **Named cells** must match **`C2C_STAGE1_NAMED_OWNER_INTAKE_FORM.md`** when filled — do not invent assignees. **Worksheet only** — does not grant authority or change runtime.

**Related:** `C2C_STAGE1_NAMED_OWNER_INTAKE_FORM.md`, `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`, `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, `C2C_ROLE_SEPARATION_MATRIX.md`, `C2C_GOVERNANCE_ESCALATION_LADDER.md`, `C2C_GOVERNANCE_APPROVAL_MODEL.md`.

**Owner assignment does not imply implementation authorization.**

---

## Worksheet (governance domains)

| Governance domain | Primary role owner | Primary assignee (name) | Backup role owner | Backup assignee (name) | Approval authority (role) | Escalation authority (role) | Evidence responsibility |
|-------------------|-------------------|-------------------------|-------------------|-------------------------|----------------------------|----------------------------|---------------------------|
| Program governance & binder | **Governance Lead** | `________________` | **Release Authority** | `________________` | Governance Lead (process) + Release Authority (release gate) | **Governance Lead** → **Release Authority** | Tabletop minutes, gap tracker updates, GO binder assembly |
| Security, JWT, replay, operator identity | **Security Lead** | `________________` | **Identity / JWT Reviewer** | `________________` | **Security Lead** (veto + staging security signoff) | **Security Lead** → **Governance Lead** | JWT matrix, replay logs, operator negative tests |
| Platform & implementation evidence | **Platform Lead** | `________________` | **Release Authority** | `________________` | **Release Authority** (release artefact acceptance) | **Platform Lead** → **Release Authority** | Idempotency, duplicate-send, no-send traces |
| Staging operations & isolation | **Staging Operations Lead** | `________________` | **Platform Lead** | `________________` | **Staging Operations Lead** + **Security Lead** (isolation) | **Staging Operations Lead** → **Rollback Authority** | Isolation fingerprints, queue posture, no-production-write posture |
| Observability & alerts | **Observability Lead** | `________________` | **Staging Operations Lead** | `________________` | **Observability Lead** + **Rollback Authority** (incident correlation) | **Observability Lead** → **Staging Operations Lead** | Dashboards, metric defs, alert receipts |
| Rollback & kill switch | **Rollback Authority** | `________________` | **Staging Operations Lead** | `________________` | **Rollback Authority** + **Security Lead** | **Rollback Authority** → **Governance Lead** | Dated drill logs, kill-switch attestations |
| Audit chain | **Audit Lead** | `________________` | **Finance Authority Reviewer** | `________________` | **Finance Authority Reviewer** (where finance scope) | **Audit Lead** → **Finance Authority Reviewer** | Audit exports, ordered chain evidence |
| Dispatch-facing dry-run scope (if applicable) | **Dispatch Authority Reviewer** | `________________` | **Governance Lead** | `________________` | **Dispatch Authority Reviewer** | **Dispatch Authority Reviewer** → **Governance Lead** | Dispatch coupling review notes (no runtime change) |
| Finance-adjacent controls | **Finance Authority Reviewer** | `________________` | **Audit Lead** | `________________` | **Finance Authority Reviewer** | **Finance Authority Reviewer** → **Governance Lead** | SoD attestations for audit/finance overlap |
| Emergency freeze & stop-the-line | **Security Lead** / **Rollback Authority** / **Governance Lead** (any per policy) | `________________` | **Release Authority** | `________________` | **Governance Lead** records stop | Per `C2C_GOVERNANCE_ESCALATION_LADDER.md` | Freeze incident ids, written stop records |

---

## Status

All evidence rows remain **MISSING** until artifacts attach per `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`. **Stage 1 remains NO-GO.**
