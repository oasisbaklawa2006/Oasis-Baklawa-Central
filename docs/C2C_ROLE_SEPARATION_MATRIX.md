# C2C — Role separation matrix (Stage 1 governance)

**Purpose:** State **separation of duties** between **evidence production custody**, **approval**, and **emergency freeze** by **role title** only. Does not name individuals or authorize runtime work.

**Related:** `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`, `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`, `C2C_GOVERNANCE_APPROVAL_MODEL.md`.

**No single role may both generate and self-approve production-thaw evidence.**

---

## Separation matrix

| Capability | Evidence owner (role) | Approval owner (role) | Emergency freeze owner (role) | Must be separate? |
|------------|------------------------|-------------------------|--------------------------------|-------------------|
| JWT proof | **Identity / JWT Reviewer** | **Security Lead** | **Security Lead** | **YES** — evidence vs approval (Identity / JWT ≠ sole Security approver without second reviewer per workflow) |
| Rollback proof | **Rollback Authority** | **Security Lead** + **Release Authority** | **Rollback Authority** | **YES** — drill executor ≠ sole approver; Security co-approves |
| Audit proof | **Audit Lead** | **Finance Authority Reviewer** | **Governance Lead** | **YES** — audit custody vs finance approval |
| Replay proof | **Identity / JWT Reviewer** | **Security Lead** | **Security Lead** | **YES** — same pattern as JWT |
| Observability proof | **Observability Lead** | **Rollback Authority** | **Staging Operations Lead** | **YES** — ops evidence vs incident/rollback approval |
| Alert proof | **Observability Lead** | **Rollback Authority** | **Staging Operations Lead** | **YES** — alert producer ≠ sole pager approval |
| Queue-disabled proof | **Staging Operations Lead** | **Security Lead** | **Rollback Authority** | **YES** — isolation posture vs security signoff |
| Finance authority | **Finance Authority Reviewer** (policy attestation) | **Governance Lead** + **Release Authority** | **Governance Lead** | **YES** — finance attest ≠ sole release approver |
| Dispatch authority | **Dispatch Authority Reviewer** | **Governance Lead** + **Security Lead** | **Governance Lead** | **YES** — dispatch scope vs governance/security |
| Staging isolation | **Staging Operations Lead** | **Security Lead** | **Security Lead** | **YES** — environment operator vs security approval |
| Production thaw approval | **Governance Lead** (packet assembly custody) | **Release Authority** + **Finance Authority Reviewer** (when applicable) | **Security Lead** | **YES** — **critical**; no single role may generate and self-approve thaw |

---

## Notes

- **Production thaw** is **out of Stage 1** default scope; matrix row defines **future** SoD should Stage 1 expand.  
- Where the workflow requires **two** approvers, both roles must sign — not one role wearing two hats in the same decision.
