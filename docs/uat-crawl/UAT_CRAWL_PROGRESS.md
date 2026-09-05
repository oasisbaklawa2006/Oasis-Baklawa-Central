# UAT Crawl Progress Summary

**Last updated:** 2026-09-05  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Mode:** Read-only evidence — **no remediation** in this programme.

## Coverage

| Metric | Count |
|---|---:|
| Census total | 131 |
| Pre-auth screenshots (tranche 01–02) | **20** |
| Authenticated auth-rerun targets | **13** (UAT-0002..0020 minus UAT-0018/0020 buyer sheet) |
| Post-fix #483 targets | **2** (UAT-0018 + UAT-0020 — SAME FAIL-481-* / FAIL-UX-481-*) |
| Authenticated complete (S0–S3 in `auth-rerun/`) | **0** — pending GHA secrets |
| Post-fix #483 complete (S0–S3 in `post-fix-483/`) | **0** — pending GHA secrets + main deploy URL |
| Remaining untested | **111** (UAT-0021..0131) |

## #483 deploy gate

| Item | Status |
|---|---|
| Issue **#483** merged | **YES** |
| Main deploy SHA | `ace340fe1d122a4cce5d7bb61cd237ed7ba1c894` (Vercel SUCCESS) |
| Pre-fix FAIL-IDs preserved | FAIL-481-001/002, FAIL-UX-481-001/002 |
| Post-fix re-test harness | `npm run test:uat-post-fix-483` → `post-fix-483/` |
| S3 approval click | **HUMAN-GATED** — enabled-button evidence only |

## Evidence locations

| Phase | Path | Manifest |
|---|---|---|
| Pre-auth tranche 01 | `uat-evidence/screenshots/tranche-01/` | `UAT_MANIFEST.jsonl` |
| Pre-auth tranche 02 | `uat-evidence/screenshots/tranche-02/` | `UAT_MANIFEST.jsonl` |
| **Post-fix #483** | `uat-evidence/screenshots/post-fix-483/` | `UAT_MANIFEST_POST_FIX_483.jsonl` |
| Authenticated repair | `uat-evidence/screenshots/auth-rerun/` | `UAT_MANIFEST_AUTH.jsonl` |
| Post-fix summary | `docs/uat-crawl/UAT_POST_FIX_483_SUMMARY.json` | — |
| Auth rerun summary | `docs/uat-crawl/UAT_AUTH_RERUN_SUMMARY.json` | — |

## Run authenticated crawl (GitHub Actions)

Workflow: [`.github/workflows/uat-crawl-evidence.yml`](../.github/workflows/uat-crawl-evidence.yml)

```bash
# Post-fix #483 buyer sheet (UAT-0018 + UAT-0020) — TEST_SALES_* + TEST_PREVIEW_URL at ace340fe
npm run test:uat-post-fix-483

# Auth repair (13 IDs — excludes buyer sheet)
npm run test:uat-auth-rerun

# Chronological continue UAT-0021..0030
npm run test:uat-tranche-03
```

**Rule:** Login-gate captures ≠ authenticated function/UX tested. Pre-fix tranche-02 preserved; post-fix uses separate folder.

## Blockers (secret names only — values never logged)

| Secret pair | UAT IDs affected |
|---|---|
| `TEST_PREVIEW_URL` | All authenticated crawls — point at main deploy `ace340fe` |
| `TEST_SALES_EMAIL` / `TEST_SALES_PASSWORD` | **UAT-0018, 0020** post-fix #483 re-test |
| `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` | UAT-0010, 0011, 0015–0017, 0019 |
| `TEST_BUYER_EMAIL` / `TEST_BUYER_PASSWORD` | UAT-0006, 0007 |
| `TEST_FINANCE_EMAIL` / `TEST_FINANCE_PASSWORD` | UAT-0013, 0014 |
| `TEST_ASSEMBLY_EMAIL` / `TEST_ASSEMBLY_PASSWORD` | UAT-0012 |
| `TEST_OPERATIONS_EMAIL` / `TEST_OPERATIONS_PASSWORD` | UAT-0002 |
| `TEST_GATE_SECURITY_EMAIL` / `TEST_GATE_SECURITY_PASSWORD` | UAT-0003 — **not wired in repo** |

## Next

1. Dispatch **UAT Crawl Evidence** with `run_tranche: post-fix-483` (or `all`) on deploy URL at `ace340fe`  
2. Verify FAIL-481-* / FAIL-UX-481-* **CLOSED** or record regression with post-fix screenshots  
3. Run auth-rerun + tranche-03 to continue chronological 131-ID programme
