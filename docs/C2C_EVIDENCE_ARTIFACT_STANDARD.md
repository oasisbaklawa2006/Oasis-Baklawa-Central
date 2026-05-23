# C2C — Evidence artifact standard

**Purpose:** Normalize **evidence bundles** attached to GO/NO-GO decisions and approvals. **Process standard** — not a database schema in this sprint.

---

## Required artifact envelope (every bundle)

Each evidence bundle **must** include the following fields (file `manifest.json` or equivalent):

| Field | Description |
|-------|-------------|
| `bundle_id` | UUID |
| `created_at` | ISO-8601 UTC **timestamp** |
| `environment` | e.g. `staging-eu-1` — **never** ambiguous “staging” |
| `git_commit` | Full SHA of deployed or tested artifact |
| `actor_identity` | Human + machine actors (CI bot id, engineer ldap, etc.) |
| `replay_id` / `replay_nonce` | When replay tests included |
| `request_correlation_id` | Primary correlation id for the scenario |
| `audit_references` | List of `audit_sim_id` or append-only row ids |
| `screenshots` | Optional; redacted; links only to secure storage |
| `logs` | Structured log excerpts or signed URLs |
| `rollback_proof` | Link to drill log id meeting SLO |
| `queue_snapshots` | Optional depth / DLQ snapshots |
| `duplicate_prevention_proof` | Test output showing suppressed duplicates |
| `observability_proof` | Dashboard snapshot ids or query definitions |

---

## Naming conventions

| Artifact | Pattern |
|----------|---------|
| Bundle folder | `c2c-evidence-{YYYYMMDD}-{bundle_id}` |
| Logs | `logs/{correlation_id}.jsonl` |
| Metrics export | `metrics/{scenario}-{timestamp}.csv` |
| Screenshots | `shots/{step}-{correlation_id}.png` (no raw PII) |

---

## Retention expectations

- **Staging evidence:** minimum **180 days** unless legal says longer/shorter — record actual policy in org wiki.  
- **Production pilot evidence:** **≥ 1 year** typical; confirm with compliance.  
- **Incident evidence:** retain per incident policy; **do not delete** until post-mortem sign-off.

---

## Immutable evidence expectations

- Bundles are **append-only** — corrections add `correction_of` manifest, never delete originals.  
- Hash (`sha256`) of each file in bundle recorded in manifest for tamper detection.

---

## Approval attachment requirements

- Approvers attach **their** signed checklist PDF or ticket link into manifest `approvals[]`.  
- Each entry: `{ role, name, timestamp, decision: GO|NO_GO|WAIVE, scope }`.

---

## Prohibited

- Secrets (API keys, service role JWTs) inside bundles.  
- **Production PII** exports into shared drives.  
- Rewriting history by replacing bundle zip **in place**.

---

## Cross-links

- `C2C_EXECUTION_INDEPENDENT_TEST_STRATEGY.md`  
- `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`  
- `C2C_GOVERNANCE_APPROVAL_MODEL.md`
