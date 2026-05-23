# C2C — Pre-implementation evidence requirements

**Purpose:** List **evidence that must exist before implementation** begins for each high-risk class. “Design doc” alone is **not** evidence. **Planning only.**

---

## Evidence categories (definitions)

| Category | What counts as proof |
|----------|---------------------|
| **Replay proof** | Logs showing replay of same request within TTL produces `duplicate_suppressed` or identical outcome id |
| **Rollback proof** | Dated drill log: kill switch or config revert restores safe state within SLO |
| **Audit proof** | Export showing audit row always precedes irreversible state; no silent deletes |
| **Observability proof** | Live dashboard + alert firing on injected fault |
| **Queue isolation proof** | Architecture diagram + resource names proving no prod shared consumer |
| **JWT proof** | Curl or automated test: unauthenticated write rejected; authenticated accepted |
| **Operator identity proof** | Tests rejecting spoofed body `operator_id` when JWT subject mismatches |
| **Idempotency proof** | Double-submit and two-tab tests with metrics showing single logical effect |
| **Duplicate-send proof** | Zero duplicate logical sends over soak window; metric definition attached |
| **Stale-state proof** | UI tests: stale version cannot commit without refresh or lock failure path |

---

## Before any staging execution

| Evidence | Minimum |
|----------|---------|
| Replay proof | Required |
| Rollback proof | Required |
| Audit proof | Required (simulated audit for dry-run) |
| Observability proof | Required |
| Queue isolation proof | Required |
| JWT proof | Required |
| Operator identity proof | Required for operator paths |
| Idempotency proof | Required |
| Duplicate-send proof | Required |
| Stale-state proof | Required for concurrent UI |

---

## Before any queue activation

| Evidence | Minimum |
|----------|---------|
| Queue isolation proof | Required |
| Observability proof | Required |
| Rollback proof | Required |
| Idempotency proof | Required |
| Duplicate-send proof | Required |

---

## Before any retry activation

| Evidence | Minimum |
|----------|---------|
| Idempotency proof | Required |
| Replay proof | Required |
| Observability proof | Required |
| Rollback proof | Required |
| Duplicate-send proof | Required |

---

## Before any resend flow

| Evidence | Minimum |
|----------|---------|
| Idempotency proof | Required |
| Duplicate-send proof | Required |
| Audit proof | Required |
| JWT proof | Required |
| Operator identity proof | Required |

---

## Before any TOOL 5 work

| Evidence | Minimum |
|----------|---------|
| **Separate signed charter** | Required (outside default C2C program) |
| All categories above | Required for whatever surface TOOL 5 touches |
| Veto conditions from approval model | Reviewed |

*Default stance: **TOOL 5 blocked**.*

---

## Before any finance action (in pilot scope)

| Evidence | Minimum |
|----------|---------|
| Queue isolation proof | Required |
| Audit proof | Required |
| Rollback proof | Required |
| JWT proof | Required |
| Idempotency proof | Required |
| Observability proof | Required |
| **Finance SoD evidence** | Required (two-person rule or equivalent) |

---

## Before any dispatch trigger (in pilot scope)

| Evidence | Minimum |
|----------|---------|
| Audit proof | Required |
| Rollback proof | Required |
| Stale-state proof | Required |
| Observability proof | Required |
| Finance isolation review | If dispatch couples to payment state |

---

## Before any production pilot

| Evidence | Minimum |
|----------|---------|
| **All categories** | Required for in-scope paths |
| Staging soak report | Required |
| Risk register | Required (no open P0 without waiver) |
| Go/no-go memo | Required |

---

## Artifact format

- Evidence lives in: **versioned** wiki page, ticket attachments, or secure drive — linked from GO checklist.
- Each attachment lists: **environment**, **commit hash**, **time window**, **operator names** (for human tests).

---

## Cross-links

- `C2C_EXECUTION_FREEZE_MANIFEST.md`
- `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`
- `C2C_GOVERNANCE_APPROVAL_MODEL.md`
- `C2C_DRYRUN_OBSERVABILITY_SPEC.md`
