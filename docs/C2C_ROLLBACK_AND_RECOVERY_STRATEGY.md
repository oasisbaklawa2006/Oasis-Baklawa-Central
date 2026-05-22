# C2C — Rollback and recovery strategy

**Scope:** Staging-first; principles apply to production **only after** production writes are explicitly approved. **No implementation** in this document.

---

## 1. Rollback triggers

| Trigger | Example | Default response |
|---------|---------|------------------|
| **Security signal** | Spike in 401/403, suspected IDOR exploit | Kill switch ON for pilot mutations |
| **Duplicate customer effect** | Two provider message ids for one idempotency key | Halt pilot; preserve audit; incident |
| **Audit append failure** | DB permission or disk full | Abort new mutations; page on-call |
| **Data divergence** | Post-write verification fails consistently | Freeze writes; snapshot DB for analysis |
| **Policy breach** | Automation sends without human gate | Disable automation flag only |

---

## 2. Shadow-mode rollback

| Aspect | Behavior |
|--------|----------|
| **What rolls back** | Nothing persisted except logs — disable shadow emitter. |
| **Risk** | False confidence if shadow code diverges from real path — require shared core library or contract tests. |
| **Audit** | Shadow decisions logged as `shadow_only` outcome; never counted as production mutations. |

---

## 3. Feature-flag shutdown

| Aspect | Behavior |
|--------|----------|
| **Mechanism** | Per-action flags (reassign, route_override, ack, priority, escalation). |
| **Ordering** | Disable **ingress** (Edge) before disabling **egress** (workers) to avoid half-open states. |
| **UI** | Hide or disable controls; show banner “pilot paused.” |

---

## 4. Queue freeze

| Aspect | Behavior |
|--------|----------|
| **Pilot stance** | Queues excluded from v1 unless separately approved — “freeze” = **no producers started**. |
| **If queue exists later** | Stop enqueue; drain workers; **do not** delete in-flight audit; DLQ inspection. |

---

## 5. Replay isolation

| Aspect | Behavior |
|--------|----------|
| **Goal** | Replays run in **isolated** DB clone or dedicated schema; never against prod. |
| **Data** | Anonymized fixtures where possible. |
| **Outcome** | Replay report artifact stored with pilot sign-off package. |

---

## 6. Operator lockout procedure

| Step | Action |
|------|--------|
| 1 | Revoke pilot cohort role flag in IdP / profile table (process-owned). |
| 2 | Invalidate sessions if compromise suspected (security runbook). |
| 3 | Edge deny with `pilot_suspended` code; UI message. |
| 4 | Audit `lockout_applied` with actor (security admin). |

---

## 7. Audit preservation rules

| Rule | Rationale |
|------|-----------|
| **Never DELETE audit rows** | Forensics and compliance. |
| **No in-place UPDATE of meaning-bearing fields** | Tamper evidence. |
| **Compensating entries** | If business reversal needed, append `REVERSAL_OF` correlation to original id. |
| **Export to SIEM** | Optional; must preserve immutability in primary store. |

---

## 8. Incident review requirements

Within **24h** (org SLA may adjust):

- Timeline from logs (JWT subject, packet ids, correlation ids).  
- Blast radius assessment (customer messages, internal rows).  
- Root cause category (auth, RLS, idempotency, UX race, provider).  
- Corrective actions: code, config, policy, training.  
- Go / no-go for pilot resume.

---

## 9. Recovery checklist

- [ ] Kill switches verified OFF → ON → OFF drill post-fix.  
- [ ] Audit reconciliation job shows zero gaps for incident window.  
- [ ] Replay harness passes on fixed build.  
- [ ] Security sign-off on residual risk.  
- [ ] Ops sign-off on comms / customer impact (staging N/A for customer).  

---

## 10. Production re-enable criteria

**None of this applies while production remains frozen.** When policy allows production mutation:

| Criterion | Evidence |
|-----------|----------|
| Staging pilot success | Report per `docs/C2C_STAGING_WRITE_PILOT_MASTER_PLAN.md` §7 |
| Audit in prod | Append-only verified in prod-like permissions |
| Dashboards live | Per observability doc |
| Rollback rehearsed | Tabletop + technical |
| Executive risk acceptance | Signed memo or ticket |
