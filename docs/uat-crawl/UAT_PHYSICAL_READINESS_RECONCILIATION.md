# UAT Physical Readiness Reconciliation

**Generated:** 2026-09-07T04:13:32.148Z
**Current main:** `15c59a3f54c92f2b289bd150005bcd7114b51a93`
**Deploy:** 
**Last GHA evidence run:** [34082244745](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34082244745)

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
| **0 recertified @ 15c59a3f** — deploy blocked; prior **80** auth + **5** public @ `e2f123b0` preserved | **46** credential (`TEST_*`) + **85** runnable awaiting trusted deploy for `15c59a3f` |

## Stop condition

**DEPLOY_BLOCKED @ 15c59a3f** — no trusted Vercel URL for exact current main (rate limit). Prior `e2f123b0` evidence preserved append-only. Re-run `current-main-rebaseline` after deploy lands.

**PLUS `ONLY_TEST_SECRET_BLOCKERS`** — 46 surfaces blocked on missing repo secrets below.

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

No credentials invented. No RBAC bypass. Physical iPhone/tablet/scanner/TV PASS requires separate human evidence — not claimed from automated crawl.

Preserved append-only: FAIL-493 pre-fix @ `8f042fa`, preview PASS @ `9715c20d`, `e2f123b0` evidence (runs 34046709938, 34056691981).
