# UAT Visual + UX Crawl Index — post-fix-483

**UAT range:** UAT-0018 + UAT-0020 (current main #490 @ 67b3d1cc)
**Crawl base URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-06T16:52:19.786Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0018 | [UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-default.png (pre-fix preserved)](../../uat-evidence/screenshots/tranche-02/UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-default.png (pre-fix preserved)) | /admin/clients | sheet-review-open | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | POST-FIX #483 BLOCKED — missing TEST_SALES_EMAIL, TEST_ |
| UAT-0020 | [UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-default.png (pre-fix preserved)](../../uat-evidence/screenshots/tranche-02/UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-default.png (pre-fix preserved)) | /admin/approvals | sheet-review-open | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | POST-FIX #483 BLOCKED — missing TEST_SALES_EMAIL, TEST_ |

**Pre-fix evidence preserved** in `tranche-02/` — not overwritten.
**Post-fix deploy SHA:** `e2f123b0fe257b8a1f39ec40d5f544fff1ebe313` (current main; ace340fe not reused as post-#490 evidence)
**Re-tested FAIL-IDs:** FAIL-481-001, FAIL-481-002, FAIL-UX-481-001, FAIL-UX-481-002
**Authenticated S0–S3 complete:** 0 / 2
**Blocked:** missing TEST_SALES_EMAIL / TEST_SALES_PASSWORD and/or TEST_PREVIEW_URL — dispatch GHA workflow on main deploy URL.
**No FAIL-IDs closed yet** — run with secrets on current-main deploy at 67b3d1cc.
**S3 rule:** Approve & Activate enabled evidence only — button NOT clicked (HUMAN-GATED).
