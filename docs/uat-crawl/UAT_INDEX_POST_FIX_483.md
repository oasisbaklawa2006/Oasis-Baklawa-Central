# UAT Visual + UX Crawl Index — post-fix-483

**UAT range:** UAT-0018 + UAT-0020 (current main #490 @ 67b3d1cc)
**Crawl base URL:** https://oasis-baklawa-central-hvbmnekge-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-08T14:42:24.516Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0018 | [UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-sheet-open.png](../../uat-evidence/screenshots/post-fix-483/UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-sheet-open.png) | /admin/clients | sheet-review-open | OBSERVED | BLOCKED | PARTIAL | 4/148 | 0 | Post-fix #483 deploy a619a7a2. Fixture ref dc370b46-ae3 |
| UAT-0020 | [UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-sheet-open.png](../../uat-evidence/screenshots/post-fix-483/UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-sheet-open.png) | /admin/approvals | sheet-review-open | OBSERVED | BLOCKED | PARTIAL | 4/148 | 0 | Post-fix #483 deploy a619a7a2. Fixture ref dc370b46-ae3 |

**Pre-fix evidence preserved** in `tranche-02/` — not overwritten.
**Post-fix deploy SHA:** `a619a7a2ef01ee889d32fffebb5ff13fe3181252` (current main; ace340fe not reused as post-#490 evidence)
**Re-tested FAIL-IDs:** FAIL-481-001, FAIL-481-002, FAIL-UX-481-001, FAIL-UX-481-002
**Authenticated S0–S3 complete:** 0 / 2
**Credentials present — post-fix evidence captured.**
**No FAIL-IDs closed yet** — run with secrets on current-main deploy at 67b3d1cc.
**S3 rule:** Approve & Activate enabled evidence only — button NOT clicked (HUMAN-GATED).
