# C2C — Stage 1 first evidence artifact intake (template)

**Purpose:** Record attachable evidence items for Stage 1. **Default for new slots:** intake may be opened as **SUBMITTED_FOR_REVIEW** only when an artifact link and reviewer are **actually** identified — otherwise keep **NOT SUBMITTED**. Do not mark **ACCEPTED** without a real reviewer and artifact. **Stage 1 remains NO-GO.**

**Related:** `C2C_STAGE1_EVIDENCE_COLLECTION_RUNBOOK.md`, `C2C_STAGE1_CONTROL_DASHBOARD.md`, `C2C_STAGE1_NAMED_OWNER_INTAKE_FORM.md`, `C2C_STAGE1_FIRST_REAL_EVIDENCE_CHECKPOINT.md`.

---

## Intake record (copy block per submission)

| Field | Value |
|-------|-------|
| **Evidence packet name** | `________________________` |
| **Owner** | Role: `________________________` · Name (if policy allows): `________________________` |
| **Artifact path** | `________________________` (URL / ticket / versioned object path) |
| **Collection date** | `____-__-__` |
| **Environment** | `staging` / `other: ________` (must not be prod for Stage 1 dry-run track) |
| **Screenshot / log reference** | `________________________` |
| **Reviewer** | Role: `________________________` · Name: `________________________` |
| **Intake / review status** | `NOT SUBMITTED` / `SUBMITTED_FOR_REVIEW` / `RETURNED` |
| **Accepted / rejected** | `NOT SUBMITTED` / `PENDING` / `ACCEPTED` / `REJECTED` |
| **Reason** | `________________________` |
| **Blocker status** | `OPEN` / `CLEARED` (default: **OPEN** until accepted) |
| **Notes** | `________________________` |

---

## First real submission (record #1) — queue-disabled proof (slot opened)

**Recommended first packet:** queue-disabled proof (lowest coupling to live sends). **This row documents governance intake only** — artifact and named reviewer must still be supplied by the owning organization.

| Field | Value |
|-------|-------|
| **Evidence packet name** | Queue-disabled proof |
| **Owner** | Role: **Staging Operations Lead** · Name: `________________` |
| **Artifact path** | `________________` |
| **Collection date** | `________________` |
| **Environment** | **staging** |
| **Screenshot / log reference** | `________________` |
| **Reviewer** | Role: **Security Lead** · Name: `________________` |
| **Intake / review status** | **SUBMITTED_FOR_REVIEW** |
| **Accepted / rejected** | **PENDING** |
| **Reason** | First evidence slot opened for queue-disabled packet; awaiting artifact URL and named reviewer per intake form. |
| **Blocker status** | **OPEN** |
| **Notes** | **Submission is not approval.** No runtime verification is claimed by this doc update alone. **Stage 1 remains NO-GO.** |

---

## Defaults (blank slots)

| Field | Default |
|-------|---------|
| **Intake / review status** (new empty rows) | **NOT SUBMITTED** |
| **Accepted / rejected** | **NOT SUBMITTED** or **PENDING** when in review |
| **Blocker status** | **OPEN** |

---

## Rules

- **Do not** set **ACCEPTED** until reviewer + artifact exist.  
- **Do not** mark any P0 packet **COMPLETE** in the authoritative matrix based on this template alone — follow `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`.  
- **Stage 1 remains NO-GO** until the full evidence + signoff chain clears.
