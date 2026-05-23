# C2C — Stage 1 owner assignment worksheet

**Purpose:** Assign **named** owners and backups for evidence production. **Worksheet only** — does not grant authority or change runtime.

---

## 1. Governance owner

| Role | Named owner | Backup owner | Required evidence | Due date | Status | Blocker if missing |
|------|-------------|--------------|-------------------|----------|--------|--------------------|
| Governance / program | `________________` | `________________` | Signed tabletop + gap tracker updates | `YYYY-MM-DD` | **UNFILLED** | No accountable signoff path |

---

## 2. Engineering owner

| Role | Named owner | Backup owner | Required evidence | Due date | Status | Blocker if missing |
|------|-------------|--------------|-------------------|----------|--------|--------------------|
| Stage 1 implementation readiness | `________________` | `________________` | Idempotency, duplicate-send, no-send traces | `YYYY-MM-DD` | **UNFILLED** | Cannot prove safe dry-run path |

---

## 3. Security / JWT owner

| Role | Named owner | Backup owner | Required evidence | Due date | Status | Blocker if missing |
|------|-------------|--------------|-------------------|----------|--------|--------------------|
| Auth / replay / operator | `________________` | `________________` | JWT matrix, replay logs, operator negative tests | `YYYY-MM-DD` | **UNFILLED** | Automatic NO-GO per workflow |

---

## 4. Staging environment owner

| Role | Named owner | Backup owner | Required evidence | Due date | Status | Blocker if missing |
|------|-------------|--------------|-------------------|----------|--------|--------------------|
| Isolation / config | `________________` | `________________` | Isolation proof packet | `YYYY-MM-DD` | **UNFILLED** | Staging execution blocked |

---

## 5. Observability owner

| Role | Named owner | Backup owner | Required evidence | Due date | Status | Blocker if missing |
|------|-------------|--------------|-------------------|----------|--------|--------------------|
| Metrics / dashboards / alerts | `________________` | `________________` | Observability + alert proof packets | `YYYY-MM-DD` | **UNFILLED** | Ops veto risk |

---

## 6. Rollback owner

| Role | Named owner | Backup owner | Required evidence | Due date | Status | Blocker if missing |
|------|-------------|--------------|-------------------|----------|--------|--------------------|
| Kill switch / rollback | `________________` | `________________` | Rollback + kill-switch proof packets | `YYYY-MM-DD` | **UNFILLED** | Automatic NO-GO |

---

## 7. Audit owner

| Role | Named owner | Backup owner | Required evidence | Due date | Status | Blocker if missing |
|------|-------------|--------------|-------------------|----------|--------|--------------------|
| Audit chain | `________________` | `________________` | Audit proof packet | `YYYY-MM-DD` | **UNFILLED** | Finance / compliance gate |

---

## 8. Approval owner

| Role | Named owner | Backup owner | Required evidence | Due date | Status | Blocker if missing |
|------|-------------|--------------|-------------------|----------|--------|--------------------|
| Final GO binder | `________________` | `________________` | Signed approvals PDF / tickets | `YYYY-MM-DD` | **UNFILLED** | NO-GO remains |

---

## 9. Emergency freeze owner

| Role | Named owner | Backup owner | Required evidence | Due date | Status | Blocker if missing |
|------|-------------|--------------|-------------------|----------|--------|--------------------|
| Stop-the-line authority | `________________` | `________________` | Written re-freeze runbook acknowledgment | `YYYY-MM-DD` | **UNFILLED** | Unclear incident command |
