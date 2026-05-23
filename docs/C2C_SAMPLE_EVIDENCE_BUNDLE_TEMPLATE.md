# C2C — Sample evidence bundle template

**THIS IS A TEMPLATE — NOT REAL EXECUTION EVIDENCE.**

**Purpose:** Show what a **complete** governance evidence package would look like **before** any staging execution is authorized. All fields below are **placeholders** for tabletop and future real runs.

---

## 1. Evidence metadata

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| `bundle_id` | UUID in `manifest.json` | `00000000-0000-4000-8000-00000000feed` | Doc owner | **Y** |
| `created_at` | ISO-8601 UTC | `2026-05-23T12:00:00.000Z` | Doc owner | **Y** |
| `scenario_id` | Named scenario | `PAPER_DRYRUN_OPERATOR_V1` | Security | **Y** |
| `git_commit` | Full SHA tested | `661d0bf…` (example) | Tech lead | **Y** |

---

## 2. Environment

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Environment id | Non-ambiguous label | `staging-paper-only` (no live project) | Ops | **Y** |
| Key fingerprint | Hash of anon key prefix | `sha256:…first8` (redacted) | Security | **Y** |
| Egress policy | Doc link or denylist hash | `egress-policy-v0.pdf` | Security | **Y** |

---

## 3. Replay ID

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| `replay_nonce` | Single-use token id | `replay-nonce-001` | Security | **Y** |
| TTL proof | Config or test log | `TTL=600s` in harness log | Security | **Y** |

---

## 4. Correlation ID

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| `correlation_id` | UUID on every span | `corr-aaaaaaaa-bbbb-cccc-dddddddddddd` | Tech lead | **Y** |
| End-to-end trace | Link to trace export | `trace-export-corr-aaa.json` | Ops | **Y** |

---

## 5. Operator identity

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| `actor_sub` | JWT `sub` or synthetic id | `staging-operator-synthetic-001` | Security | **Y** |
| Role snapshot | Roles at request time | `roles: ["staging_operator"]` | Security | **Y** |

---

## 6. Queue state snapshot

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Depth / state | JSON snapshot | `{ "depth": 0, "state": "disabled" }` | Ops | **Y** (if queues in scope) |
| Lease proof | N/A when disabled | `null` | Ops | N/A for pure dry-run |

---

## 7. Replay protection evidence

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Replay test log | Second request outcome | `duplicate_suppressed` | Security | **Y** |

---

## 8. Duplicate-send prevention evidence

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Double-submit log | Count of logical sends = 1 | `logical_sends: 1` | Tech lead | **Y** |

---

## 9. JWT / auth evidence

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Negative test | 401 without token | `curl … → 401` (redacted) | Security | **Y** |
| Positive test | 200 with valid token | `curl … → 200` (redacted) | Security | **Y** |

---

## 10. Rollback validation evidence

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Drill timestamp | Start/stop UTC | `rollback-drill-20260523T1205Z.log` | Ops | **Y** |
| SLO met | Duration | `disable_to_zero_traffic_s: 18` | Ops | **Y** |

---

## 11. Audit log evidence

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Audit chain | Ordered ids | `audit-001…audit-004` | Finance delegate (if money-adjacent) / Security | **Y** when in scope |

---

## 12. Observability evidence

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Dashboard link | Saved view URL | `https://…/dashboard/dryrun` | Ops | **Y** |
| Metric definitions | Query text | `dryrun_completed_total` | Ops | **Y** |

---

## 13. Alert validation

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Injected fault | Ticket id | `ALERT-TEST-042` | Ops | **Y** |
| Page receipt | On-call ack | `acked_by: pagerbot` | Ops | **Y** |

---

## 14. Dry-run trace screenshots

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Redacted spans | PNG in secure drive | `dryrun-trace-001.png` | Product (optional) | **N** if logs suffice |

---

## 15. Failure scenario evidence

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Tabletop record | Signed minutes | `minutes-20260523-tabletop.pdf` | Security | **Y** for pilot class |

---

## 16. Kill-switch validation

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Flag OFF proof | Metric drop | `send_rate_after_kill: 0` | Ops | **Y** |

---

## 17. Approval signatures

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| GO / NO-GO | Signed PDF rows | `Security: GO` | Executive sponsor (prod pilot) | **Y** |

---

## 18. Freeze state confirmation

| Field | Required artifact | Example placeholder | Approval owner | Production blocker if missing? |
|-------|-------------------|---------------------|----------------|------------------------------|
| Freeze ack | Link to manifest version | `C2C_EXECUTION_FREEZE_MANIFEST.md @ commit` | Doc owner | **Y** |

---

## Banner

**THIS IS A TEMPLATE — NOT REAL EXECUTION EVIDENCE.**  
Do not attach production secrets, production PII, or production keys to any bundle derived from this template.

---

## Cross-links

- `C2C_EVIDENCE_ARTIFACT_STANDARD.md`  
- `C2C_PAPER_DRYRUN_WALKTHROUGH.md`  
- `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`
