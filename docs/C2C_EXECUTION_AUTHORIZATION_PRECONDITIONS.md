# C2C — Execution authorization preconditions

**Purpose:** Exact **preconditions** before classes of runtime work. Missing any listed item for that class ⇒ **automatic NO-GO** until remediated (see also `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`).

---

## Before ANY staging runtime work (dry-run worker, mock pipeline, wired flags)

| Precondition | Required approvals | Required evidence | Required tests | Rollback proof | Observability proof | Isolation proof | Auto NO-GO if missing |
|--------------|---------------------|-------------------|----------------|----------------|---------------------|-----------------|----------------------|
| G1 | Security + Ops + Tech lead | GO checklist PASS; isolation sign-off | CI unit tests for new modules only | Kill switch drill in **staging** | Staging dashboard live | Staging project fingerprint | **Any** shared prod credential |
| G2 | Same | Evidence bundle skeleton → real bundle id | Replay + idempotency tests green | Documented SLO met | Alert on duplicate-send metric | Denylist egress proof | Unclear rollback |

---

## Before ANY queue work

| Precondition | Required approvals | Required evidence | Required tests | Rollback proof | Observability proof | Isolation proof | Auto NO-GO if missing |
|--------------|---------------------|-------------------|----------------|----------------|---------------------|-----------------|----------------------|
| Q1 | Ops + Security + Tech lead | Lease / `SKIP LOCKED` design + logs | Two-consumer test | Stop worker + drain | Queue depth + DLQ metrics | Queue name prefix ≠ prod | Browser-only processor plan |

---

## Before ANY retry work

| Precondition | Required approvals | Required evidence | Required tests | Rollback proof | Observability proof | Isolation proof | Auto NO-GO if missing |
|--------------|---------------------|-------------------|----------------|----------------|---------------------|-----------------|----------------------|
| R1 | Security + Tech lead | Retry classification matrix | Chaos 429 test | Retry master OFF | Storm rate metric | N/A | Unbounded client retry loop |

---

## Before ANY resend work

| Precondition | Required approvals | Required evidence | Required tests | Rollback proof | Observability proof | Isolation proof | Auto NO-GO if missing |
|--------------|---------------------|-------------------|----------------|----------------|---------------------|-----------------|----------------------|
| S1 | Security + Product + Tech lead | Idempotency key on resend path | Double-click test | Disable resend server gate | Duplicate metric | Sandbox allowlist | Resend without dedupe key |

---

## Before ANY TOOL 5 work

| Precondition | Required approvals | Required evidence | Required tests | Rollback proof | Observability proof | Isolation proof | Auto NO-GO if missing |
|--------------|---------------------|-------------------|----------------|----------------|---------------------|-----------------|----------------------|
| T1 | Executive + Security + domain owner | **Separate charter** + threat review | Red-team scenarios | Token revoke drill | Override audit stream | Dedicated audit store | Charter absent |

---

## Before ANY finance write

| Precondition | Required approvals | Required evidence | Required tests | Rollback proof | Observability proof | Isolation proof | Auto NO-GO if missing |
|--------------|---------------------|-------------------|----------------|----------------|---------------------|-----------------|----------------------|
| F1 | Finance + Executive + Security | SoD + locks + idempotency | Property tests on balances | Finance freeze playbook | Reconciliation dashboard | No staging→prod DB link | Single approver |

---

## Before ANY dispatch write

| Precondition | Required approvals | Required evidence | Required tests | Rollback proof | Observability proof | Isolation proof | Auto NO-GO if missing |
|--------------|---------------------|-------------------|----------------|----------------|---------------------|-----------------|----------------------|
| D1 | Ops + Compliance (if req.) + Executive | Saga or txn design | Integration with logistics sandbox | Status rollback + audit | Dispatch anomaly alert | No prod logistics API in staging | Chat-triggered dispatch |

---

## Before ANY production pilot

| Precondition | Required approvals | Required evidence | Required tests | Rollback proof | Observability proof | Isolation proof | Auto NO-GO if missing |
|--------------|---------------------|-------------------|----------------|----------------|---------------------|-----------------|----------------------|
| P1 | Executive + Security + Finance (if applicable) | Full bundle per `C2C_EVIDENCE_ARTIFACT_STANDARD.md` | Staging soak + game-day | Prod kill switch drill | Live prod dashboards | Prod keys only in prod vault | Any open P0 risk without waiver |

---

## Automatic NO-GO conditions (summary)

- Missing evidence bundle for the declared scope.  
- Unclear or untested rollback.  
- Shared production/staging resources (keys, queues, URLs, operators).  
- Missing correlation IDs for customer-visible scope.  
- Self-approval or skipped mandatory reviewer.

---

## Cross-links

- `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`  
- `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`  
- `C2C_CURRENT_SAFE_BOUNDARY.md`
