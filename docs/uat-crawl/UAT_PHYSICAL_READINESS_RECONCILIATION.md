# UAT Physical Readiness Reconciliation

**Generated:** 2026-09-27T06:27:07.651Z
**Run:** 36298937129 (attempt 1, tranche `watchdog-continue`)
**Current main:** `d3f57a7cce274534a6cb3a29e8f5edf0d9797e10`
**Deploy:** https://oasis-baklawa-central.vercel.app
**Last GHA evidence run:** [36298937129](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/36298937129)

## Automated S0–S3 disposition (131 census surfaces)

| Disposition | Count | Meaning |
|---|---:|---|
| AUTH S0–S3 complete | **103** | Governed authenticated crawl evidence on current-main deploy |
| Public S0 observed | **5** | Unauthenticated public continuation (S0 only) |
| **BLOCKED** (credential/deploy) | **0** | Exact `TEST_*` secret names in blocker registry |

## By device class

| Device | Total | Auth S0–S3 | Public S0 | Blocked |
|---|---:|---:|---:|---:|
| desktop | 105 | 96 | 5 | 0 |
| phone | 14 | 0 | 0 | 0 |
| tv | 8 | 7 | 0 | 0 |
| scanner | 4 | 0 | 0 | 0 |

## Runnable now vs blocked (automated crawl)

| Runnable now | Blocked |
|---|---|
| Re-refresh **103** auth surfaces + **5** public S0 (existing creds in GHA) | **0** surfaces — **only** missing `TEST_*` repo secrets / deploy URLs |

## Exact blocker secret groups


## Stop condition

**CREDENTIALS_AVAILABLE — dispatch watchdog-continue**

No credentials invented. No RBAC bypass. Physical iPhone/tablet/scanner/TV PASS requires separate human evidence packs — not claimed from this automated crawl.

Preserved append-only: FAIL-493 pre-fix @ `8f042fa`, preview PASS @ `9715c20d`, current-main UAT-005 PASS run 34037424554.
