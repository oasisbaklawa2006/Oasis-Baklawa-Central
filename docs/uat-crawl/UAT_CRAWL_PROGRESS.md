# UAT Crawl Progress Summary

**Last updated:** 2026-09-06 (watchdog S1 deepening + GHA re-crawl pending)  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Current main (HELD):** `64a107dfc167be76673a3d18f177a72472dcb241` (#491) — **NOT deployed on Vercel**  
**#497 repair preview (open PR):** `fa3b87992720902efbeee3467905aa3493fff431` — **NOT current-main certification**  
**Preserved FAIL-493 repair proof:** `9715c20d` run [34016393457](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34016393457) — **unchanged**  
**Mode:** Read-only evidence — **no remediation** in this programme.

## Release hold lifted — targeted post-merge proofs

Full **131-surface current-main rebaseline HELD** until trusted Vercel deploy exists for `64a107df`. Chronological continuation crawl may use ace340fe fallback with explicit provenance — **NOT** current-main certification.

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

Re-ran `all` tranche after workflow default change — **no new screenshots** (identical ace340fe evidence). Metadata-only refresh superseded by public continuation below.

### Public continuation — ace340fe unblocked surfaces (local + GHA pending)

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
