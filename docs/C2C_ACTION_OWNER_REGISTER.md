# C2C — Action owner register (role-level)

**Purpose:** Register **role-level** accountability for governance actions, evidence production custody, and approval chains. **Role titles only** — no personal names. **No approval is granted** by this document; **Stage 1 remains NO-GO** until evidence attaches and signoffs complete per workflow.

**Related:** `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`, `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`, `C2C_GOVERNANCE_APPROVAL_MODEL.md`, `C2C_ROLE_SEPARATION_MATRIX.md`, `C2C_GOVERNANCE_ESCALATION_LADDER.md`.

---

## 1. Governance authority owners

| Area | Primary role owner | Backup role owner | Responsibility | Required evidence | Approval authority (role) | Current status |
|------|-------------------|-------------------|----------------|-------------------|---------------------------|----------------|
| Program chair / doc index | **Governance Lead** | **Release Authority** | Maintains governance index, freeze comms, binder hygiene | Signed minutes, index links | **Governance Lead** (process custody) | **OPEN — evidence MISSING** |
| Doc merge gate (docs-only policy) | **Release Authority** | **Governance Lead** | Ensures governance PRs remain docs-only and checklist-clean | PR checklist artifacts | **N** for evidence signoff; **Y** for release hygiene | **OPEN — evidence MISSING** |

---

## 2. Engineering / platform evidence owners

| Area | Primary role owner | Backup role owner | Responsibility | Required evidence | Approval authority (role) | Current status |
|------|-------------------|-------------------|----------------|-------------------|---------------------------|----------------|
| Implementation readiness (future) | **Platform Lead** | **Release Authority** | Owns scope for future implementation PRs when authorized | Design + test plan attachments | **Release Authority** | **OPEN — evidence MISSING** |
| Flag / scaffold hygiene | **Platform Lead** | **Security Lead** | Keeps execution flags unwired until GO | CI / review records | **Security Lead** | **OPEN — evidence MISSING** |

---

## 3. Security / JWT owners

| Area | Primary role owner | Backup role owner | Responsibility | Required evidence | Approval authority (role) | Current status |
|------|-------------------|-------------------|----------------|-------------------|---------------------------|----------------|
| Ingress / JWT / replay | **Identity / JWT Reviewer** | **Security Lead** | JWT matrix, replay tests, operator negatives | Redacted logs, matrices | **Security Lead** | **OPEN — evidence MISSING** |
| Security veto | **Security Lead** | **Governance Lead** | Written veto on security gaps | Veto record | **Security Lead** | **OPEN — no veto exercised** |

---

## 4. Staging environment owners

| Area | Primary role owner | Backup role owner | Responsibility | Required evidence | Approval authority (role) | Current status |
|------|-------------------|-------------------|----------------|-------------------|---------------------------|----------------|
| Staging project / isolation | **Staging Operations Lead** | **Platform Lead** | Key posture, isolation fingerprints | Fingerprint doc | **Security Lead** + **Staging Operations Lead** | **OPEN — evidence MISSING** |
| Egress / denylist | **Staging Operations Lead** | **Security Lead** | Block prod providers in staging | Config export | **Security Lead** | **OPEN — evidence MISSING** |

---

## 5. Observability owners

| Area | Primary role owner | Backup role owner | Responsibility | Required evidence | Approval authority (role) | Current status |
|------|-------------------|-------------------|----------------|-------------------|---------------------------|----------------|
| Dashboards / metrics | **Observability Lead** | **Platform Lead** | Pilot metric tiles, definitions | URLs + query defs | **Rollback Authority** (incident readiness) | **OPEN — evidence MISSING** |
| Alerts / paging | **Observability Lead** | **Staging Operations Lead** | P0 alert routes, receipt tests | Page test ticket | **Rollback Authority** | **OPEN — evidence MISSING** |

---

## 6. Rollback owners

| Area | Primary role owner | Backup role owner | Responsibility | Required evidence | Approval authority (role) | Current status |
|------|-------------------|-------------------|----------------|-------------------|---------------------------|----------------|
| Kill switch / drills | **Rollback Authority** | **Staging Operations Lead** | Run rollback drills | Drill logs | **Rollback Authority** + **Security Lead** | **OPEN — evidence MISSING** |
| Runbooks | **Rollback Authority** | **Governance Lead** | Maintain rollback SOP | Versioned runbook link | **N** (custody); **Y** for operational signoff when required | **OPEN — evidence MISSING** |

---

## 7. Audit owners

| Area | Primary role owner | Backup role owner | Responsibility | Required evidence | Approval authority (role) | Current status |
|------|-------------------|-------------------|----------------|-------------------|---------------------------|----------------|
| Audit chain | **Audit Lead** | **Finance Authority Reviewer** | Append-only audit evidence | Audit export | **Finance Authority Reviewer** (finance-adjacent) | **OPEN — evidence MISSING** |

---

## 8. Approval-chain owners

| Area | Primary role owner | Backup role owner | Responsibility | Required evidence | Approval authority (role) | Current status |
|------|-------------------|-------------------|----------------|-------------------|---------------------------|----------------|
| Staging dry-run GO binder | **Release Authority** | **Governance Lead** | Assemble and route GO checklist | Signed bundle | **Security Lead**, **Rollback Authority**, **Release Authority** | **OPEN — NO-GO** |
| Executive / prod pilot (out of Stage 1 scope) | **Release Authority** | **Governance Lead** | Future prod pilot only | Full bundle | **Executive policy role** (not filled here) | **OUT OF SCOPE** |

---

## 9. Freeze authority owners

| Area | Primary role owner | Backup role owner | Responsibility | Required evidence | Approval authority (role) | Current status |
|------|-------------------|-------------------|----------------|-------------------|---------------------------|----------------|
| Emergency stop / re-freeze | **Security Lead** | **Rollback Authority** | Invoke emergency stop per policy | Incident / freeze id | **Security Lead** or **Rollback Authority** (per charter) | **OPEN — no stop exercised** |
| Governance freeze comms | **Governance Lead** | **Release Authority** | Communicate freeze state | Written comms log | **Governance Lead** | **OPEN — evidence MISSING** |

---

## Cross-links

- `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`  
- `C2C_STAGE1_DRYRUN_GO_NO_GO_RECORD.md`  
- `C2C_EVIDENCE_GAP_TRACKER.md`  
- `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`
