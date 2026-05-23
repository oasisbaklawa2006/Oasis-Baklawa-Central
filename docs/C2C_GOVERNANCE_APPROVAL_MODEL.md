# C2C — Governance approval model

**Purpose:** Define **who may approve what** and **how veto / ordering** works for C2C execution and design gates. **Process template** — assign named people in your org outside this file.

---

## Roles (assign names in org roster)

| Role | Typical org seat |
|------|------------------|
| **Doc owner** | Staff engineer or tech lead |
| **Security reviewer** | Application security or designated engineer |
| **Ops / SRE** | On-call owner for messaging infra |
| **Product / CX** | Customer impact owner |
| **Finance delegate** | When finance isolation or money-adjacent scope |
| **Executive sponsor** | Final escalation for waivers |

---

## Who can approve what

| Decision | Approvers (all must sign unless noted) |
|----------|----------------------------------------|
| **Docs** (governance markdown in repo) | Doc owner + one peer reviewer (two-person for merge policy per org) |
| **Staging dry-run pilot execution** | Doc owner + Security + Ops + **GO checklist** complete |
| **Replay design** (idempotency + dedupe spec) | Doc owner + Security |
| **JWT hardening plan** (per-function ingress) | Security + Doc owner |
| **Rollback validation** (drill sign-off) | Ops + Doc owner |
| **Staging real-send (sandbox) pilot** | Security + Ops + Product + Doc owner + updated acceptance criteria |
| **Production pilot** | Executive sponsor + Security + Finance delegate (if applicable) + Doc owner |
| **Emergency re-freeze** | **Any** of: Security, Ops, Executive sponsor — **immediate**; retroactive consensus within 24h |

---

## Evidence required for approval

| Approval | Evidence bundle |
|----------|-----------------|
| Staging execution | `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md` PASS + isolation charter + observability URLs |
| Replay design | Threat scenarios + test logs + dedupe schema |
| JWT hardening | Matrix + curl tests + rollback of config |
| Rollback validation | Timestamped drill log |
| Production pilot | Staging soak + scorecard + risk register + game-day logs |

---

## Veto conditions

Any approver may **veto** (block) if:

- **P0** evidence missing for their domain (e.g. Security: JWT proof absent).
- **Isolation** breach suspected or unverified.
- **Legal / privacy** concern raised for real sends or PII logging.

**Veto** must be **written** with reason; block stands until resolved.

---

## Mandatory review order

1. **Security** — ingress, replay, secrets handling  
2. **Ops** — rollback, observability, kill switch  
3. **Doc owner** — coherence with manifests and roadmaps  
4. **Product** — customer impact and comms readiness (before any real send)  
5. **Finance delegate** — only when scope touches money movement  

*Order ensures security and operability are not last-minute rubber stamps.*

---

## No-single-person escalation rule

- **No** production pilot or production rollout approval on a **single** approver’s signature.
- **TOOL 5** and **finance-bound** stages require **at least two** independent senior approvers (e.g. Security + Finance for finance scope).

---

## Production freeze override rules

Overrides to `C2C_EXECUTION_FREEZE_MANIFEST.md` / production freeze are **extraordinary**:

| Requirement | Detail |
|-------------|--------|
| Author | Executive sponsor only |
| Written | Incident number, scope, time box, rollback owner |
| Security | Must acknowledge in writing |
| Sunset | Auto-expire; post-incident review mandatory |

**Hotfix** production code for **unrelated** outage may proceed under **separate** org change policy — must **not** expand C2C authority silently.

---

## Cross-links

- `C2C_EXECUTION_FREEZE_MANIFEST.md`
- `C2C_PRE_IMPLEMENTATION_EVIDENCE_REQUIREMENTS.md`
- `C2C_NOT_READY_FOR_PRODUCTION_SUMMARY.md`
