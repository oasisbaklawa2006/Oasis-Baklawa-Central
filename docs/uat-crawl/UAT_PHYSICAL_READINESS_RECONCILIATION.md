# UAT Physical Readiness Reconciliation

**Generated:** 2026-09-28T23:01:01.135Z
**Run:** 36495576511 (attempt 1, tranche `post-fix-483`)
**Current main:** `f41b9cee85ac4e534de1b77f2abcead73795ef7e`
**Deploy:** https://oasis-baklawa-central.vercel.app
**Last GHA evidence run:** [36495576511](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/36495576511)

## Automated S0–S3 disposition (131 census surfaces)

| Disposition | Count | Meaning |
|---|---:|---|
| AUTH S0–S3 complete | **0** | Governed authenticated crawl evidence on current-main deploy |
| Public S0 observed | **0** | Unauthenticated public continuation (S0 only) |
| **BLOCKED** (credential/deploy) | **0** | Exact `TEST_*` secret names in blocker registry |
| OTP external gate | **0** | Current-run row reached governed OTP/provider boundary |
| Provider gated | **0** | Current-run row reached an external provider boundary |
| Auth flow failed | **0** | Current-run authentication attempt failed |
| Auth contract mismatch | **0** | Current-run auth contract mismatch |
| Data fixture gate | **2** | Auth + S0 evidenced; governed external fixture missing |
| Test credential gate | **0** | Wired `TEST_*` prefix rejected by provider (HTTP 400) |
| **NOT EXECUTED** | **129** | No current-run evidence row produced |

## By device class

| Device | Total | Auth S0–S3 | Public S0 | Blocked | OTP gate | Provider gate | Fixture gate | Cred gate | Not executed |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| desktop | 105 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 105 |
| phone | 14 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 12 |
| tv | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 |
| scanner | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |

## Current-run unresolved evidence

- Missing-secret/deploy blockers: **0**
- OTP external gates: **0**
- Provider gates: **0**
- Auth-flow failures: **0**
- Auth-contract mismatches: **0**
- Data fixture gates: **2**
- Test credential gates: **0**
- Not executed: **129**

## Exact blocker secret groups


## Stop condition

**INCOMPLETE_CURRENT_RUN_EVIDENCE — one or more census rows were not executed**

No credentials invented. No RBAC bypass. Physical iPhone/tablet/scanner/TV PASS requires separate human evidence packs — not claimed from this automated crawl.

Preserved append-only: FAIL-493 pre-fix @ `8f042fa`, preview PASS @ `9715c20d`, current-main UAT-005 PASS run 34037424554.
