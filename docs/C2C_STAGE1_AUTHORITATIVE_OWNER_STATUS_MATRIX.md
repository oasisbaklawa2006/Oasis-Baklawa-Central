# C2C — Stage 1 authoritative owner / status matrix

**Purpose:** Single **control table** mapping each **P0** Stage 1 evidence blocker to **owner placeholders** and **current status**. Does **not** assign real people, grant approval, or authorize runtime work.

**Related:** `C2C_STAGE1_EVIDENCE_PACKET_INDEX.md`, `C2C_EVIDENCE_GAP_TRACKER.md`, `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, `C2C_STAGE1_STATUS_TRANSITION_LOG.md`, `C2C_STAGE1_APPROVAL_BLOCKER_BOARD.md`.

---

## Owner / status matrix (P0 packets)

| Evidence packet | Priority | Required artifact | Primary owner | Backup owner | Status | Blocks staging? | Blocks production? | Current evidence path | Next action | Approval required? | Notes |
|-----------------|----------|-------------------|---------------|--------------|--------|-----------------|---------------------|-------------------------|--------------|---------------------|-------|
| Staging isolation proof | **P0** | Key fingerprint + project id + egress denylist summary | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign primary/backup; attach isolation proof | **Y** | No shared prod/staging resources |
| JWT / auth proof | **P0** | Redacted 401/200 matrix per pilot entrypoint | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; run matrix; attach artifact | **Y** | |
| Operator identity proof | **P0** | Negative tests: spoofed / unauthorized operator rejected | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach test logs | **Y** | |
| Idempotency proof | **P0** | Dedupe store + double-submit logs | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach logs | **Y** | |
| Replay proof | **P0** | Replay within TTL → suppressed (logs) | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach replay logs | **Y** | |
| Duplicate-send proof | **P0** | Logical send count = 1 under load (staging) | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach soak evidence | **Y** | Aligns duplicate-prevention packet in index |
| Audit proof | **P0** | Ordered audit ids + failure injection | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach audit chain | **Y** | Must-pass per pre-pilot §7 |
| Rollback proof | **P0** | Dated kill-switch / rollback drill log ≤ SLO | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach drill log | **Y** | |
| Observability proof | **P0** | Live dashboard + metric definitions | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach dashboard capture | **Y** | |
| Alert proof | **P0** | Page or ticket receipt on injected fault | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach alert receipt | **Y** | Aligns checklist §6 |
| Queue-disabled proof | **P0** | Snapshot `state=disabled` + worker off (or staging-only queue isolation) | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach snapshot | **Y** | Aligns checklist §4 |
| No-send proof | **P0** | Trace showing zero provider send for dry-run path | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach trace | **Y** | |
| No-production-write proof | **P0** | Config/screenshots proving prod write paths disabled | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Assign owners; attach proof | **Y** | |
| Approver signoff proof | **P0** | Signed PDF / immutable ticket links per workflow | **TBD** | **TBD** | **MISSING** | **YES** | **YES** | **TBD** | Named approvers only when policy assigns them; attach signoff | **Y** | No self-approval |

---

## Control note

**Stage 1 remains NO-GO until every row is COMPLETE and approved.**

`COMPLETE` here means: **status** = evidence accepted per `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, **current evidence path** filled with an immutable link, and **approval reference** recorded in `C2C_STAGE1_STATUS_TRANSITION_LOG.md` where required. Until then, all rows above remain **MISSING** for attachable evidence.
