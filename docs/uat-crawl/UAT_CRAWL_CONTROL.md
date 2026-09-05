# Appverse Full UAT Crawl — Control Plane

**Mode:** Visual + functional + **UI/UX** failure ledger only — **no remediation** until Phase 1–4 complete.  
**Evidence rules:**
- NO SCREENSHOT = NOT TESTED
- NO FUNCTION ACTION/RESULT = FUNCTION NOT TESTED
- **UX:** Every UAT-ID requires S0–S3 evidence + applicable 148-criterion evaluation ([`UAT_UX_FAILURE_MATRIX.md`](./UAT_UX_FAILURE_MATRIX.md))

## Phase status

| Phase | Deliverable | Location | Status |
|---|---|---|---|
| 1 | Route/page/state census (131 IDs) | `docs/uat-crawl/UAT_ROUTE_CENSUS.json` | **COMPLETE** (2026-09-05) |
| 2 | Screenshot crawl tranche 01 (UAT-0001..0010) | `uat-evidence/screenshots/tranche-01/` | **COMPLETE** (S0 only on auth gates; partial UX heuristics on public routes) |
| 2b | **UI/UX failure matrix integrated** | `docs/uat-crawl/UAT_UX_FAILURE_MATRIX.md`, `ux-matrix.json` | **COMPLETE** (2026-09-05) |
| 3 | Function crawl | Per-page control matrix | **NOT STARTED** (blocked on credentials for auth surfaces) |
| 3b | Full UX crawl (148 criteria × 131 IDs) | Manifest `uxCriteria*` fields | **NOT STARTED** (blocked on credentials + S1–S3 interactive states) |
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
  screenshots/tranche-01/     # chronological PNG captures (S0–S3 suffix)
  playwright-output/          # transient (gitignored)
docs/uat-crawl/
  UAT_ROUTE_CENSUS.json       # machine-readable census
  UAT_ROUTE_CENSUS.md         # human summary
  UAT_MANIFEST.jsonl          # one JSON object per capture (+ uxEvidence)
  UAT_INDEX.md                # markdown index tranche 01
  UAT_FAILURE_LEDGER.md       # FAIL-ID register (functional + UX)
  UAT_UX_FAILURE_MATRIX.md    # 148-criterion human matrix (sections A–T)
  ux-matrix.json              # machine-readable UX criteria
  UAT_TRANCHE_01_TARGETS.json
scripts/uat-crawl/generate-census.mjs
tests/uat-crawl/tranche-01-crawl.spec.ts
tests/uat-crawl/ux-helpers.ts
playwright.uat-crawl.config.ts
```

## Manifest UX fields (required from tranche 02+)

Each `UAT_MANIFEST.jsonl` row includes:

| Field | Meaning |
|---|---|
| `uxStatus` | `NOT-TESTED` / `PARTIAL` / `PASS` / `FAIL` / `BLOCKED` |
| `uxEvidence.s0`–`s3` | Relative paths to mandatory screenshot slots |
| `uxCriteriaTotal` | 148 |
| `uxCriteriaEvaluated` | Count of criteria actually judged |
| `uxCriteriaPassed` / `Failed` / `Blocked` | Tally |
| `uxFailures[]` | `{ failId, uxRefs, severity, summary, screenshots }` |

## Run crawl locally

```bash
node scripts/uat-crawl/generate-census.mjs
UAT_CRAWL_BASE_URL="https://<preview-or-staging-host>" npx playwright test -c playwright.uat-crawl.config.ts
```

**Credentials:** Set `TEST_DISPATCH_EMAIL`, `TEST_ADMIN_EMAIL`, etc. before tranche 02+ for authenticated role surfaces and full UX overlay checks (section E, criterion 32–36).

## Mandatory UX retests (known risks)

| Risk | UX-Refs | UAT / route | Device |
|---|---|---|---|
| Issue **#481** Select-in-Sheet | 32/33/36 | UAT-0068 `/admin/clients` | phone |
| B2B Dispatch empty filter | 57 | dispatch-mgmt | desktop |
| Dispatch RBAC nav leakage | 16–20 | dispatch persona routes | desktop |
| TV read-only surfaces | 139–143 | TV routes | TV viewport |

## Known pre-registered failures (not remediated)

| FAIL-ID | Source | Severity | UX-Refs | Blocker |
|---|---|---|---|---|
| FAIL-481-001 / FAIL-UX-481-001 | Issue **#481** — Pricing Slab Select behind Sheet | **P0** | 32/33/36 | Fix PR + deploy before Buyer approval physical re-test |
| FAIL-481-002 / FAIL-UX-481-002 | Issue **#481** — Account Manager role filter | **P1** | 17/36 | Same |
| FAIL-001-* | Tranche 01 auth gates | P1 | *(blocked)* | Operator/TEST_* credentials |

## Remaining untested

**121 / 131** UAT IDs have no screenshot yet (UAT-0011..UAT-0131).

**UX:** 131 / 131 IDs lack complete S0–S3 + full 148-criterion evaluation.

Next tranche: UAT-0011..0020 on Central preview with role credentials when provisioned; capture S1–S3 for every overlay-capable surface.

## Mission Control review rule

Post screenshot tranches in **strict UAT-ID order**. Mission Control independently inspects each screenshot for additional UX failures and appends to the ledger before remediation.
