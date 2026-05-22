# C2C — Pre-implementation authority checklist

**Use:** Tick only with **evidence links** (PR, ticket, run log, dashboard snapshot). Doc-only sprint does not satisfy items.

---

## 1. Before ANY staging writes

- [ ] Authority review signed (`docs/C2C_LIVE_AUTHORITY_SURFACE_AUDIT.md` findings addressed or risk-accepted in writing).  
- [ ] Contract reconciliation approved (`docs/C2C_EDGE_CONTRACT_RECONCILIATION.md`).  
- [ ] Operator matrix aligned with roles (`docs/C2C_OPERATOR_AUTHORITY_MATRIX.md`).  
- [ ] Staging project / URL isolation documented.  
- [ ] Pilot cohort allowlist defined (named users).

---

## 2. Before ANY production writes

- [ ] All staging-write checklist sections **green** with 30-day evidence window (org-defined).  
- [ ] `verify_jwt` posture **true** for user-invokable mutating functions **or** equivalent control documented and tested.  
- [ ] RLS / ownership tests pass for every mutating path.  
- [ ] Executive / security risk acceptance recorded.

---

## 3. Before ANY queue automation

- [ ] Idempotency + dedupe design reviewed.  
- [ ] DLQ + replay harness exists.  
- [ ] Human override precedence documented and tested (`docs/C2C_MASTER_AUTHORITY_AND_WRITE_SAFETY_BLUEPRINT.md`).  
- [ ] Cost caps and rate limits for provider APIs.

---

## 4. Before ANY retry system

- [ ] Retry classification (transient vs permanent) (`docs/C2C_WRITE_OBSERVABILITY_REQUIREMENTS.md` §9).  
- [ ] Max attempts + jitter policy.  
- [ ] Duplicate-send detector **zero** in staging stress tests.

---

## 5. Before ANY TOOL 5 authority

- [ ] Immutable audit live for pilot mutations.  
- [ ] Break-glass procedure for supervisor override (`docs/C2C_ROLLBACK_AND_RECOVERY_STRATEGY.md`).  
- [ ] Conflict UX for stale versions.

---

## 6. Before ANY bulk actions

- [ ] Rate limits + batch size caps.  
- [ ] Per-row audit or batch audit with expansion list hash.  
- [ ] Supervisor gate for cross-team bulk.

---

## 7. Before ANY finance-triggered action

- [ ] Finance dual-control policy (if required).  
- [ ] PII minimization in messages.  
- [ ] Segregation from operator WhatsApp paths unless explicitly merged in CR.

---

## 8. Before ANY packet ownership enforcement

- [ ] Data model for ownership / claims agreed.  
- [ ] Migration plan **separate CR** (outside doc-only freeze).  
- [ ] Negative tests for cross-tenant access.

---

## 9. Rollback validation checklist

- [ ] Feature flag OFF stops new writes within **SLO** (e.g. &lt; 1 min).  
- [ ] No audit deletion required for rollback.  
- [ ] Tabletop exercised with on-call.

---

## 10. Observability checklist

- [ ] Dashboards from `docs/C2C_WRITE_OBSERVABILITY_REQUIREMENTS.md` §11 live in staging.  
- [ ] Alerts from §12 tuned to baseline.  
- [ ] `audit_vs_attempts` reconciliation job green.

---

## 11. JWT checklist

- [ ] `config.toml` / dashboard **matches** deployed `verify_jwt` for each function.  
- [ ] User JWT parsed; `sub` recorded on every attempt.  
- [ ] Service-only functions not callable from browser (network / secret header verified).

---

## 12. Audit checklist

- [ ] Append-only permissions verified (UPDATE/DELETE denied on audit rows).  
- [ ] Compensating entry pattern documented.  
- [ ] Retention + PII policy signed.

---

## 13. Freeze conditions checklist (re-apply freeze if)

- [ ] Duplicate customer send in staging.  
- [ ] Missing audit row for known attempt.  
- [ ] Auth anomaly spike unresolved &gt; 24h.  
- [ ] Replay divergence in harness.

When any triggers, **halt pilot** and return to dependency graph upstream node until fixed (`docs/C2C_STAGING_PILOT_DEPENDENCY_GRAPH.md`).
