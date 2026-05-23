# C2C — Stage 1 first evidence artifact intake (template)

**Purpose:** Single-row (or duplicated-row) template for the **first** attachable evidence item per packet. **Default status: NOT SUBMITTED.** Do not mark **accepted** without a real reviewer and artifact.

**Related:** `C2C_STAGE1_EVIDENCE_COLLECTION_RUNBOOK.md`, `C2C_STAGE1_CONTROL_DASHBOARD.md`, `C2C_STAGE1_NAMED_OWNER_INTAKE_FORM.md`.

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
| **Accepted / rejected** | `NOT SUBMITTED` / `PENDING` / `ACCEPTED` / `REJECTED` (default: **NOT SUBMITTED**) |
| **Reason** | `________________________` |
| **Blocker status** | `OPEN` / `CLEARED` (default: **OPEN** until accepted) |
| **Notes** | `________________________` |

---

## Defaults (must start here)

| Field | Default |
|-------|---------|
| **Accepted / rejected** | **NOT SUBMITTED** |
| **Blocker status** | **OPEN** |

---

## Rules

- **Do not** set **ACCEPTED** until reviewer + artifact exist.  
- **Do not** mark any P0 packet **COMPLETE** in the authoritative matrix based on this template alone — follow `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`.  
- **Stage 1 remains NO-GO** until the full evidence + signoff chain clears.
