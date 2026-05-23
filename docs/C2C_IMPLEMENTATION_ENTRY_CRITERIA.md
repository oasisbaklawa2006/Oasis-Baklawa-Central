# C2C — Implementation entry criteria (before any implementation PR)

**Purpose:** Minimum **governance and evidence** gates before opening **implementation** pull requests that could affect C2C execution, staging isolation, or production behavior.

---

## Before ANY implementation PR (C2C-affecting)

| # | Criterion | Evidence |
|---|-----------|----------|
| G1 | Mandatory governance docs **merged** on `main` for the active phase | Link to doc set + commit range |
| G2 | Evidence **template** reviewed and acknowledged (`C2C_SAMPLE_EVIDENCE_BUNDLE_TEMPLATE.md`) | Security + Ops initials on ticket |
| G3 | **Isolation** review completed (`C2C_STAGING_DATA_ISOLATION_RULES.md` + charter) | Written checklist with key fingerprints |
| G4 | **Rollback** review completed (`C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md` + drill plan) | Ops-approved rollback doc version |
| G5 | **Replay** review completed (`C2C_EXECUTION_INDEPENDENT_TEST_STRATEGY.md`) | Security-approved test plan |
| G6 | **Observability** review completed (`C2C_DRYRUN_OBSERVABILITY_SPEC.md` + dashboards spec) | Ops link to dashboard spec |
| G7 | **Approval chain** identified for this PR scope (`C2C_GOVERNANCE_APPROVAL_MODEL.md`) | Named approvers in ticket |
| G8 | **Freeze acknowledgement** copied into PR description (`C2C_EXECUTION_FREEZE_MANIFEST.md`) | Checkbox: “No thaw without GO” |

If **any** of G1–G8 is missing → **do not open** the implementation PR.

---

## Before ANY runtime PR (code paths that can execute I/O)

| # | Requirement | Detail |
|---|-------------|--------|
| R1 | **Exact reviewers** | Security + Ops + Tech lead minimum for send/queue/retry paths |
| R2 | **Exact tests** | Unit/integration plan attached; includes negative auth + replay cases |
| R3 | **Exact staging restrictions** | Staging project id; denylist hosts; allowlist numbers (if sends) |
| R4 | **Forbidden shortcuts** listed in PR | Copy-paste from `C2C_IMPLEMENTATION_CONSTRAINTS_FOR_ENGINEERS.md` with “none used” attestation |

---

## Forbidden shortcuts (reminder)

- Temporary JWT-off, client-only idempotency, shared prod keys, browser queue processor, silent flag default change, self-approval.

---

## Automatic PR rejection triggers

- Missing linked **evidence bundle id** (even `TBD` is reject — must be `N/A` with reason for doc-only PRs).  
- Missing **rollback** section in PR template for I/O PRs.  
- Any new `functions.invoke` without linked security review ticket.

---

## Cross-links

- `C2C_WHAT_IS_NOT_IMPLEMENTED.md`  
- `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`  
- `C2C_SAMPLE_EVIDENCE_BUNDLE_TEMPLATE.md`
