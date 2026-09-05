# UAT Crawl Progress Summary

**Last updated:** 2026-09-05  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Mode:** Read-only evidence — **no remediation** in this programme.

## GHA execution log

| Run ID | SHA | Tranche | Result | Notes |
|---:|---|---|---|---|
| [33991923048](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33991923048) | `995e6c0a` | `all` | **FAIL** | `TEST_PREVIEW_URL` secret missing — early exit before crawl |
| [33991965797](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33991965797) | `bb6ea2f1` | `all` | **PARTIAL** | post-fix-483 ✓ (blocked on `TEST_SALES_*`); auth-rerun ✗ (e2e hostname guard); tranche-03 skipped |

**Run 33991965797 secret report (names only):**

| Status | Secrets |
|---|---|
| **present** | `TEST_ADMIN_*`, `TEST_FINANCE_*`, `TEST_ASSEMBLY_*`, `TEST_DISPATCH_*`, `TEST_OPERATIONS_*` |
| **missing** | `TEST_PREVIEW_URL`, `TEST_BUYER_*`, `TEST_SALES_*`, `TEST_GATE_SECURITY_*` |

Production fallback URL used: `https://b2b.oasisbaklawa.com` (deploy ace340fe).

**Agent workflow_dispatch:** HTTP 403 — lacks `actions:write`; push trigger used instead.

## Coverage (after run 33991965797)

| Metric | Count |
|---|---:|
| Pre-auth screenshots | **20 / 131** |
| Post-fix #483 S0–S3 | **0 / 2** — blocked `TEST_SALES_EMAIL`, `TEST_SALES_PASSWORD` |
| Auth-rerun S0–S3 | **0 / 13** — blocked by e2e hostname guard (fixed in next push) |
| Tranche-03 | **0 / 10** — not reached |
| Remaining untested | **111** |

## External physical evidence

iPhone recording mapped in [`UAT_PHYSICAL_EVIDENCE_EXTERNAL.md`](./UAT_PHYSICAL_EVIDENCE_EXTERNAL.md). **FAIL-485-001** (KPI stale) → Central **#485**.

## Operator actions required

1. Add repo secrets: **`TEST_SALES_EMAIL`**, **`TEST_SALES_PASSWORD`** (blocks UAT-0018/0020 post-fix #483)
2. Optional: **`TEST_PREVIEW_URL`** = `https://b2b.oasisbaklawa.com` (fallback already used when absent)
3. Optional: **`TEST_BUYER_*`**, **`TEST_GATE_SECURITY_*`** for UAT-0006/0007/0003

Third GHA run in progress after `UAT_CRAWL_PRODUCTION` hostname fix + continue-on-error tranches.
