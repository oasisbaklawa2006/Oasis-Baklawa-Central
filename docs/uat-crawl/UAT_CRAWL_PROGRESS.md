# UAT Crawl Progress Summary

**Last updated:** 2026-09-05 (#490 rebaseline execution)  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Rebased onto main:** `67b3d1cc0baf7d494cb7a00ce55a74f16b6af43b` (#490)  
**Mode:** Read-only evidence — **no remediation** in this programme.

## #490 rebaseline execution — run [33999620404](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33999620404)

**Branch rebased onto main `67b3d1cc`** · **Head `b2566f32`** · **Artifact:** `uat-crawl-evidence-33999620404-1`

| Tranche | Result | PASS | FAIL | BLOCKED | Notes |
|---|---|---:|---:|---:|---|
| AI-UAT UAT-001–010 | deploy BLOCKED | 0 | 0 | **10** | No `67b3d1cc` Vercel URL; ace340fe not used |
| post-fix-483 | not executed | 0 | 0 | 2 | deploy BLOCKED (+ `TEST_SALES_*` missing) |
| 131-surface auth crawl | not re-run | — | — | — | Prior **80/131** ace340fe evidence preserved |
| buyer-mobile | not executed | 0 | 0 | 16 | deploy BLOCKED (+ `TEST_BUYER_*` missing) |

**Deploy provenance:** `docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json`  
**New screenshots:** 0 (no fabricated PASS)  
**Secrets present but unusable without deploy:** `TEST_DISPATCH_*`, `TEST_ASSEMBLY_*`, `TEST_ADMIN_*`, `TEST_FINANCE_*`, `TEST_OPERATIONS_*`

## #490 rebaseline policy

- **Current trusted deploy target:** main `67b3d1cc` only — **ace340fe not reused** as post-#490 evidence.
- **Prior evidence preserved:** all tranche-01..08, auth-rerun, post-fix-483 pre-fix tranche-02 screenshots/checksums remain committed (append-only).
- **If Vercel rate-limited:** record **BLOCKED** with exact deploy provenance; do not substitute legacy ace340fe URL as PASS.

## Durable evidence (pre-#490 rebaseline crawl)

| Metric | Count |
|---|---:|
| Authenticated S0–S3 (131 census, ace340fe-era) | **80 / 131** |
| Remaining without auth function evidence | **51** |
| Screenshot PNGs (Central admin, preserved) | ~190 |

## AI-UAT UAT-001–010

Governed tranche wired into `uat-crawl-evidence.yml` (`ai-uat` / `all`). Evidence paths:

- `docs/uat-crawl/UAT_MANIFEST_AI_UAT.jsonl`
- `docs/uat-crawl/UAT_AI_UAT_SUMMARY.json`
- `docs/uat-crawl/UAT_AI_UAT_REPORT.md`
- `docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json`

## Blocked secret names (values never logged)

| Secret | UAT IDs |
|---|---|
| `TEST_SALES_*` | 0018, 0020, 0044, 0104, 0105 |
| `TEST_BUYER_*` | 0006, 0007, 0114–0121 + buyer-mobile |
| `TEST_GATE_SECURITY_*` | 0003 |
| `TEST_RGS_*` | 0062–0065, 0082, 0087 |
| `TEST_PRODUCTION_*` | 0067, 0097–0101 |
| `TEST_TV_*` | 0106–0113 |
| `TEST_AI_STUDIO_PREVIEW_URL` | 0122–0127 |
| `TEST_TRACE_PREVIEW_URL` | 0128–0131 |
| `TEST_DISPATCH_*` / `TEST_ASSEMBLY_*` | AI-UAT UAT-001–010 (when deploy available) |

## Evidence locations (preserved + append)

| Phase | Path |
|---|---|
| Pre-auth tranche-01/02 | `uat-evidence/screenshots/tranche-01/` … `tranche-02/` |
| ace340fe-era auth crawl | `uat-evidence/screenshots/auth-rerun/` … `tranche-08-auth/` |
| post-fix-483 | `uat-evidence/screenshots/post-fix-483/` |
| buyer-mobile | `uat-evidence/screenshots/buyer-mobile-auth/` |
| AI-UAT (#490) | append via `UAT_MANIFEST_AI_UAT.jsonl` |
