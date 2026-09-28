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
| 2a | Screenshot crawl tranche 01 (UAT-0001..0010) | `uat-evidence/screenshots/tranche-01/` | **COMPLETE** |
| 2b | Screenshot crawl tranche 02 (UAT-0011..0020) | `uat-evidence/screenshots/tranche-02/` | **COMPLETE** (2026-09-05) |
| 2c | **UI/UX failure matrix** | `UAT_UX_FAILURE_MATRIX.md`, `ux-matrix.json` | **COMPLETE** |
| 2d | **Authenticated auth-rerun** (UAT-0002..0020) | `uat-evidence/screenshots/auth-rerun/`, `UAT_MANIFEST_AUTH.jsonl` | **HARNESS READY** — 0/15 authenticated until GHA `TEST_*` secrets |
| 3 | Function + UX crawl (authenticated) | `tests/uat-crawl/auth-crawl.ts`, workflow `uat-crawl-evidence.yml` | **BLOCKED** on secret provisioning in CI |
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
  screenshots/tranche-01/     # pre-auth evidence (preserved)
  screenshots/tranche-02/
  screenshots/auth-rerun/     # authenticated S0–S3 (separate from pre-auth)
  screenshots/tranche-03-auth/
docs/uat-crawl/
  UAT_MANIFEST.jsonl          # pre-auth captures
  UAT_MANIFEST_AUTH.jsonl     # authenticated captures + checksums
  UAT_AUTH_RERUN_SUMMARY.json
  UAT_INDEX_AUTH_RERUN.md
.github/workflows/uat-crawl-evidence.yml
tests/uat-crawl/auth-rerun.spec.ts
tests/uat-crawl/auth-crawl.ts
tests/uat-crawl/credential-matrix.ts
```

## Authenticated crawl (required for role surfaces)

**Login-gate screenshots do not satisfy function/UX crawl.** Re-run via:

```bash
# GitHub Actions (recommended): workflow_dispatch "UAT Crawl Evidence"
# Local (secrets exported, never commit values):
TEST_PREVIEW_URL=https://<host> npm run test:uat-auth-rerun
TEST_PREVIEW_URL=https://<host> npm run test:uat-tranche-03
```

Credential matrix: `tests/uat-crawl/credential-matrix.ts` — reuses `TEST_ADMIN_*`, `TEST_BUYER_*`, `TEST_SALES_*`, `TEST_FINANCE_*`, `TEST_ASSEMBLY_*`, `TEST_DISPATCH_*`, `TEST_OPERATIONS_*` from lane1 / dispatch cert / buyer cert conventions.

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
| Issue **#483** Select-in-Sheet (was #481) | 32/33/36 | UAT-0018 `/admin/clients` sheet-review | phone |
| B2B Dispatch empty filter | 57 | dispatch-mgmt | desktop |
| Dispatch RBAC nav leakage | 16–20 | dispatch persona routes | desktop |
| TV read-only surfaces | 139–143 | TV routes | TV viewport |

## Known pre-registered failures (not remediated)

| FAIL-ID | Source | Severity | UX-Refs | Blocker |
|---|---|---|---|---|
| FAIL-481-001 / FAIL-UX-481-001 | Issue **#483** (pre-fix #481) — Pricing Slab Select behind Sheet | **P0** | 32/33/36 | **#483 deployed ace340fe** — re-test via `post-fix-483/` harness |
| FAIL-481-002 / FAIL-UX-481-002 | Account Manager role filter | **P1** | 17/36 | Same — `npm run test:uat-post-fix-483` |
| FAIL-001-* | Tranche 01 auth gates | P1 | *(blocked)* | Operator/TEST_* credentials |

## Remaining untested

**111 / 131** UAT IDs have no screenshot yet (UAT-0021..UAT-0131) after tranche 02.

**UX:** 131 / 131 IDs lack complete S0–S3 + full 148-criterion evaluation.

Next tranche: UAT-0021..0030 on Central preview; Dispatch (`UAT-0093+`) and Trace/AI Studio require respective deploy URLs + credentials when provisioned.

## Mission Control review rule

Post screenshot tranches in **strict UAT-ID order**. Mission Control independently inspects each screenshot for additional UX failures and appends to the ledger before remediation.
