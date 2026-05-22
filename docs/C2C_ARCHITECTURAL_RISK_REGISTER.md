# C2C — Architectural risk register

**Purpose:** Track **architectural** risks for C2C / WhatsApp / authority program. **Not** a full corporate risk register. Update on merge, pilot scope change, or incident.

**Columns:** Risk · Severity · Likelihood · Current mitigation · Missing mitigation · Production blocker · Owner · Status

**Status values:** `Open` · `Mitigated` · `Accepted` · `Wontfix (out of scope)`

**Owner:** Assign in working session — placeholder `TBD` where unknown.

---

## Register

| Risk | Severity | Likelihood | Current mitigation | Missing mitigation | Production blocker | Owner | Status |
|------|----------|------------|--------------------|--------------------|--------------------|-------|--------|
| Replay attacks on `verify_jwt=false` Edge | Critical | Medium | URL obscurity; platform network controls (ops-dependent) | JWT verify or HMAC per function; rate limits | Y | TBD | Open |
| Stale packet ownership | High | Medium | UI loads packet from DB; suggest-only flows reduce write races | Server coherence checks; version/lock | Y | TBD | Open |
| Audit divergence (audit says X, DB says Y) | High | Low–Med | Partial client/Edge `audit_logs` inserts | Transactional audit pattern; reconciliation job | Y (if audit is legal evidence) | TBD | Open |
| Duplicate send (operator / admin) | High | Medium | Button disabling; single-tab guards | Idempotency keys + dedupe store | Y | TBD | Open |
| Queue replay (outbox / workers) | High | Medium | Status flip after successful send-email invoke | Row lease; single consumer; DLQ | Y | TBD | Open |
| JWT bypass (anonymous invoke) | Critical | Low–Med | Some functions not in explicit JWT-off list may default verify | Per-function proof; remove service-role trust on anon path | Y | TBD | Open |
| Operator spoofing (`operator_id` body) | High | Med–High | Trusted operators + network | Verified JWT binding; reject mismatched body | Y | TBD | Open |
| Finance escalation abuse | Critical | Low | RLS + admin-only surfaces | Idempotency; locks; SoD review | Y | TBD | Open |
| Optimistic UI mismatch | Medium | Medium | Alerts; refresh on success | Pending states; single safe retry | N alone | TBD | Open |
| Realtime ordering drift | Medium | High | Debounced full reload | Version banners; conflict modals on write | N for read-only | TBD | Open |
| Retry storms | High | Medium | Provider fallback bounded per call | Worker backoff + global cap | Y for automation | TBD | Open |
| Rollback gaps | High | Medium | Informal revert | Kill switch + timed drill evidence | Y | TBD | Open |
| Stale websocket state | Medium | High | Resubscribe backoff (`useStableSubscription`) | Authoritative version before send | N if sends blocked | TBD | Open |
| Migration drift (schema vs code) | High | Medium | Freeze during governance phase | CI schema diff; migration review on thaw | Y post-thaw | TBD | Open |
| Service-role misuse in Edge | Critical | Medium | Code review; least privilege intent | Narrow policies; split anon vs user paths | Y | TBD | Open |
| Cross-tenant exposure | Critical | Low | RLS on tenant tables | Tests for negative cross-tenant paths | Y | TBD | Open |
| localStorage trust leakage | Medium | Low | UX-only data in operator prefs | Ensure secrets never stored; document trust boundary | N | TBD | Open |

---

## Review cadence

- **Monthly** in quiet periods; **weekly** during active pilot; **immediate** update after incident or scope change.

---

## Cross-links

- `C2C_WRITE_PATH_THREAT_MODEL.md`
- `C2C_FAILURE_SCENARIO_TABLETOP.md` (when present)
- `C2C_EXECUTIVE_READINESS_SCORECARD.md`
- `C2C_MASTER_GOVERNANCE_INDEX.md`
