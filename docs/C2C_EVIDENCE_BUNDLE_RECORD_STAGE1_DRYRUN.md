# C2C — Evidence bundle record (Stage 1 dry-run) — SAMPLE ONLY

**THIS IS NOT REAL RUNTIME EVIDENCE.**

**Purpose:** Sample / template **record** of what a Stage 1 dry-run evidence bundle would contain. All `bundle_id`, timestamps, and artifacts below are **placeholders**. **Current status for every technical section: TEMPLATE ONLY / MISSING.**

---

## 1. Evidence metadata

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| `bundle_id` | UUID in `manifest.json` | **TEMPLATE ONLY** | `________________` | **YES** |
| `created_at` | ISO-8601 UTC | **MISSING** | `________________` | **YES** |
| `scenario_id` | e.g. `STAGE1_DRYRUN_V1` | **TEMPLATE ONLY** | `________________` | **YES** |
| `git_commit` | Full SHA under test | **MISSING** | `________________` | **YES** |

---

## 2. Environment evidence

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Environment id | Non-ambiguous label | **MISSING** | Ops | **YES** |
| Key fingerprint | Redacted hash | **MISSING** | Security | **YES** |

---

## 3. Replay ID placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| `replay_nonce` | UUID + TTL proof | **MISSING** | Security | **YES** |

---

## 4. Correlation ID placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| `correlation_id` | UUID on all spans | **MISSING** | Tech lead | **YES** |

---

## 5. Operator identity placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| `actor_sub` | JWT subject | **MISSING** | Security | **YES** |

---

## 6. Queue state placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Snapshot JSON | Depth + state | **TEMPLATE ONLY** (`disabled`) | Ops | **YES** (when queues in scope) |

---

## 7. Replay protection evidence placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Replay test log | `duplicate_suppressed` | **MISSING** | Security | **YES** |

---

## 8. Duplicate-send prevention evidence placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Double-submit log | `logical_sends: 1` | **MISSING** | Tech lead | **YES** |

---

## 9. JWT / auth evidence placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Negative / positive tests | Redacted curl logs | **MISSING** | Security | **YES** |

---

## 10. Rollback validation evidence placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Drill log | Timestamps + SLO | **MISSING** | Ops | **YES** |

---

## 11. Audit log evidence placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Audit chain ids | Ordered list | **MISSING** | Audit owner | **YES** |

---

## 12. Observability evidence placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Dashboard link | Saved view URL | **MISSING** | Ops | **YES** |

---

## 13. Alert validation placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Injected fault + page | Ticket id | **MISSING** | Ops | **YES** |

---

## 14. Dry-run trace placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Trace export | JSON / PNG | **MISSING** | Tech lead | **YES** |

---

## 15. Failure scenario evidence placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Tabletop minutes | Signed PDF | **MISSING** (see `C2C_TABLETOP_MEETING_MINUTES.md` draft) | Chair | **YES** |

---

## 16. Kill-switch validation placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Metric drop proof | Before/after | **MISSING** | Ops | **YES** |

---

## 17. Approval signatures placeholder

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| GO / NO-GO | Signed PDF rows | **MISSING** | Approvers | **YES** |

---

## 18. Freeze state confirmation

| Field | Required artifact | Current status | Owner placeholder | Production blocker? |
|-------|-------------------|----------------|---------------------|---------------------|
| Manifest reference | Commit + doc version | **TEMPLATE ONLY** | Doc owner | **YES** |

---

## Banner

**THIS IS NOT REAL RUNTIME EVIDENCE.**  
Replace this file with a real bundle export only after staging execution is authorized and artifacts are collected.

---

## Cross-links

- `C2C_SAMPLE_EVIDENCE_BUNDLE_TEMPLATE.md`  
- `C2C_EVIDENCE_ARTIFACT_STANDARD.md`  
- `C2C_STAGE1_DRYRUN_GO_NO_GO_RECORD.md`
