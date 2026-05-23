# C2C — Stage 1 owner assignment rules

**Purpose:** Define how **named** owners (when assigned by policy, not by this doc) and **status** transitions are controlled for Stage 1 evidence — **without** inventing people or approvals.

**Related:** `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`, `C2C_STAGE1_STATUS_TRANSITION_LOG.md`, `C2C_STAGE1_APPROVAL_BLOCKER_BOARD.md`, `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`.

---

## 1. Owner assignment purpose

- Ensure every **P0** evidence packet has **accountable** primary and backup owners **once** program leadership assigns names (replacing **TBD**).  
- Prevent gaps where evidence is “in progress” with no responsible party.

---

## 2. Required owner domains

At minimum, domains that must be able to own or co-own evidence work:

- **Security** — JWT, replay, operator identity.  
- **Ops / SRE** — isolation, rollback, observability, alerts, queue state, no-production-write posture.  
- **Tech lead** — idempotency, duplicate-send, no-send traces.  
- **Audit / compliance delegate** (when in scope) — audit chain evidence.  
- **Approval / program** — binder for signoff artifacts (distinct from evidence producers).

---

## 3. Which domains may share owners

- **Ops** may own both **observability** and **alert** evidence if leadership assigns one Ops lead, provided workload and SoD are acceptable **in writing**.  
- **Security** may own **JWT**, **replay**, and **operator identity** under a single security lead if policy allows.

---

## 4. Which domains must not share owners

- **Evidence producer** for a packet and **final approver** for that same packet: **must not** be the same person (**no self-approval**).  
- **Audit** evidence owner and **sole finance approver** (when finance signoff applies): **must not** be the same individual without a documented **separation of duties** exception approved in writing.

---

## 5. Backup owner requirement

Every P0 packet row in `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md` must have **both** primary and backup filled (replacing **TBD**) before treating **OWNER_ASSIGNED** as valid for that row. Backup must be able to **receive** status updates and **escalate** if primary is unavailable.

---

## 6. No-self-approval rule

No person may **approve** evidence or a GO transition for a packet they **solely produced** without a second approver recorded in `C2C_STAGE1_STATUS_TRANSITION_LOG.md`. Matches `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`.

---

## 7. Evidence owner vs approval owner distinction

- **Evidence owner:** accountable for producing and attaching artifacts (primary/backup on the matrix).  
- **Approval owner:** accountable for **signing** or **recording** approval references after independent review — **different role**, may be Security/Ops/Tech lead per decision class.

---

## 8. Status transition rules

Allowed **status** values for packet rows (evidence lifecycle):

| Status | Meaning |
|--------|---------|
| **MISSING** | No owner assignment and/or no attachable artifact. **Default for Stage 1 today.** |
| **OWNER_ASSIGNED** | Primary and backup set to **named** people (not **TBD**); work not started. |
| **EVIDENCE_IN_PROGRESS** | Named owners actively collecting or redacting evidence. |
| **EVIDENCE_SUBMITTED** | Artifact linked at **current evidence path**; pending review. |
| **APPROVED** | Reviewer(s) recorded approval reference for that packet. |
| **REJECTED** | Reviewer returned evidence; must reset toward **EVIDENCE_IN_PROGRESS** or **MISSING**. |
| **BLOCKED** | External dependency or freeze; no forward progress until cleared in writing. |

---

## 9. How to update status safely

- Every change must append a row to `C2C_STAGE1_STATUS_TRANSITION_LOG.md` (date, packet, previous → new status, changed by **named** user, path, approval ref, notes).  
- Do **not** delete history; append only.  
- Do **not** move to **APPROVED** without a linked artifact and approval reference.

---

## 10. When GO / NO-GO may change

- **NO-GO → conditional GO** (staging dry-run only) only when: all P0 matrix rows are **APPROVED**, `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md` is satisfied with attachments, and `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md` signoffs exist.  
- **NO-GO** returns automatically on veto, failed drill, or evidence stale per approval expiry (when set).

---

## 11. What must remain NO-GO

Until the above is true:

- **Stage 1 runtime implementation** — **NO-GO**.  
- **Staging execution** — **NOT AUTHORIZED**.  
- **Production writes / sends / queues / retries** — **OUT OF SCOPE** and **NOT AUTHORIZED**.

No status movement in logs may be read as **runtime** or **execution** authorization.
