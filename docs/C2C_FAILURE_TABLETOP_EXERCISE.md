# C2C — Failure tabletop exercise (12 scenarios)

**Purpose:** Paper simulation of failures **without** executing attacks or load tests. Use in a room with Security, Ops, Tech lead, and Product as needed.

---

## 1. Duplicate replay

| Field | Content |
|-------|---------|
| Simulated symptom | Same HTTP body replayed twice; two logical sends appear in customer thread. |
| Hypothetical blast radius | Reputational harm; refund pressure. |
| Freeze response | **Re-freeze** staging execution; halt pilot. |
| Rollback expectation | Kill switch OFF; reconcile duplicate rows. |
| Evidence required | Idempotency test logs; correlation ids for both attempts. |
| Production blocker? | **Y** until proven duplicate-suppressed. |
| Unresolved risk? | Missing server-side dedupe store. |

---

## 2. Stale queue snapshot

| Field | Content |
|-------|---------|
| Simulated symptom | UI shows `depth=0` while worker processed a hidden backlog. |
| Hypothetical blast radius | Operator double-submits “fix” actions. |
| Freeze response | Stop UI actions relying on snapshot; force refresh policy. |
| Rollback expectation | Disable action buttons server-side until fresh snapshot token. |
| Evidence required | Versioned snapshot id in API; mismatch logs. |
| Production blocker? | **Y** for concurrent operator execute. |
| Unresolved risk? | Client-only queue depth trust. |

---

## 3. JWT mismatch

| Field | Content |
|-------|---------|
| Simulated symptom | Body `operator_id` does not match JWT `sub`. |
| Hypothetical blast radius | Spoofed operator actions. |
| Freeze response | Reject request at edge; alert Security. |
| Rollback expectation | No mutation applied; incident ticket. |
| Evidence required | Negative test matrix; audit of rejects. |
| Production blocker? | **Y** for any execute path. |
| Unresolved risk? | `verify_jwt=false` without compensating control. |

---

## 4. Unauthorized operator

| Field | Content |
|-------|---------|
| Simulated symptom | Role `guest` obtains send endpoint URL. |
| Hypothetical blast radius | Spam or data exfiltration. |
| Freeze response | Block IP / rotate keys; re-freeze. |
| Rollback expectation | Revoke tokens; audit scope of access. |
| Evidence required | RBAC negative tests; WAF logs. |
| Production blocker? | **Y**. |
| Unresolved risk? | Broad anonymous ingress. |

---

## 5. Replay collision

| Field | Content |
|-------|---------|
| Simulated symptom | Two different operators reuse same idempotency key namespace. |
| Hypothetical blast radius | Suppressed legitimate second action. |
| Freeze response | Namespace keys per operator + packet (design). |
| Rollback expectation | Manual replay with new key after human approval. |
| Evidence required | Key composition doc + tests. |
| Production blocker? | **Y** if collisions reproducible. |
| Unresolved risk? | Global idempotency key without tenant prefix. |

---

## 6. Audit loss

| Field | Content |
|-------|---------|
| Simulated symptom | Send succeeded; audit insert failed silently. |
| Hypothetical blast radius | Non-repudiation loss; disputes. |
| Freeze response | Halt sends; circuit breaker to audit-down. |
| Rollback expectation | Compensating customer comms per playbook. |
| Evidence required | Transactional outbox design + failure injection logs. |
| Production blocker? | **Y** when audit is legal evidence. |
| Unresolved risk? | Best-effort client-side audit only. |

---

## 7. Rollback failure

| Field | Content |
|-------|---------|
| Simulated symptom | Kill switch flipped; traffic continues 10 minutes. |
| Hypothetical blast radius | Ongoing customer harm. |
| Freeze response | Emergency infra block (WAF / DNS) per runbook. |
| Rollback expectation | Second-line rollback completes; postmortem. |
| Evidence required | Timed drill failure record; root cause. |
| Production blocker? | **Y** — no pilot until drill passes. |
| Unresolved risk? | Kill switch not wired to actual ingress. |

---

## 8. Delayed observability

| Field | Content |
|-------|---------|
| Simulated symptom | Duplicate sends for 30 minutes before dashboard updates. |
| Hypothetical blast radius | Large blast radius before detection. |
| Freeze response | Reduce pilot rate to zero; fix pipeline lag. |
| Rollback expectation | Same as kill switch. |
| Evidence required | SLO on ingestion lag; alert on lag itself. |
| Production blocker? | **Y** for customer-visible pilot. |
| Unresolved risk? | Batch-only metrics without streaming alerts. |

---

## 9. Queue resurrection

| Field | Content |
|-------|---------|
| Simulated symptom | “Disabled” queue resumes after deploy due to default flag change. |
| Hypothetical blast radius | Surprise sends overnight. |
| Freeze response | CI guard on flag defaults; revert deploy. |
| Rollback expectation | Pin previous release; audit flag diff. |
| Evidence required | Config diff in CI; deploy checklist. |
| Production blocker? | **Y**. |
| Unresolved risk? | Feature flag in code defaults to ON in new module. |

---

## 10. Retry storm

| Field | Content |
|-------|---------|
| Simulated symptom | 429 from provider; client backoff missing; exponential unbounded retries. |
| Hypothetical blast radius | Ban + cost. |
| Freeze response | Disable retry worker globally. |
| Rollback expectation | Cap + jitter enforced; DLQ drain. |
| Evidence required | Chaos test with max attempts hit. |
| Production blocker? | **Y** for automation. |
| Unresolved risk? | Client-side retry loops on `invoke`. |

---

## 11. Stale UI authority

| Field | Content |
|-------|---------|
| Simulated symptom | Operator acts on packet closed 10 minutes ago; UI never refreshed. |
| Hypothetical blast radius | Wrong-thread message. |
| Freeze response | Server rejects stale version; UI forces refresh. |
| Rollback expectation | N/A if server rejects. |
| Evidence required | Version conflict tests. |
| Production blocker? | **Y** for execute without version check. |
| Unresolved risk? | Optimistic UI without server version. |

---

## 12. Partial dispatch simulation

| Field | Content |
|-------|---------|
| Simulated symptom | Dispatch status updated; finance gate not cleared — inconsistent state. |
| Hypothetical blast radius | Wrong shipment / compliance exposure. |
| Freeze response | Finance + Ops joint freeze on dispatch mutations. |
| Rollback expectation | Serializable transaction or saga compensations. |
| Evidence required | Integration test proving impossible state unreachable. |
| Production blocker? | **Y** when scope couples dispatch + finance. |
| Unresolved risk? | Split updates across services without saga. |

---

## Cross-links

- `C2C_FAILURE_SCENARIO_TABLETOP.md` (if present)  
- `C2C_SAMPLE_EVIDENCE_BUNDLE_TEMPLATE.md`  
- `C2C_ARCHITECTURAL_RISK_REGISTER.md`
