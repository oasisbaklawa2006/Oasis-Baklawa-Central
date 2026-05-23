# C2C — Governance signoff workflow

**Purpose:** Define **order**, **approvers**, **veto**, and **dependencies** so GO decisions are defensible. **Process only** — not live workflow automation.

---

## Rules (non-negotiable)

1. **Missing evidence = automatic NO-GO.**  
2. **Unclear rollback = automatic NO-GO.**  
3. **Shared production/staging resources (keys, queues, URLs, operators) = automatic NO-GO.**

---

## Review order (mandatory)

1. **Security** — JWT/replay/egress/secrets handling.  
2. **Ops / SRE** — rollback, kill switch, observability, on-call.  
3. **Tech lead** — architecture fit, flag defaults, CI guards.  
4. **Product / CX** — customer-visible risk and comms (before any real send).  
5. **Finance delegate** — only when scope touches money movement.

No step may be skipped by “parallelizing” signoff without **all** final signatures present.

---

## Required approvers (by decision class)

| Decision | Approvers (all required unless waived in writing) |
|----------|-----------------------------------------------------|
| Staging dry-run **execution** | Security + Ops + Tech lead |
| Staging sandbox sends | + Product |
| Production pilot | + Executive sponsor + Finance (if applicable) |
| Emergency stop / re-freeze | Security **or** Ops **or** Executive (any one triggers stop; retro consensus) |

---

## Veto authority

- **Security** may veto on ingress, replay, or isolation gaps.  
- **Ops** may veto on rollback/observability gaps.  
- **Finance** may veto any scope touching wallets without SoD proof.  
- **Product** may veto customer comms readiness for real sends.

Veto must be **written** with reason; status = **NO-GO** until resolved.

---

## Freeze escalation path

1. Incident or tabletop finds P0 gap.  
2. **Executor** (Ops or Security) applies emergency stop per `C2C_EXECUTION_FREEZE_MANIFEST.md`.  
3. Notify Tech lead + Executive within **1 hour** (org SLA).  
4. Update risk register + evidence template version.

---

## Emergency stop authority

- **Ops** and **Security** and **Executive sponsor** may invoke stop for pilot-class execution.  
- Stop does **not** require consensus **before** acting when active customer harm is suspected.

---

## Evidence attachment order

1. `manifest.json` with metadata (`C2C_EVIDENCE_ARTIFACT_STANDARD.md`).  
2. Logs / traces (redacted).  
3. Rollback drill log.  
4. Approvals PDF / ticket links.  
5. Optional screenshots last (lowest evidentiary weight).

---

## Mandatory signoff sequence

1. Security signs **only after** replay + JWT sections complete.  
2. Ops signs **only after** rollback + observability sections complete.  
3. Tech lead signs **only after** code SHA and scope match.  
4. Executive signs **only after** all prior signatures and **no open P0** risks.

---

## No-self-approval rule

- An engineer **cannot** approve their own implementation PR for C2C execution surfaces.  
- **Two distinct senior** signatories required for production pilot (see approval model).

---

## Replay review dependency

- Security signoff **blocked** until replay test logs attached or waived in writing with compensating manual procedure (rare).

---

## Rollback dependency

- Ops signoff **blocked** until dated rollback drill log attached or explicit waiver with alternative control (extremely rare).

---

## Observability dependency

- Ops signoff **blocked** until dashboard/query pack links exist for duplicate-send and auth failure signals.

---

## Cross-links

- `C2C_GOVERNANCE_APPROVAL_MODEL.md`  
- `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`  
- `C2C_SAMPLE_EVIDENCE_BUNDLE_TEMPLATE.md`
