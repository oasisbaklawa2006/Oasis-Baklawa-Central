# C2C — Evidence gap tracker

**Purpose:** Track **gaps** between governance maturity (docs) and **attachable evidence** required for GO. Update as artifacts land.

---

| Gap | Severity | Current status | Required evidence | Owner placeholder | Target artifact | Blocks staging? | Blocks production? | Notes |
|-----|----------|----------------|-------------------|-------------------|-----------------|-------------------|---------------------|-------|
| Staging isolation proof | **P0** | **MISSING** | Key fingerprint + project id + egress denylist | Ops | `isolation-proof.pdf` | **YES** | **YES** | Auto NO-GO if shared prod resource |
| JWT validation proof | **P0** | **MISSING** | Redacted 401/200 matrix per function | Security | `jwt-matrix.jsonl` | **YES** | **YES** | |
| Operator identity proof | **P0** | **MISSING** | Reject spoofed `operator_id` tests | Security | `operator-auth-tests.log` | **YES** | **YES** | |
| Replay protection proof | **P0** | **MISSING** | Replay within TTL → suppressed | Security | `replay-tests.log` | **YES** | **YES** | |
| Idempotency proof | **P0** | **MISSING** | Dedupe store + double-submit | Tech lead | `idempotency-tests.log` | **YES** | **YES** | |
| Duplicate-send proof | **P0** | **MISSING** | Logical send count = 1 under load | Tech lead | `duplicate-send-soak.csv` | **YES** | **YES** | |
| Rollback proof | **P0** | **MISSING** | Dated drill log ≤ SLO | Ops | `rollback-drill.log` | **YES** | **YES** | |
| Audit proof | **P1** | **MISSING** | Ordered audit ids + failure injection | Audit owner | `audit-chain.json` | **YES** (if audit-gated) | **YES** (finance scope) | |
| Observability proof | **P0** | **MISSING** | Live dashboard + metric defs | Ops | `dashboards.md` | **YES** | **YES** | |
| Alert proof | **P1** | **MISSING** | Page receipt on injected fault | Ops | `alert-test-042.txt` | **YES** | **YES** | |
| Queue-disabled proof | **P1** | **TEMPLATE** | Snapshot `state=disabled` + worker off | Ops | `queue-snapshot.json` | **YES** (if queues in scope) | **N** | Dry-run may stay queueless |
| Production-freeze proof | **P0** | **DOC OK** | Link to manifest commit | Doc owner | `FREEZE.md@sha` | **N** | **N** | Docs exist; runtime still frozen |
| Approval chain proof | **P0** | **MISSING** | Signed PDF / ticket links | Approvers | `approvals.pdf` | **YES** | **YES** | No self-approval |

---

## Summary row

**Staging execution:** **BLOCKED** until P0 gaps for in-scope items are **ATTACHED** or **waived in writing**.  
**Production:** **BLOCKED** regardless until separate production pilot bundle.

---

## Cross-links

- `C2C_EVIDENCE_BUNDLE_RECORD_STAGE1_DRYRUN.md`  
- `C2C_STAGE1_DRYRUN_GO_NO_GO_RECORD.md`  
- `C2C_ACTION_OWNER_REGISTER.md`
