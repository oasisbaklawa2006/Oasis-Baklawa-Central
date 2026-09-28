# UAT Physical Readiness Reconciliation

**Generated:** 2026-09-28T16:50:09.370Z
**Run:** 36450858295 (attempt 1, tranche `watchdog-continue`)
**Current main:** `4e16ae5f434cdeb4449e077a50c828a89e51316c`
**Deploy:** https://oasis-baklawa-central.vercel.app
**Last GHA evidence run:** [36450858295](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/36450858295)

## Automated S0–S3 disposition (131 census surfaces)

| Disposition | Count | Meaning |
|---|---:|---|
| AUTH S0–S3 complete | **103** | Governed authenticated crawl evidence on current-main deploy |
| Public S0 observed | **5** | Unauthenticated public continuation (S0 only) |
| **BLOCKED** (credential/deploy) | **0** | Exact `TEST_*` secret names in blocker registry |
| OTP external gate | **10** | Current-run row reached governed OTP/provider boundary |
| Provider gated | **0** | Current-run row reached an external provider boundary |
| Auth flow failed | **1** | Current-run authentication attempt failed |
| Auth contract mismatch | **0** | Current-run auth contract mismatch |
| **NOT EXECUTED** | **12** | No current-run evidence row produced |

## By device class

| Device | Total | Auth S0–S3 | Public S0 | Blocked | OTP gate | Provider gate | Not executed |
|---|---:|---:|---:|---:|---:|---:|---:|
| desktop | 105 | 96 | 5 | 0 | 0 | 0 | 4 |
| phone | 14 | 0 | 0 | 0 | 10 | 0 | 4 |
| tv | 8 | 7 | 0 | 0 | 0 | 0 | 0 |
| scanner | 4 | 0 | 0 | 0 | 0 | 0 | 4 |

## Current-run unresolved evidence

- Missing-secret/deploy blockers: **0**
- OTP external gates: **10**
- Provider gates: **0**
- Auth-flow failures: **1**
- Auth-contract mismatches: **0**
- Not executed: **12**

## Exact blocker secret groups


## Stop condition

**INCOMPLETE_CURRENT_RUN_EVIDENCE — one or more census rows were not executed**

No credentials invented. No RBAC bypass. Physical iPhone/tablet/scanner/TV PASS requires separate human evidence packs — not claimed from this automated crawl.

Preserved append-only: FAIL-493 pre-fix @ `8f042fa`, preview PASS @ `9715c20d`, current-main UAT-005 PASS run 34037424554.
