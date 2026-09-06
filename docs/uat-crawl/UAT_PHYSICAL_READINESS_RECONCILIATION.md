# UAT Physical Readiness Reconciliation

**Generated:** 2026-09-06T20:00:43.306Z
**Current main:** `e2f123b0fe257b8a1f39ec40d5f544fff1ebe313`
**Deploy:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app
**Last GHA evidence run:** [34046709938](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34046709938)

## Automated S0–S3 disposition (131 census surfaces)

| Disposition | Count | Meaning |
|---|---:|---|
| AUTH S0–S3 complete | **80** | Governed authenticated crawl evidence on current-main deploy |
| Public S0 observed | **5** | Unauthenticated public continuation (S0 only) |
| **BLOCKED** (credential/deploy) | **46** | Exact `TEST_*` secret names in blocker registry |

## By device class

| Device | Total | Auth S0–S3 | Public S0 | Blocked |
|---|---:|---:|---:|---:|
| desktop | 105 | 80 | 5 | 20 |
| phone | 14 | 0 | 0 | 14 |
| tv | 8 | 0 | 0 | 8 |
| scanner | 4 | 0 | 0 | 4 |

## Runnable now vs blocked (automated crawl)

| Runnable now | Blocked |
|---|---|
| Re-refresh **80** auth surfaces + **5** public S0 (existing creds in GHA) | **46** surfaces — **only** missing `TEST_*` repo secrets / deploy URLs |

## Exact blocker secret groups

- `TEST_GATE_SECURITY_EMAIL, TEST_GATE_SECURITY_PASSWORD` — **1** IDs: UAT-0003
- `TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD` — **10** IDs: UAT-0006, UAT-0007, UAT-0114, UAT-0115, UAT-0116, UAT-0117, UAT-0118, UAT-0119 … +2 more
- `TEST_SALES_EMAIL, TEST_SALES_PASSWORD` — **5** IDs: UAT-0018, UAT-0020, UAT-0044, UAT-0104, UAT-0105
- `TEST_RGS_EMAIL, TEST_RGS_PASSWORD` — **6** IDs: UAT-0062, UAT-0063, UAT-0064, UAT-0065, UAT-0082, UAT-0087
- `TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD` — **6** IDs: UAT-0067, UAT-0097, UAT-0098, UAT-0099, UAT-0100, UAT-0101
- `TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD` — **7** IDs: UAT-0106, UAT-0107, UAT-0108, UAT-0109, UAT-0110, UAT-0111, UAT-0112
- `TEST_TV_PRODUCTION_EMAIL, TEST_TV_PRODUCTION_PASSWORD` — **1** IDs: UAT-0113
- `TEST_AI_STUDIO_PREVIEW_URL` — **6** IDs: UAT-0122, UAT-0123, UAT-0124, UAT-0125, UAT-0126, UAT-0127
- `TEST_TRACE_PREVIEW_URL` — **4** IDs: UAT-0128, UAT-0129, UAT-0130, UAT-0131

## Stop condition

**ONLY_TEST_SECRET_BLOCKERS — no further automated crawl until repo secrets wired**

No credentials invented. No RBAC bypass. Physical iPhone/tablet/scanner/TV PASS requires separate human evidence packs — not claimed from this automated crawl.

Preserved append-only: FAIL-493 pre-fix @ `8f042fa`, preview PASS @ `9715c20d`, current-main UAT-005 PASS run 34037424554.
