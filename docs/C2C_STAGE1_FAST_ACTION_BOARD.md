# C2C — Stage 1 fast action board

**Purpose:** Kanban-style **task list** for evidence and roster work. **Status:** all **OPEN**. Does not grant implementation authority.

**Related:** `C2C_STAGE1_CONTROL_DASHBOARD.md`, `C2C_STAGE1_DECISION_SNAPSHOT.md`, `C2C_STAGE1_EVIDENCE_COLLECTION_RUNBOOK.md`.

## Named owner & first evidence intake

- `C2C_STAGE1_NAMED_OWNER_INTAKE_FORM.md`  
- `C2C_STAGE1_OWNER_ASSIGNMENT_INSTRUCTIONS.md`  
- `C2C_STAGE1_FIRST_EVIDENCE_ARTIFACT_INTAKE.md`  

---

## Task board

| Action | Owner role | Priority | Status | Evidence output | Blocks Stage 1? | Notes |
|--------|------------|----------|--------|-----------------|-----------------|-------|
| Assign named governance owner (bind to Governance Lead role) | **Governance Lead** | **P0** | **OPEN** | Roster row + HR/ticket link | **YES** | Named person optional until policy supplies; track as OPEN until linked |
| Assign named security / JWT owner | **Security Lead** | **P0** | **OPEN** | Roster + coverage | **YES** | |
| Assign named staging environment owner | **Staging Operations Lead** | **P0** | **OPEN** | Roster + coverage | **YES** | |
| Assign named observability owner | **Observability Lead** | **P0** | **OPEN** | Roster + coverage | **YES** | |
| Assign named rollback owner | **Rollback Authority** | **P0** | **OPEN** | Roster + coverage | **YES** | |
| Collect staging isolation proof | **Staging Operations Lead** | **P0** | **OPEN** | Isolation artifact | **YES** | Runbook §1 |
| Collect JWT / auth proof | **Identity / JWT Reviewer** | **P0** | **OPEN** | JWT matrix | **YES** | Runbook §2 |
| Collect queue-disabled proof | **Staging Operations Lead** | **P0** | **OPEN** | Queue snapshot / isolation narrative | **YES** | Runbook §11 |
| Collect no-send proof | **Platform Lead** | **P0** | **OPEN** | Trace pack | **YES** | Runbook §12 |
| Collect no-production-write proof | **Staging Operations Lead** | **P0** | **OPEN** | Config / pipeline pack | **YES** | Runbook §13 |
| Collect audit proof | **Audit Lead** | **P0** | **OPEN** | Audit chain export | **YES** | Runbook §7 |
| Collect rollback proof | **Rollback Authority** | **P0** | **OPEN** | Drill log | **YES** | Runbook §8 |
| Collect alert proof | **Observability Lead** | **P0** | **OPEN** | Alert receipt | **YES** | Runbook §10 |
| Collect observability proof | **Observability Lead** | **P0** | **OPEN** | Dashboard capture | **YES** | Runbook §9 |
| Collect approver signoff | **Release Authority** | **P0** | **OPEN** | Signed PDF / tickets | **YES** | After other evidence; no invented signatures |

---

**Stage 1 remains NO-GO** while any row is **OPEN** without cleared evidence per workflow.
