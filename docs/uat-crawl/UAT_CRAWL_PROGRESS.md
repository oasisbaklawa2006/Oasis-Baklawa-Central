# UAT Crawl Progress Summary

**Last updated:** 2026-09-05 (watchdog complete)  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Head SHA:** `80e1f1c2` (evidence commit from run 33997683723) · **Durable evidence:** **80 / 131** authenticated S0–S3 · **51 remaining**  
**Mode:** Read-only evidence — **no remediation** in this programme.

## Watchdog resume — complete

Full exhaustive GHA tranche `all` executed on push: **post-fix-483** (UAT-0018/0020 + FAIL-481-* on ace340fe) → auth-rerun → tranche-03..08 → buyer-mobile. Deploy resolution prioritizes **ace340fe** (#483 merge baseline).

**Slot mapping (post-fix #483):** S0 = default/sheet-open · S1 = opened-interactive (pricing dropdown) · S2 = opened-interactive (slab + AM options) · S3 = action-result (Approve enabled, HUMAN-GATED — no click).

## GHA execution log

| Run ID | Result | Tranche | Target URL | Duration |
|---:|---|---|---|---|
| [33991923048](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33991923048) | FAIL | `all` | — | `TEST_PREVIEW_URL` missing; early exit |
| [33992154092](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33992154092) | SUCCESS | `all` | ace340fe Vercel | 3m16s — first authenticated evidence |
| [33992541830](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33992541830) | SUCCESS | `all` | ace340fe Vercel | 4m7s — refreshed tranches 01–03 |
| [33993426177](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33993426177) | PARTIAL | `all` | ace340fe Vercel | 54s — compile error (duplicate `routeSlug`) |
| [33993499287](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33993499287) | SUCCESS | `all` | ace340fe Vercel deploy | 10m6s — tranche 04–08 + full rerun committed |
| [33996335627](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33996335627) | SUCCESS | `buyer-mobile` | ace340fe Vercel | ~53s — buyer harness; 0/16 authenticated |
| **[33997683723](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33997683723)** | **SUCCESS** | **`all`** | **ace340fe Vercel deploy** | **9m54s — watchdog full rerun + evidence commit** |

**Deploy target (ace340fe):** `https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app`  
**Artifact:** `uat-crawl-evidence-33997683723-1`

## Coverage after run 33997683723

| Tranche | UAT range | Authenticated S0–S3 | Blocked |
|---|---|---:|---|
| post-fix-483 | UAT-0018, 0020 | **0 / 2** | `TEST_SALES_EMAIL`, `TEST_SALES_PASSWORD` |
| auth-rerun | 13 targets | **10 / 13** | UAT-0003, 0006, 0007 |
| tranche-03-auth | UAT-0021..0030 | **10 / 10** | — |
| tranche-04-auth | UAT-0031..0050 | **19 / 20** | UAT-0044 (`TEST_SALES_*`) |
| tranche-05-auth | UAT-0051..0070 | **15 / 20** | UAT-0062–0065, 0067 (`TEST_RGS_*`, `TEST_PRODUCTION_*`) |
| tranche-06-auth | UAT-0071..0090 | **18 / 20** | UAT-0082, 0087 (`TEST_RGS_*`) |
| tranche-07-auth | UAT-0091..0110 | **8 / 20** | UAT-0097–0101, 0104–0105, 0106–0110 |
| tranche-08-auth | UAT-0111..0131 | **0 / 21** | TV/buyer/ai-studio/trace deploy + cred blockers |
| buyer-mobile | 16 surfaces | **0 / 16** | `TEST_BUYER_*` |
| Pre-auth (preserved) | UAT-0001..0020 | 20 login-gate | — |
| **Authenticated complete (131 census)** | | **80 / 131** | |
| **Remaining without auth function evidence** | | | **51** |

### Post-fix #483 disposition (run 33997683723)

| UAT-ID | Deploy | S0–S3 | FAIL-481-* / FAIL-UX-481-* | Notes |
|---|---|---|---|---|
| UAT-0018 | ace340fe | **BLOCKED** | **OPEN** (retest BLOCKED) | Pre-fix tranche-02 preserved; no post-fix screenshots |
| UAT-0020 | ace340fe | **BLOCKED** | **OPEN** (retest BLOCKED) | Pre-fix tranche-02 preserved; no post-fix screenshots |

**Blocker:** `TEST_SALES_EMAIL`, `TEST_SALES_PASSWORD` not present in repo secrets. Physical iPhone recording remains provisional only — governed crawl required to close FAIL-481-*.

### Authenticated IDs completed (80 total)

UAT-0002, 0010–0017, 0019, 0021–0043, 0045–0061, 0066, 0068–0070, 0071–0081, 0083–0086, 0088–0096, 0102–0103

### Still blocked (secret names only — values never logged)

| Secret pair / deploy URL | UAT IDs |
|---|---|
| `TEST_SALES_EMAIL` / `TEST_SALES_PASSWORD` | UAT-0018, 0020 (post-fix #483), 0044, 0104, 0105 |
| `TEST_BUYER_EMAIL` / `TEST_BUYER_PASSWORD` | UAT-0006, 0007, 0114–0121 + buyer-mobile surfaces |
| `TEST_GATE_SECURITY_EMAIL` / `TEST_GATE_SECURITY_PASSWORD` | UAT-0003 |
| `TEST_RGS_EMAIL` / `TEST_RGS_PASSWORD` | UAT-0062–0065, 0082, 0087 |
| `TEST_PRODUCTION_EMAIL` / `TEST_PRODUCTION_PASSWORD` | UAT-0067, 0097–0101 |
| `TEST_TV_RGS_EMAIL` / `TEST_TV_RGS_PASSWORD` | UAT-0106–0112 |
| `TEST_TV_PRODUCTION_EMAIL` / `TEST_TV_PRODUCTION_PASSWORD` | UAT-0113 |
| `TEST_AI_STUDIO_PREVIEW_URL` | UAT-0122–0127 |
| `TEST_TRACE_PREVIEW_URL` | UAT-0128–0131 |
| `TEST_PREVIEW_URL` | auto-resolved from ace340fe Vercel deployment |

Public/pre-auth-only (no role-surface auth required): UAT-0001, 0004, 0005, 0008, 0009 — pre-auth tranche-01 preserved.

## Evidence locations

| Phase | Path | Manifest |
|---|---|---|
| post-fix-483 | `uat-evidence/screenshots/post-fix-483/` (empty — cred blocked) | `UAT_MANIFEST_POST_FIX_483.jsonl` |
| auth-rerun | `uat-evidence/screenshots/auth-rerun/` | `UAT_MANIFEST_AUTH.jsonl` |
| tranche-03-auth … 08-auth | `uat-evidence/screenshots/tranche-03-auth/` … `tranche-08-auth/` | append |
| buyer-mobile | `uat-evidence/screenshots/buyer-mobile-auth/` (empty — cred blocked) | `UAT_MANIFEST_BUYER_MOBILE.jsonl` |
| GHA artifact | `uat-crawl-evidence-33997683723-1` | immutable workflow bundle |

**Screenshot count:** ~190 PNG files with SHA256 checksum rows in manifests (Central admin surfaces only).

## External physical evidence

iPhone recording → [`UAT_PHYSICAL_EVIDENCE_EXTERNAL.md`](./UAT_PHYSICAL_EVIDENCE_EXTERNAL.md). **FAIL-485-001** (KPI stale post-approval) → Central **#485**. FAIL-481-* / FAIL-UX-481-* remain **OPEN** until `TEST_SALES_*` post-fix S0–S3 captured on deployed main.

## Buyer mobile crawl (PR #10 @ `0015e7b5`)

Harness executed in run 33997683723; **0 / 16 surfaces authenticated** (all BLOCKED on missing `TEST_BUYER_*`).

| Artifact | Path |
|---|---|
| Surface map | `docs/uat-crawl/UAT_BUYER_MOBILE_TARGETS.json` |
| Manifest | `docs/uat-crawl/UAT_MANIFEST_BUYER_MOBILE.jsonl` |
| Summary | `docs/uat-crawl/UAT_BUYER_MOBILE_SUMMARY.json` |
| Index | `docs/uat-crawl/UAT_INDEX_BUYER_MOBILE_AUTH.md` |
| Screenshots | `uat-evidence/screenshots/buyer-mobile-auth/` (empty until creds provisioned) |

Golden-path certification (PR #10 @ `0f81448`) uses **ephemeral synthetic buyer** credentials in CI — it does not populate `TEST_BUYER_*` repo secrets for this crawl.

## Next (operator / Mission Control)

1. Add missing repo secrets (`TEST_SALES_*`, `TEST_BUYER_*`, lane1 `TEST_RGS_*` / `TEST_PRODUCTION_*` / `TEST_TV_*`, plus ai-studio/trace preview URLs) → re-run `all` tranche on this branch  
2. Post-fix #483 re-test closes FAIL-481-* only after governed authenticated S0–S3 on ace340fe deploy with `TEST_SALES_*`  
3. Buyer mobile visual UAT requires `TEST_BUYER_*` — PR #10 merge/cert does not substitute
