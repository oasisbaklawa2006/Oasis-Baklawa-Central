# C2C — Staging data isolation rules

**Purpose:** Hard rules for **what must never cross** from production into staging exercises, and vice versa. Complements `C2C_STAGING_ISOLATION_CHARTER.md`.

---

## Absolute prohibitions

| Rule | Detail |
|------|--------|
| **No production numbers** | No real E.164 / MSISDN from prod DB in staging tests — use reserved test ranges or `+1555…` style agreed patterns only. |
| **No production recipients** | No real customer emails for destructive or high-volume tests. |
| **No production credentials** | Keys, JWTs, service role secrets are **environment-local**; rotation in staging never copies prod values. |
| **No production queues** | Topic names, SQS URLs, Supabase Realtime channels must be prefixed / distinct. |
| **No shared audit streams** | Staging audit must not replicate into prod SIEM index without filtering and legal sign-off. |
| **No shared replay IDs** | Idempotency / replay namespaces are **per-environment** UUID prefix. |
| **No shared operators** | Staging operator accounts ≠ prod admin accounts. |
| **No shared finance workflows** | No staging action on prod wallet tables; no prod finance RPC in staging config. |
| **No shared dispatch workflows** | No staging dispatch write that targets prod logistics APIs. |

---

## Synthetic-only data guidance

- Prefix entities with `DRYRUN_` or `STG_SYNTH_` in names where possible.  
- Orders and companies: generated UUIDs; **no** copy-paste from prod CSV exports.

---

## Redaction rules

- Redact: full message body, national ID, bank details, addresses — replace with **hash** or truncated token in evidence.  
- Keep: correlation ids, relative timestamps, outcome enums.

---

## Fake customer policy

- “Customers” are **synthetic personas** with documented bios stored only in staging.  
- If real employee phones are used for SMS tests, require **written opt-in** list stored outside default bundle (HR-controlled).

---

## Safe replay dataset rules

- Datasets must be **generated** or **anonymized** from prod with formal pipeline sign-off — **not** ad hoc SQL dumps on laptops.  
- Version datasets (`dataset_version` in manifest).

---

## Forbidden staging shortcuts

- “Just this once” prod number for a demo.  
- Pointing staging `.env` at prod Supabase URL “to compare data.”  
- Using prod **Click2API** or **MSG91** keys in staging.  
- Replaying prod webhook payloads verbatim against staging Edge without scrubbing secrets and PII.

---

## Cross-links

- `C2C_STAGING_ISOLATION_CHARTER.md`  
- `C2C_EVIDENCE_ARTIFACT_STANDARD.md`  
- `C2C_EXECUTION_INDEPENDENT_TEST_STRATEGY.md`
