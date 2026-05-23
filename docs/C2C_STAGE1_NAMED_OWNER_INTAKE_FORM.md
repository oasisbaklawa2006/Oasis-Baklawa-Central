# C2C — Stage 1 named owner intake form

**Purpose:** Capture **named** individuals bound to **governance roles** for Stage 1 evidence and approvals. **Do not** pre-fill real names in this template PR — program leadership fills via secure process. **Does not** authorize runtime work. **Stage 1 remains NO-GO** until evidence and signoffs exist.

**Related:** `C2C_STAGE1_OWNER_ASSIGNMENT_INSTRUCTIONS.md`, `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`, `C2C_STAGE1_STATUS_TRANSITION_LOG.md`, `C2C_ROLE_SEPARATION_MATRIX.md`.

---

## How to use

Duplicate the **block** under each heading for each appointee. Store **PII-minimized** copies where policy requires; link immutable ticket IDs in the status log when names are confirmed.

---

### 1. Governance Lead

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Governance Lead |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Program governance, freeze comms, binder custody (per charter) |
| **Evidence responsibility** | Roster publication, minutes, index hygiene |
| **Approval authority** | Y / N (circle one after policy review) |
| **Can veto** | Y / N (per escalation ladder) |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 2. Security / JWT Lead

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Security Lead (may differ from Identity/JWT Reviewer — record both if split) |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Security signoff, veto on ingress/replay/isolation |
| **Evidence responsibility** | Co-owns JWT matrix review; security veto records |
| **Approval authority** | Y / N |
| **Can veto** | Y |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 3. Platform Lead

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Platform Lead |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Implementation readiness evidence (idempotency, duplicate-send, no-send traces) |
| **Evidence responsibility** | Produce / custody engineering evidence artifacts |
| **Approval authority** | Y / N (usually N for self-produced evidence) |
| **Can veto** | Y / N |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 4. Staging Operations Lead

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Staging Operations Lead |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Staging isolation, queue posture, no-production-write evidence |
| **Evidence responsibility** | Fingerprints, snapshots, egress exports |
| **Approval authority** | Y / N |
| **Can veto** | Y / N |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 5. Audit Lead

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Audit Lead |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Audit chain evidence, failure injection coordination |
| **Evidence responsibility** | Audit exports, ordering proofs |
| **Approval authority** | Y / N |
| **Can veto** | Y / N |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 6. Observability Lead

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Observability Lead |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Dashboards, metrics, alert routes |
| **Evidence responsibility** | Dashboard captures, alert receipts |
| **Approval authority** | Y / N |
| **Can veto** | Y / N |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 7. Rollback Authority

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Rollback Authority |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Kill-switch drills, rollback SLO, incident halt |
| **Evidence responsibility** | Drill logs, runbook versions |
| **Approval authority** | Y / N |
| **Can veto** | Y / N |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 8. Release Authority

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Release Authority |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | GO binder routing, release hygiene gates |
| **Evidence responsibility** | Custody of signoff pack assembly (not self-approval of own evidence) |
| **Approval authority** | Y |
| **Can veto** | Y / N |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 9. Finance Authority Reviewer

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Finance Authority Reviewer |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Finance-adjacent audit / SoD review |
| **Evidence responsibility** | Finance attestations where required |
| **Approval authority** | Y / N (scope-dependent) |
| **Can veto** | Y |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 10. Dispatch Authority Reviewer

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Dispatch Authority Reviewer |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Dispatch coupling review for dry-run scope |
| **Evidence responsibility** | Dispatch scope notes / approvals |
| **Approval authority** | Y / N |
| **Can veto** | Y |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 11. Emergency Freeze Owner

| Field | Entry |
|-------|-------|
| **Name** | `________________________` |
| **Role** | Emergency freeze delegate (per charter; may mirror Security or Rollback role) |
| **Contact** | `________________________` |
| **Backup** | Name: `________________________` · Contact: `________________________` |
| **Authority scope** | Invoke / record emergency stop-the-line |
| **Evidence responsibility** | Freeze incident ids, written stop records |
| **Approval authority** | Y / N |
| **Can veto** | Y / N |
| **Date assigned** | `____-__-__` |
| **Signature / acknowledgement** | `________________________` · Date: `____-__-__` |

---

### 12. Backup owners (named coverage)

| Primary role | Primary name (filled by org) | Backup name | Backup contact | Date effective | Acknowledgement placeholder |
|--------------|------------------------------|---------------|------------------|----------------|----------------------------|
| Governance Lead | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Security / JWT | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Platform Lead | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Staging Operations Lead | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Audit Lead | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Observability Lead | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Rollback Authority | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Release Authority | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Finance Authority Reviewer | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Dispatch Authority Reviewer | `________________` | `________________` | `________________` | `____-__-__` | `________________` |
| Identity / JWT Reviewer (if distinct from Security Lead) | `________________` | `________________` | `________________` | `____-__-__` | `________________` |

---

**Stage 1 remains NO-GO** until matrix paths, evidence artifacts, and approver signoffs are satisfied — **not** when this form is drafted.
