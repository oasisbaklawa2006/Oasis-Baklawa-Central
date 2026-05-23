# C2C — Governance escalation ladder (C2C / Stage 1)

**Purpose:** Define **who may escalate**, **who must review**, **who may veto**, and **who may emergency-freeze** using **role titles only**. Does not authorize execution or thaw.

**Related:** `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`, `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, `C2C_ROLE_SEPARATION_MATRIX.md`, `C2C_ACTION_OWNER_REGISTER.md`.

---

## Stage 1 escalation (evidence / NO-GO disputes)

| Step | Who may escalate | Who must review | Who may veto | Who may emergency-freeze |
|------|------------------|-----------------|--------------|----------------------------|
| Evidence gap or timeline slip | **Platform Lead**, **Observability Lead**, **Identity / JWT Reviewer** | **Governance Lead** | **Security Lead**, **Release Authority** | **Security Lead**, **Governance Lead** |
| Cross-domain conflict | **Governance Lead** | **Release Authority** + affected domain leads | **Security Lead** | **Security Lead**, **Rollback Authority** |

---

## Freeze escalation

| Step | Who may escalate | Who must review | Who may veto | Who may emergency-freeze |
|------|------------------|-----------------|--------------|----------------------------|
| Suspected prod/staging bleed | **Staging Operations Lead**, **Identity / JWT Reviewer** | **Security Lead** | **Security Lead** | **Security Lead**, **Rollback Authority**, **Governance Lead** |
| Policy ambiguity on freeze | **Governance Lead** | **Release Authority** | **Release Authority** | **Governance Lead** (communicate stop), **Security Lead** (technical stop) |

---

## Audit escalation

| Step | Who may escalate | Who must review | Who may veto | Who may emergency-freeze |
|------|------------------|-----------------|--------------|----------------------------|
| Broken audit chain or missing export | **Audit Lead** | **Finance Authority Reviewer** | **Finance Authority Reviewer** | **Governance Lead** (program stop), **Security Lead** (technical containment) |

---

## Rollback escalation

| Step | Who may escalate | Who must review | Who may veto | Who may emergency-freeze |
|------|------------------|-----------------|--------------|----------------------------|
| Failed drill or SLO miss | **Rollback Authority** | **Staging Operations Lead** + **Security Lead** | **Security Lead** | **Rollback Authority**, **Governance Lead** |

---

## Security escalation

| Step | Who may escalate | Who must review | Who may veto | Who may emergency-freeze |
|------|------------------|-----------------|--------------|----------------------------|
| JWT / replay / isolation defect | **Identity / JWT Reviewer**, **Staging Operations Lead** | **Security Lead** | **Security Lead** | **Security Lead** |

---

## Production-stop escalation

| Step | Who may escalate | Who must review | Who may veto | Who may emergency-freeze |
|------|------------------|-----------------|--------------|----------------------------|
| Any production impact risk | **Security Lead**, **Rollback Authority**, **Governance Lead** | **Release Authority** (when thaw/routing involved) | **Security Lead**, **Finance Authority Reviewer** (finance scope) | **Security Lead**, **Rollback Authority**, **Governance Lead** (per charter; any may trigger stop, retro alignment follows workflow) |

---

## Dispatch authority escalation (scope reviews only)

| Step | Who may escalate | Who must review | Who may veto | Who may emergency-freeze |
|------|------------------|-----------------|--------------|----------------------------|
| Dispatch coupling concern in dry-run design | **Dispatch Authority Reviewer** | **Governance Lead** + **Security Lead** | **Dispatch Authority Reviewer**, **Security Lead** | **Governance Lead** |

---

**Stage 1 remains NO-GO.** This ladder governs **governance response** only until evidence and approvals satisfy `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`.
