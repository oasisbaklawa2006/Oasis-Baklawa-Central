# Appverse Full UAT Crawl — Control Plane

**Mode:** Visual + functional failure ledger only — **no remediation** until Phase 1–4 complete.  
**Evidence rule:** NO SCREENSHOT = NOT TESTED. NO FUNCTION ACTION/RESULT = FUNCTION NOT TESTED.

## Phase status

| Phase | Deliverable | Location | Status |
|---|---|---|---|
| 1 | Route/page/state census (131 IDs) | `docs/uat-crawl/UAT_ROUTE_CENSUS.json` | **COMPLETE** (2026-09-05) |
| 2 | Screenshot crawl tranche 01 (UAT-0001..0010) | `uat-evidence/screenshots/tranche-01/` | **COMPLETE** |
| 3 | Function crawl | Per-page control matrix | **NOT STARTED** (blocked on credentials for auth surfaces) |
| 4 | Failure register | `docs/uat-crawl/UAT_FAILURE_LEDGER.md` | **BOOTSTRAPPED** |

## Census totals (Phase 1)

| App | Page/state IDs | Baseline |
|---|---:|---|
| central | 113 | `08ccb1cf` |
| buyer-mobile | 8 | `570853c1` |
| ai-studio | 6 | `a373564a` (PR #143 preview for Point 41) |
| trace | 4 | `e395b77f` |
| **Total** | **131** | |

## Evidence bundle layout

```
uat-evidence/
  screenshots/tranche-01/     # chronological PNG captures
  playwright-output/          # transient (gitignored)
docs/uat-crawl/
  UAT_ROUTE_CENSUS.json       # machine-readable census
  UAT_ROUTE_CENSUS.md         # human summary
  UAT_MANIFEST.jsonl          # one JSON object per capture
  UAT_INDEX.md                # markdown index tranche 01
  UAT_FAILURE_LEDGER.md       # FAIL-ID register
  UAT_TRANCHE_01_TARGETS.json
scripts/uat-crawl/generate-census.mjs
tests/uat-crawl/tranche-01-crawl.spec.ts
playwright.uat-crawl.config.ts
```

## Run crawl locally

```bash
node scripts/uat-crawl/generate-census.mjs
UAT_CRAWL_BASE_URL="https://<preview-or-staging-host>" npx playwright test -c playwright.uat-crawl.config.ts
```

**Credentials:** Set `TEST_DISPATCH_EMAIL`, `TEST_ADMIN_EMAIL`, etc. before tranche 02+ for authenticated role surfaces. Tranche 01 intentionally captures unauthenticated gates.

## Known pre-registered failures (not remediated)

| FAIL-ID | Source | Severity | Blocker |
|---|---|---|---|
| FAIL-481-001 | Issue **#481** — Pricing Slab / Account Manager Select behind Sheet on `/admin/clients` | **P0** | Fix PR + deploy before Buyer approval physical re-test |
| FAIL-001-* | Tranche 01 auth gates UAT-0002,0003,0006,0007,0010 | P1 | Operator/TEST_* credentials for function crawl |

## Remaining untested

**121 / 131** UAT IDs have no screenshot yet (UAT-0011..UAT-0131).

Next tranche: UAT-0011..0020 on Central preview with role credentials when provisioned.
