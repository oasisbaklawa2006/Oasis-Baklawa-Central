# C2C — Stage 1 owner assignment instructions

**Purpose:** Explain **how** to bind **real names** to governance roles and update records **without** inventing people in git, **without** self-approval, and **without** implying runtime authorization.

**Related:** `C2C_STAGE1_NAMED_OWNER_INTAKE_FORM.md`, `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`, `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, `C2C_ROLE_SEPARATION_MATRIX.md`, `C2C_STAGE1_STATUS_TRANSITION_LOG.md`.

---

## 1. How to fill owner names

1. Use **`C2C_STAGE1_NAMED_OWNER_INTAKE_FORM.md`** only after your organization’s **HR / security / management** process approves recording names.  
2. Prefer **ticket links** or **signed PDFs** stored outside the repo for PII; in-repo copies should be **redacted**.  
3. Never fabricate names for the repository — leave placeholders until real appointments exist.

---

## 2. Who cannot self-approve

- Anyone who **solely produced** the evidence for a packet **cannot** be the **sole** approver for that same packet.  
- **Release Authority** cannot single-handedly approve a GO binder they alone assembled **without** independent Security / Rollback (etc.) signoffs per workflow.  
- See **`C2C_ROLE_SEPARATION_MATRIX.md`** for capability-specific rules.

---

## 3. Which roles must be separate

At minimum (program may tighten):

- **Evidence owner** vs **approval owner** for JWT, rollback, audit, observability, alerts, queues, production-thaw path.  
- **Finance Authority Reviewer** vs **Audit Lead** when SoD requires.  
- **Dispatch Authority Reviewer** vs sole **Platform** evidence owner when dispatch coupling is in scope.

---

## 4. How to update the matrix after names are confirmed

1. Do **not** paste full PII into the matrix if policy forbids — keep **role** column authoritative; link a **roster ticket** in `Current evidence path` or in the status log.  
2. If policy allows inline names, append a **change record** row in `C2C_STAGE1_STATUS_TRANSITION_LOG.md` (date, packet or role row, previous → new, changed by, link, approval ref, notes).  
3. Move role-row status from **MISSING** only when **EVIDENCE_SUBMITTED** / **APPROVED** rules in `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md` are met — **not** when names alone appear.

---

## 5. How to record acknowledgement

- Use **signature / acknowledgement** fields on the intake form **or** equivalent **signed** HR/policy ticket.  
- Log a pointer in `C2C_STAGE1_STATUS_TRANSITION_LOG.md` with immutable URL.  
- **Do not** use informal chat as acknowledgement.

---

## 6. Why this does not authorize runtime work

- Naming people assigns **governance accountability** only.  
- **Staging execution**, **Edge** changes, **queues**, **sends**, **retries**, and **TOOL 5** remain **out of scope** until **conditional GO** with attached evidence and signoffs.  
- Docs in git **never** replace deploy/runtime gates.

---

## 7. Stage 1 remains NO-GO

Until P0 evidence is attached, reviewed, and signed per **`C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`** and **`C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`**, the program position is:

**NO-GO.**
