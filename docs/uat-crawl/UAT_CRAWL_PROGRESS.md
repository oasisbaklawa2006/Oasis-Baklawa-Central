# UAT Crawl Progress Summary

**Last updated:** 2026-09-05  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Mode:** Read-only evidence — **no remediation** in this programme.

## Coverage

| Metric | Count |
|---|---:|
| Census total | 131 |
| Pre-auth screenshots (tranche 01–02) | **20** |
| Authenticated auth-rerun targets | **15** (UAT-0002..0020 subset) |
| Authenticated complete (S0–S3 in `auth-rerun/`) | **0** — pending GHA secrets |
| Remaining untested | **111** (UAT-0021..0131 pre-auth; 101 after tranche-03 auth) |

## Evidence locations

| Phase | Path | Manifest |
|---|---|---|
| Pre-auth tranche 01 | `uat-evidence/screenshots/tranche-01/` | `UAT_MANIFEST.jsonl` |
| Pre-auth tranche 02 | `uat-evidence/screenshots/tranche-02/` | `UAT_MANIFEST.jsonl` |
| **Authenticated repair** | `uat-evidence/screenshots/auth-rerun/` | `UAT_MANIFEST_AUTH.jsonl` |
| Auth rerun summary | `docs/uat-crawl/UAT_AUTH_RERUN_SUMMARY.json` | — |

## Run authenticated crawl (GitHub Actions)

Workflow: [`.github/workflows/uat-crawl-evidence.yml`](../.github/workflows/uat-crawl-evidence.yml)

```bash
# Manual dispatch on PR branch — uses TEST_PREVIEW_URL + TEST_* secrets (names only logged)
npm run test:uat-auth-rerun   # local when secrets exported
npm run test:uat-tranche-03   # UAT-0021..0030 authenticated continue
```

**Rule:** Login-gate captures ≠ authenticated function/UX tested. Pre-auth shots preserved; auth evidence uses separate folder.

## Blockers (secret names only — values never logged)

| Secret pair | UAT IDs affected |
|---|---|
| `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` | UAT-0010, 0011, 0015–0017, 0019 |
| `TEST_BUYER_EMAIL` / `TEST_BUYER_PASSWORD` | UAT-0006, 0007 |
| `TEST_SALES_EMAIL` / `TEST_SALES_PASSWORD` | UAT-0018, 0020 (+ #483 sheet overlay re-test post-deploy) |
| `TEST_FINANCE_EMAIL` / `TEST_FINANCE_PASSWORD` | UAT-0013, 0014 |
| `TEST_ASSEMBLY_EMAIL` / `TEST_ASSEMBLY_PASSWORD` | UAT-0012 |
| `TEST_OPERATIONS_EMAIL` / `TEST_OPERATIONS_PASSWORD` | UAT-0002 |
| `TEST_GATE_SECURITY_EMAIL` / `TEST_GATE_SECURITY_PASSWORD` | UAT-0003 — **not wired in repo** |

## Next

1. Dispatch **UAT Crawl Evidence** workflow with `TEST_PREVIEW_URL` + role secrets  
2. Re-run auth-rerun → expect S0–S3 in `auth-rerun/` per ID  
3. Continue tranche-03 auth (UAT-0021..0030) then UAT-0031+
