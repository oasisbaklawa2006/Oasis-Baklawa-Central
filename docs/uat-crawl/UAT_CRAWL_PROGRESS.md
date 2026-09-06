# UAT Crawl Progress Summary

**Last updated:** 2026-09-06 (post-#497 merge current-main cert — GHA run [34037424554](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34037424554) @ `9df732fa`)  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Current main:** `e2f123b0fe257b8a1f39ec40d5f544fff1ebe313` (#497 merged) — deploy `https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app`  
**Preserved FAIL-493 evidence (append-only):** pre-fix FAIL @ `8f042fa` run [34015742110](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34015742110); preview PASS @ `9715c20d` run [34016393457](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34016393457) — **NOT substituted**  
**Mode:** Read-only evidence — **no remediation** in this programme.

## Post-#497 merge — current-main certification (`post-merge-497-main`)

| Gate | Status |
|---|---|
| #497 merge blocker | **Removed** — merged @ `e2f123b0` |
| UAT-005 / FAIL-493-001 same-ID retest | **PASS** on current-main deploy (run 34037424554) |
| Prior preview PASS `9715c20d` | **Preserved** — separate append-only row in `UAT_POST_MERGE_493_PROOF.jsonl` |
| Full auth crawl on current main | **Completed** after UAT-005 PASS (~17m) |
| Authenticated S0–S3 (current-main) | **80 / 131** |
| Verified BLOCKED (credential/deploy) | **46 / 46** — explicit, unchanged |

### GHA run [34037424554](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34037424554) — `post-merge-497-main` @ `e2f123b0`

| Field | Value |
|---|---|
| Duration | ~17m |
| Deploy | `e2f123b0` @ `https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app` |
| Provenance | **Current-main #497 merge certification** — NOT substituting `9715c20d` preview |
| UAT-005 visual | S0 dispatch default · S1 all-tools no Finance · S2 forbidden `/admin/finance` probe · S3 settled redirect |
| Forbidden probes | `/admin/finance`, `/admin/finance-governance`, `/admin/accounts-release` → `/admin/dispatch-mgmt` |
| Artifact | `uat-crawl-evidence-34037424554-1` |
| Evidence commit | `9df732fa` |

**Append-only proof row:** `proof: post-merge-497-main-cert` in `UAT_POST_MERGE_493_PROOF.jsonl` — original FAIL @ `8f042fa` **unchanged**.

## Release hold lifted — targeted post-merge proofs

Prior ace340fe continuation crawl (**80/131** authenticated) preserved with explicit provenance. Current-main rebaseline on `e2f123b0` now has UAT-005 same-ID PASS + full executable auth crawl evidence.

### Continuation crawl (ace340fe fallback)

When `64a107df` has no Vercel deploy, GHA `all` tranche resolves ace340fe continuation URL with provenance in `UAT_DEPLOY_PROVENANCE.json`. Prior ace340fe-era **80/131** evidence preserved append-only.

### GHA run [34023648441](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34023648441) — UAT watchdog `all` tranche (ace340fe continuation)

| Field | Value |
|---|---|
| Duration | 11m28s |
| Deploy | ace340fe `https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app` |
| Provenance | **NOT current-main 64a107df certification** |
| FAIL-493 evidence | **Preserved unchanged** (FAIL @ `8f042fa` run 34015742110; PASS @ `9715c20d` run 34016393457) |
| #497 `fa3b879` | **Not re-run** — newer open-PR head; not substituted for preserved repair proof |
| Artifact | `uat-crawl-evidence-34023648441-1` |

| Tranche | Tests run | Authenticated S0–S3 | Blocked |
|---|---|---:|---|
| AI-UAT UAT-001–010 | 10 pass | **10 / 10** | — |
| post-fix-483 | 2 pass | **0 / 2** | `TEST_SALES_*` |
| auth-rerun | 13 pass | **10 / 13** | UAT-0003 (`TEST_GATE_SECURITY_*`), UAT-0006/0007 (`TEST_BUYER_*`) |
| tranche-03 | 10 pass | **10 / 10** | — |
| tranche-04-auth | 20 pass | **19 / 20** | UAT-0044 (`TEST_SALES_*`) |
| tranche-05-auth | 20 pass | **15 / 20** | RGS/production creds |
| tranche-06-auth | 20 pass | **18 / 20** | RGS/production creds |
| tranche-07-auth | 20 pass | **8 / 20** | TV/RGS creds |
| tranche-08-auth | 21 pass | **0 / 21** | buyer/AI Studio/Trace creds |
| buyer-mobile | 1 pass | **0 / 16 surfaces** | `TEST_BUYER_*` — **no fabricated evidence** |

**Totals:** authenticated S0–S3 **80 / 131** · public continuation **5 / 5** (ace340fe) · verified **BLOCKED 46 / 46** · remaining without auth function evidence **46** (credential/deploy authority)

### GHA confirmation — run [34026395129](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34026395129) @ `46eef121`

Full `all` tranche in **11m43s** — counts unchanged; commit job **no file delta** (identical checksums). Artifact: `uat-crawl-evidence-34026395129-1`.

### Watchdog S1 deepening — run [34028658487](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34028658487) @ `bc699a53`

**11m34s** · **78 new S1 `auth-sidebar-hover` screenshots** on authenticated surfaces (80 auth rows; 2 without sidebar — dispatch/TV). Updated `UAT_MANIFEST_AUTH.jsonl` SHA256 rows. Artifact: `uat-crawl-evidence-34028658487-1`. FAIL-493 not re-run.

### Watchdog S2 deepening — run [34029358388](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34029358388) @ `fe92cfb5`

**13m23s** · ace340fe continuation · artifact `uat-crawl-evidence-34029358388-1` · commit `81272445`

| Metric | Before | After |
|---|---:|---:|
| Authenticated S0–S3 | 80 / 131 | **80 / 131** (unchanged) |
| Authenticated S1 (opened-interactive) | 78 / 80 | **77 / 80** |
| Authenticated S2 (overlay/tab/row/button/card) | 9 / 80 | **72 / 80** |
| Public continuation S0 | 5 / 5 | **5 / 5** |
| Verified BLOCKED | 46 / 46 | **46 / 46** (unchanged) |
| FAIL-493 evidence | preserved | **preserved** — not re-run |

**New S2 screenshots:** 63 authenticated `*S2-auth-*` PNGs with SHA256 manifest rows.

**S1 still absent (no matching nav/sidebar/main control):** UAT-0002 `/operations-controller`, UAT-0080 `/admin/execution/production`, UAT-0094 `/admin/dispatch-mgmt`.

**S2 still absent (full-bleed/TV/war-room layouts):** UAT-0002, UAT-0037, UAT-0038, UAT-0052, UAT-0053, UAT-0061, UAT-0080, UAT-0094.

**Public continuation:** login surfaces redirect before form/link selectors settle — S0 + UAT-0009 S2 only; UAT-0008 S1/S2 remains NOT captured.

**GHA commit-evidence:** succeeded (artifact copy fix).

### S2 gap deepening — run [34034836575](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34034836575) @ `fbcfb504`

**17m17s** · ace340fe continuation · artifact `uat-crawl-evidence-34034836575-1` · commit `8d0d45b9`

| Metric | Before | After |
|---|---:|---:|
| Authenticated S0–S3 | 80 / 131 | **80 / 131** (unchanged) |
| Authenticated S1 | 77 / 80 | **80 / 80** |
| Authenticated S2 | 72 / 80 | **80 / 80** |
| S2 gap targets (8) | 0 / 8 | **8 / 8** |
| Verified BLOCKED | 46 / 46 | **46 / 46** (unchanged) |
| FAIL-493 evidence | preserved | **preserved** — not re-run |

**Gap targets closed:** UAT-0002 (PHH tab), UAT-0037/0038 (page-button-focus on operator inbox), UAT-0052/0053 (overlay-open post-redirect), UAT-0061 (row-hover on TV column), UAT-0080 (PHH tab post-redirect), UAT-0094 (dispatch-order-focus filter-empty).

**Manifest:** `UAT_S2_GAP_DEEPENING_SUMMARY.json` · `UAT_INDEX_S2_GAP_DEEPENING.md`

### Public continuation — ace340fe unblocked surfaces

| UAT ID | Route | Deploy SHA | Result |
|---|---|---|---|
| UAT-0001 | /splash | ace340fe | **OBSERVED** + UX partial (4/148) |
| UAT-0004 | / | ace340fe | **OBSERVED** + UX partial |
| UAT-0005 | /customer-app-redirect | ace340fe | **OBSERVED** + UX partial |
| UAT-0008 | /login | ace340fe | **OBSERVED** + UX partial |
| UAT-0009 | /reset-password | ace340fe | **OBSERVED** + S2 form-focused + UX partial |

**Manifest:** `UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl` · **Screenshots:** `uat-evidence/screenshots/public-continuation/` (SHA256 per row)  
**Provenance:** NOT current-main 64a107df certification · pre-auth tranche-01 preserved

### Verified BLOCKED registry — 46 remaining surfaces

**File:** `UAT_VERIFIED_BLOCKERS.jsonl` · **Summary:** `UAT_VERIFIED_BLOCKERS_SUMMARY.json`  
All 46 credential/deploy-blocked IDs mapped to exact secret names — no fabricated PASS. Buyer mobile (`TEST_BUYER_*`) and post-fix-483 (`TEST_SALES_*`) unchanged.

### FAST PATH A — #493 security (`8f042fa`)

| Field | Value |
|---|---|
| Merge SHA | `3bebf39c7327ed28951d4ad68a8db4c19e0f6717` |
| GitHub deployment ID | **6289603800** |
| Vercel deployment | `BCyAHAee6qn7rg2Cjop91pYaGK93` |
| Verified preview URL | `https://oasis-baklawa-central-omgfjj6e3-oasisbaklawa2006-6222s-projects.vercel.app` |
| Label | **#493 security regression ONLY — NOT current-main certification** |
| Sequence | UAT-005 first → UAT-006–010 if PASS |

### FAST PATH B — #491 KPI (`efd1419`)

| Field | Value |
|---|---|
| Merge on main | `64a107dfc167be76673a3d18f177a72472dcb241` |
| GitHub deployment ID | **6289622998** |
| Verified preview URL | `https://oasis-baklawa-central-adpz5kw86-oasisbaklawa2006-6222s-projects.vercel.app` |
| Target | FAIL-485-001 KPI convergence on **synthetic fixture only** |
| Blocker if absent | `TEST_SALES_*` or cert pending fixture `dc370b46` |

### GHA run [34016393457](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34016393457) — FAIL-493-001 repair retest (#497 @ `9715c20d`)

| UAT ID | Result | Deploy |
|---|---|---|
| UAT-005 | **PASS** | #497 preview `7GCAJ79HNbN5oLDKtbVfefvjkg6q` |
| UAT-006–010 | **PASS (5/5)** | same |

**Artifact:** `uat-crawl-evidence-34016393457-1` · Prior FAIL row @ `8f042fa` preserved in `UAT_POST_MERGE_493_PROOF.jsonl`

### GHA run [34015742110](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34015742110) — post-merge-proofs (original)

| Path | UAT-005 | UAT-006–010 | FAIL-485-001 |
|---|---|---|---|
| FAST PATH A #493 | **FAIL** (5.3s) | **NOT RUN** | — |
| FAST PATH B #491 | — | — | **BLOCKED** (`TEST_SALES_*`) |

**UAT-005 failure:** `/admin/finance must not remain on the forbidden route` on deploy `8f042fa` — **#493 fix NOT proven PASS**.

**Artifact:** `uat-crawl-evidence-34015742110-1`

### Evidence paths (append-only)

- `docs/uat-crawl/UAT_POST_MERGE_493_PROOF.jsonl`
- `docs/uat-crawl/UAT_POST_MERGE_493_SUMMARY.json`
- `docs/uat-crawl/UAT_POST_MERGE_491_PROOF.jsonl`
- `docs/uat-crawl/UAT_POST_MERGE_491_SUMMARY.json`
- `docs/uat-crawl/UAT_GHA_RUN.json`
- `uat-evidence/screenshots/post-merge-491-kpi/` *(empty — FAST PATH B blocked)*

### Prior evidence preserved

Ace340fe-era **80/131** authenticated crawl + all pre-fix/post-fix tranche screenshots unchanged.

## Blocked secret names (values never logged)

| Secret | Blocks |
|---|---|
| `TEST_SALES_*` | FAST PATH B, post-fix-483, buyer-mobile, lane1 sales |
| `TEST_DISPATCH_*` / `TEST_ASSEMBLY_*` | FAST PATH A AI-UAT |
| `TEST_BUYER_*` | buyer-mobile |
| Trusted deploy for `64a107df` | full 131-surface rebaseline |
