# UAT Crawl Progress Summary

**Last updated:** 2026-09-05  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Mode:** Read-only evidence — **no remediation** in this programme.

## GHA execution log

| Run ID | Trigger | Tranche | Result | Blocker |
|---:|---|---|---|---|
| [33991923048](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33991923048) | push @ `995e6c0a` | `all` | **FAIL** (early exit) | `TEST_PREVIEW_URL` secret missing — fixed in next push with production fallback + secret report first |

**Workflow dispatch from agent:** HTTP 403 — token lacks `actions:write` / workflow not on default branch. Push trigger used instead.

## Coverage

| Metric | Count |
|---|---:|
| Census total | 131 |
| Pre-auth screenshots (tranche 01–02) | **20** |
| Post-fix #483 targets | **2** (UAT-0018 + UAT-0020) |
| Post-fix S0–S3 complete | **0** — pending `TEST_SALES_*` in GHA |
| Authenticated auth-rerun targets | **13** |
| Authenticated S0–S3 complete | **0** — pending role secrets in GHA |
| Remaining untested | **111** |

## External physical evidence (iPhone)

Operator recording mapped in [`UAT_PHYSICAL_EVIDENCE_EXTERNAL.md`](./UAT_PHYSICAL_EVIDENCE_EXTERNAL.md). Overlay failures **provisional PASS** pending governed re-crawl. **FAIL-485-001** (KPI stale after approval) routed to Central **#485**.

## Required repo secrets (names only)

| Secret | Blocks |
|---|---|
| `TEST_PREVIEW_URL` | All crawls (fallback: `https://b2b.oasisbaklawa.com` when absent) |
| `TEST_SALES_EMAIL` / `TEST_SALES_PASSWORD` | UAT-0018, 0020 post-fix #483 |
| `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` | UAT-0010, 0011, 0015–0017, 0019 |
| `TEST_BUYER_EMAIL` / `TEST_BUYER_PASSWORD` | UAT-0006, 0007 |
| `TEST_FINANCE_EMAIL` / `TEST_FINANCE_PASSWORD` | UAT-0013, 0014 |
| `TEST_ASSEMBLY_EMAIL` / `TEST_ASSEMBLY_PASSWORD` | UAT-0012 |
| `TEST_OPERATIONS_EMAIL` / `TEST_OPERATIONS_PASSWORD` | UAT-0002 |
| `TEST_DISPATCH_EMAIL` / `TEST_DISPATCH_PASSWORD` | tranche-03 dispatch routes |
| `TEST_GATE_SECURITY_EMAIL` / `TEST_GATE_SECURITY_PASSWORD` | UAT-0003 — not wired in repo |

## Next

Re-run in progress after workflow fix — push triggers `all` tranche on this branch.
