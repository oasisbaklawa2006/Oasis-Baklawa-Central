# C2C — Stage 1 approval blocker board

**Purpose:** Track **open** blockers that prevent Stage 1 from moving off **NO-GO**. **Not** a substitute for the signoff workflow or the owner matrix.

**Related:** `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`, `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, `C2C_STAGE1_APPROVAL_REQUEST_DRAFT.md`.

---

## Blocker board

| Blocker | Severity | Evidence needed | Owner | Status | Blocks staging | Blocks production | Resolution path |
|---------|----------|-----------------|-------|--------|----------------|-------------------|-----------------|
| Missing owners (primary/backup still TBD) | **P0** | Named owners on matrix rows | **TBD** | **OPEN** | **YES** | **YES** | Program leadership assigns per `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md` |
| Missing backup owners | **P0** | Backup filled for every P0 packet | **TBD** | **OPEN** | **YES** | **YES** | Complete matrix backup column |
| Missing staging isolation proof | **P0** | Isolation artifact per matrix | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing JWT proof | **P0** | JWT matrix artifact | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing replay proof | **P0** | Replay test logs | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing audit proof | **P0** | Audit chain + failure injection | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing rollback proof | **P0** | Dated drill log | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing observability proof | **P0** | Dashboard + metric defs | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing alert proof | **P0** | Alert receipt on injected fault | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing queue-disabled proof | **P0** | Disabled snapshot or staging-only queue proof | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing no-send proof | **P0** | Trace: zero provider send | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing no-production-write proof | **P0** | Config / screenshot pack | **TBD** | **OPEN** | **YES** | **YES** | Attach path; log transition |
| Missing approver signoff | **P0** | Signed PDF / ticket links per workflow | **TBD** | **OPEN** | **YES** | **YES** | Complete signoff per `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md` |

---

## Roll-up

**Stage 1:** **NO-GO** while any row above is **OPEN**. Close blockers only with **attached** evidence and logged status transitions — not with narrative alone.
