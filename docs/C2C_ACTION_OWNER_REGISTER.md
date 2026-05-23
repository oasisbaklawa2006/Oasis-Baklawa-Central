# C2C — Action owner register (placeholders)

**Purpose:** Assign **named** owners for evidence production and approvals. Replace all `________________` with real people in your organization. Until filled, **NO-GO** defaults remain.

---

## 1. Governance owners

| Area | Named owner placeholder | Backup placeholder | Responsibility | Required evidence | Approval authority Y/N | Current status |
|------|-------------------------|--------------------|----------------|-------------------|-------------------------|----------------|
| Program chair | `________________` | `________________` | Maintains doc index + freeze comms | Signed minutes | **Y** | **UNFILLED** |
| Doc merge gate | `________________` | `________________` | Ensures docs-only PRs stay clean | PR checklist | **N** | **UNFILLED** |

---

## 2. Engineering owners

| Area | Named owner placeholder | Backup placeholder | Responsibility | Required evidence | Approval authority Y/N | Current status |
|------|-------------------------|--------------------|----------------|-------------------|-------------------------|----------------|
| Implementation readiness | `________________` | `________________` | Owns future implementation PR scope | Design + tests plan | **N** | **UNFILLED** |
| Type/scaffold hygiene | `________________` | `________________` | Keeps flags unwired until GO | CI grep / review | **N** | **UNFILLED** |

---

## 3. Security / JWT owners

| Area | Named owner placeholder | Backup placeholder | Responsibility | Required evidence | Approval authority Y/N | Current status |
|------|-------------------------|--------------------|----------------|-------------------|-------------------------|----------------|
| Ingress / JWT | `________________` | `________________` | JWT matrix + replay tests | Curl logs, threat review | **Y** | **UNFILLED** |
| Veto authority | `________________` | `________________` | Exercise veto if gap found | Written veto record | **Y** | **UNFILLED** |

---

## 4. Staging environment owners

| Area | Named owner placeholder | Backup placeholder | Responsibility | Required evidence | Approval authority Y/N | Current status |
|------|-------------------------|--------------------|----------------|-------------------|-------------------------|----------------|
| Staging project | `________________` | `________________` | Key rotation, isolation | Fingerprint doc | **Y** | **UNFILLED** |
| Egress / denylist | `________________` | `________________` | Block prod providers | Config export | **Y** | **UNFILLED** |

---

## 5. Observability owners

| Area | Named owner placeholder | Backup placeholder | Responsibility | Required evidence | Approval authority Y/N | Current status |
|------|-------------------------|--------------------|----------------|-------------------|-------------------------|----------------|
| Dashboards | `________________` | `________________` | Pilot metrics tiles | URLs + query defs | **N** | **UNFILLED** |
| Alerts | `________________` | `________________` | P0 alert routes | Page test ticket | **Y** | **UNFILLED** |

---

## 6. Rollback owners

| Area | Named owner placeholder | Backup placeholder | Responsibility | Required evidence | Approval authority Y/N | Current status |
|------|-------------------------|--------------------|----------------|-------------------|-------------------------|----------------|
| Kill switch | `________________` | `________________` | Run drills | Drill logs | **Y** | **UNFILLED** |
| Runbooks | `________________` | `________________` | Maintain rollback SOP | Versioned runbook link | **N** | **UNFILLED** |

---

## 7. Audit owners

| Area | Named owner placeholder | Backup placeholder | Responsibility | Required evidence | Approval authority Y/N | Current status |
|------|-------------------------|--------------------|----------------|-------------------|-------------------------|----------------|
| Audit chain | `________________` | `________________` | Ensure append-only | Audit export | **Y** (finance-adjacent) | **UNFILLED** |

---

## 8. Approval owners

| Area | Named owner placeholder | Backup placeholder | Responsibility | Required evidence | Approval authority Y/N | Current status |
|------|-------------------------|--------------------|----------------|-------------------|-------------------------|----------------|
| Staging GO | `________________` | `________________` | Sign GO checklist | Signed bundle | **Y** | **UNFILLED** |
| Executive (prod pilot) | `________________` | `________________` | Final prod pilot | Full bundle | **Y** | **UNFILLED** |

---

## 9. Emergency freeze owners

| Area | Named owner placeholder | Backup placeholder | Responsibility | Required evidence | Approval authority Y/N | Current status |
|------|-------------------------|--------------------|----------------|-------------------|-------------------------|----------------|
| Stop-the-line | `________________` | `________________` | Invoke emergency stop | Incident id | **Y** | **UNFILLED** |

---

## Cross-links

- `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`  
- `C2C_STAGE1_DRYRUN_GO_NO_GO_RECORD.md`  
- `C2C_EVIDENCE_GAP_TRACKER.md`
