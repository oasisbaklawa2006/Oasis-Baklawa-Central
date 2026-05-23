# C2C — Stage 1 approval blocker board

**Purpose:** Track **open** blockers that prevent Stage 1 from moving off **NO-GO**. **Not** a substitute for the signoff workflow or the owner matrix.

**Related:** `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`, `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, `C2C_STAGE1_APPROVAL_REQUEST_DRAFT.md`, `C2C_ROLE_SEPARATION_MATRIX.md`, `C2C_GOVERNANCE_ESCALATION_LADDER.md`.

---

## Blocker board

| Blocker | Severity | Evidence needed | Owner (role) | Status | Blocks staging | Blocks production | Resolution path |
|---------|----------|-----------------|--------------|--------|----------------|-------------------|-----------------|
| Named delegates not published for role owners | **P0** | Roster linking people to matrix roles | **Governance Lead** | **OPEN** | **YES** | **YES** | HR/policy + matrix update; log in `C2C_STAGE1_STATUS_TRANSITION_LOG.md` |
| On-call / backup coverage for roles not attested | **P0** | Backup coverage doc or schedule | **Release Authority** | **OPEN** | **YES** | **YES** | Publish coverage; Governance Lead acknowledges |
| Missing staging isolation proof | **P0** | Isolation artifact per matrix | **Staging Operations Lead** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing JWT proof | **P0** | JWT matrix artifact | **Identity / JWT Reviewer** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing replay proof | **P0** | Replay test logs | **Identity / JWT Reviewer** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing audit proof | **P0** | Audit chain + failure injection | **Audit Lead** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing rollback proof | **P0** | Dated drill log | **Rollback Authority** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing observability proof | **P0** | Dashboard + metric defs | **Observability Lead** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing alert proof | **P0** | Alert receipt on injected fault | **Observability Lead** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing queue-disabled proof | **P0** | Disabled snapshot or staging-only queue proof | **Staging Operations Lead** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing no-send proof | **P0** | Trace: zero provider send | **Platform Lead** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing no-production-write proof | **P0** | Config / screenshot pack | **Staging Operations Lead** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing approver signoff | **P0** | Signed PDF / ticket links per workflow | **Release Authority** | **OPEN** | **YES** | **YES** | Complete signoff per `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md` |

---

## Roll-up

**Stage 1:** **NO-GO** while any row above is **OPEN**. Close blockers only with **attached** evidence and logged status transitions — not with narrative alone. **Role assignment does not close blockers.**
