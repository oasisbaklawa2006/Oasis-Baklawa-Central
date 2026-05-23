# C2C — Stage 1 authoritative owner / status matrix

**Purpose:** Single **control table** mapping each **P0** Stage 1 evidence blocker to **role-level** primary and backup owners and **current status**. **Role titles only** — no personal names. Does **not** grant approval, produce evidence, or authorize runtime work.

**Related:** `C2C_STAGE1_EVIDENCE_PACKET_INDEX.md`, `C2C_EVIDENCE_GAP_TRACKER.md`, `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, `C2C_STAGE1_STATUS_TRANSITION_LOG.md`, `C2C_STAGE1_APPROVAL_BLOCKER_BOARD.md`, `C2C_ROLE_SEPARATION_MATRIX.md`, `C2C_GOVERNANCE_ESCALATION_LADDER.md`.

## Stage 1 control documents

- `C2C_STAGE1_CONTROL_DASHBOARD.md`  
- `C2C_STAGE1_EVIDENCE_COLLECTION_RUNBOOK.md`  
- `C2C_STAGE1_APPROVER_REVIEW_PACK.md`  
- `C2C_STAGE1_DECISION_SNAPSHOT.md`  
- `C2C_STAGE1_FAST_ACTION_BOARD.md`  

## Named owner & first evidence intake

- `C2C_STAGE1_NAMED_OWNER_INTAKE_FORM.md`  
- `C2C_STAGE1_OWNER_ASSIGNMENT_INSTRUCTIONS.md`  
- `C2C_STAGE1_FIRST_EVIDENCE_ARTIFACT_INTAKE.md`  

---

## Owner / status matrix (P0 packets)

| Evidence packet | Priority | Required artifact | Primary owner | Backup owner | Status | Blocks staging? | Blocks production? | Current evidence path | Next action | Approval required? | Notes |
|-----------------|----------|-------------------|---------------|--------------|--------|-----------------|---------------------|-------------------------|--------------|---------------------|-------|
| Staging isolation proof | **P0** | Key fingerprint + project id + egress denylist summary | **Staging Operations Lead** | **Platform Lead** | **MISSING** | **YES** | **YES** | **TBD** | Produce isolation artifact under role custody | **Y** | No shared prod/staging resources |
| JWT / auth proof | **P0** | Redacted 401/200 matrix per pilot entrypoint | **Identity / JWT Reviewer** | **Security Lead** | **MISSING** | **YES** | **YES** | **TBD** | Produce JWT matrix under security review | **Y** | |
| Operator identity proof | **P0** | Negative tests: spoofed / unauthorized operator rejected | **Identity / JWT Reviewer** | **Security Lead** | **MISSING** | **YES** | **YES** | **TBD** | Produce operator negative tests | **Y** | |
| Idempotency proof | **P0** | Dedupe store + double-submit logs | **Platform Lead** | **Release Authority** | **MISSING** | **YES** | **YES** | **TBD** | Produce idempotency logs | **Y** | |
| Replay proof | **P0** | Replay within TTL → suppressed (logs) | **Identity / JWT Reviewer** | **Security Lead** | **MISSING** | **YES** | **YES** | **TBD** | Produce replay logs | **Y** | |
| Duplicate-send proof | **P0** | Logical send count = 1 under load (staging) | **Platform Lead** | **Release Authority** | **MISSING** | **YES** | **YES** | **TBD** | Produce soak evidence | **Y** | Aligns duplicate-prevention packet in index |
| Audit proof | **P0** | Ordered audit ids + failure injection | **Audit Lead** | **Finance Authority Reviewer** | **MISSING** | **YES** | **YES** | **TBD** | Produce audit chain evidence | **Y** | Must-pass per pre-pilot §7 |
| Rollback proof | **P0** | Dated kill-switch / rollback drill log ≤ SLO | **Rollback Authority** | **Staging Operations Lead** | **MISSING** | **YES** | **YES** | **TBD** | Schedule drill; attach log | **Y** | |
| Observability proof | **P0** | Live dashboard + metric definitions | **Observability Lead** | **Platform Lead** | **MISSING** | **YES** | **YES** | **TBD** | Publish dashboard capture | **Y** | |
| Alert proof | **P0** | Page or ticket receipt on injected fault | **Observability Lead** | **Staging Operations Lead** | **MISSING** | **YES** | **YES** | **TBD** | Fire test alert; attach receipt | **Y** | Aligns checklist §6 |
| Queue-disabled proof | **P0** | Snapshot `state=disabled` + worker off (or staging-only queue isolation) | **Staging Operations Lead** | **Platform Lead** | **MISSING** | **YES** | **YES** | **TBD** | Capture queue posture evidence | **Y** | Aligns checklist §4 |
| No-send proof | **P0** | Trace showing zero provider send for dry-run path | **Platform Lead** | **Release Authority** | **MISSING** | **YES** | **YES** | **TBD** | Attach dry-run trace | **Y** | |
| No-production-write proof | **P0** | Config/screenshots proving prod write paths disabled | **Staging Operations Lead** | **Governance Lead** | **MISSING** | **YES** | **YES** | **TBD** | Attach freeze / routing proof | **Y** | |
| Approver signoff proof | **P0** | Signed PDF / immutable ticket links per workflow | **Release Authority** | **Governance Lead** | **MISSING** | **YES** | **YES** | **TBD** | Route through signoff workflow; no self-approval | **Y** | Custody vs independent approvers per `C2C_ROLE_SEPARATION_MATRIX.md` |

---

## Control note

**Stage 1 remains NO-GO until every row is COMPLETE and approved.**

`COMPLETE` here means: **status** = evidence accepted per `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, **current evidence path** filled with an immutable link, and **approval reference** recorded in `C2C_STAGE1_STATUS_TRANSITION_LOG.md` where required. Until then, all rows above remain **MISSING** for attachable evidence. **Role assignment alone does not satisfy any row.**

**Named delegate column:** When `C2C_STAGE1_NAMED_OWNER_INTAKE_FORM.md` is completed, record **named** delegates via ticket link or roster URL in the status log; optional narrow updates to this matrix may append names **without** changing **MISSING** / blocker columns until evidence is accepted.
