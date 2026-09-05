# UAT Visual + UX Crawl Index — post-fix-483

**UAT range:** UAT-0018 + UAT-0020 (#483 deploy ace340fe)
**Crawl base URL:** https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-05T21:08:57.718Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0018 | [UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-default.png (pre-fix preserved)](../../uat-evidence/screenshots/tranche-02/UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-default.png (pre-fix preserved)) | /admin/clients | sheet-review-open | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | POST-FIX #483 BLOCKED — missing TEST_SALES_EMAIL, TEST_ |
| UAT-0020 | [UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-default.png (pre-fix preserved)](../../uat-evidence/screenshots/tranche-02/UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-default.png (pre-fix preserved)) | /admin/approvals | sheet-review-open | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | POST-FIX #483 BLOCKED — missing TEST_SALES_EMAIL, TEST_ |

**Pre-fix evidence preserved** in `tranche-02/` — not overwritten.
**Post-fix deploy SHA:** `ace340fe1d122a4cce5d7bb61cd237ed7ba1c894`
**Re-tested FAIL-IDs:** FAIL-481-001, FAIL-481-002, FAIL-UX-481-001, FAIL-UX-481-002
**Authenticated S0–S3 complete:** 0 / 2
**Blocked:** missing TEST_SALES_EMAIL / TEST_SALES_PASSWORD and/or TEST_PREVIEW_URL — dispatch GHA workflow on main deploy URL.
**No FAIL-IDs closed yet** — run with secrets on production/preview at ace340fe.
**S3 rule:** Approve & Activate enabled evidence only — button NOT clicked (HUMAN-GATED).
