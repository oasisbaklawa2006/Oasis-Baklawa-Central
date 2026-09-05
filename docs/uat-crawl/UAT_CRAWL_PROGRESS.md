# UAT Crawl Progress Summary

**Last updated:** 2026-09-05  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Head SHA:** `1e330f52` (evidence from GHA run **33992154092**)  
**Mode:** Read-only evidence — **no remediation** in this programme.

## GHA execution log

| Run ID | Result | Tranche | Target URL | Duration |
|---:|---|---|---|---|
| [33991923048](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33991923048) | FAIL | `all` | — | `TEST_PREVIEW_URL` missing; early exit |
| [33991965797](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33991965797) | PARTIAL | `all` | `b2b.oasisbaklawa.com` | post-fix ✓; auth ✗ hostname guard; tranche-03 skipped |
| [33992056005](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33992056005) | PARTIAL | `all` | `b2b.oasisbaklawa.com` | SSL handshake failure from GHA |
| **[33992154092](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33992154092)** | **SUCCESS** | **`all`** | **`ace340fe` Vercel deploy** | **3m16s — evidence committed** |

**Successful run 33992154092** resolved deploy URL for `ace340fe1d122a4cce5d7bb61cd237ed7ba1c894`:
`https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app`

(`b2b.oasisbaklawa.com` TLS handshake fails from GitHub-hosted runners.)

## Coverage after run 33992154092

| Tranche | UAT IDs | Authenticated S0–S3 | Blocked |
|---|---|---:|---|
| post-fix-483 | UAT-0018, 0020 | **0 / 2** | `TEST_SALES_EMAIL`, `TEST_SALES_PASSWORD` |
| auth-rerun | 13 targets | **10 / 13** | UAT-0003 (`TEST_GATE_SECURITY_*`), 0006/0007 (`TEST_BUYER_*`) |
| tranche-03-auth | UAT-0021..0030 | **10 / 10** | — |
| Pre-auth (preserved) | UAT-0001..0020 | 20 login-gate | — |
| **Remaining untested** | UAT-0031..0131 | | **101** |

### Authenticated IDs completed (run 33992154092)

**auth-rerun:** UAT-0002, UAT-0010, UAT-0011, UAT-0012, UAT-0013, UAT-0014, UAT-0015, UAT-0016, UAT-0017, UAT-0019

**tranche-03:** UAT-0021, UAT-0022, UAT-0023, UAT-0024, UAT-0025, UAT-0026, UAT-0027, UAT-0028, UAT-0029, UAT-0030

### Still blocked (secret names only)

| Secret pair | UAT IDs |
|---|---|
| `TEST_SALES_EMAIL` / `TEST_SALES_PASSWORD` | UAT-0018, 0020 post-fix #483 |
| `TEST_BUYER_EMAIL` / `TEST_BUYER_PASSWORD` | UAT-0006, 0007 |
| `TEST_GATE_SECURITY_EMAIL` / `TEST_GATE_SECURITY_PASSWORD` | UAT-0003 |
| `TEST_PREVIEW_URL` | missing (Vercel deploy URL auto-resolved) |

## Evidence locations

| Phase | Path | Manifest |
|---|---|---|
| post-fix-483 | `uat-evidence/screenshots/post-fix-483/` | `UAT_MANIFEST_POST_FIX_483.jsonl` |
| auth-rerun | `uat-evidence/screenshots/auth-rerun/` | `UAT_MANIFEST_AUTH.jsonl` |
| tranche-03-auth | `uat-evidence/screenshots/tranche-03-auth/` | `UAT_MANIFEST_AUTH.jsonl` (append) |
| GHA artifact | `uat-crawl-evidence-33992154092-1` | immutable workflow bundle |

## External physical evidence

iPhone recording → [`UAT_PHYSICAL_EVIDENCE_EXTERNAL.md`](./UAT_PHYSICAL_EVIDENCE_EXTERNAL.md). **FAIL-485-001** (KPI stale post-approval) → Central **#485**. FAIL-481-* / FAIL-UX-481-* remain **OPEN** until `TEST_SALES_*` post-fix S0–S3 captured.

## Next

1. Operator adds **`TEST_SALES_EMAIL`** / **`TEST_SALES_PASSWORD`** → re-run `post-fix-483` tranche  
2. Continue chronological crawl UAT-0031+ on next push or workflow dispatch
