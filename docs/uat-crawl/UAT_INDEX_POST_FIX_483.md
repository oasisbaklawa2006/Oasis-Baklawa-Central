# UAT Visual + UX Crawl Index — post-fix-483

**UAT range:** UAT-0018 + UAT-0020 (current main @ 4e16ae5f)
**Crawl base URL:** https://oasis-baklawa-central.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-28T16:29:39.026Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0018 | [UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-sheet-open.png](../../uat-evidence/screenshots/post-fix-483/UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-sheet-open.png) | /admin/clients | sheet-review-open | OBSERVED | BLOCKED | PARTIAL | 4/148 | 0 | Post-fix #483 deploy 4e16ae5f. Fixture ref dc370b46-ae3 |
| UAT-0020 | [UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-sheet-open.png](../../uat-evidence/screenshots/post-fix-483/UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-sheet-open.png) | /admin/approvals | sheet-review-open | OBSERVED | BLOCKED | PARTIAL | 4/148 | 0 | Post-fix #483 deploy 4e16ae5f. Fixture ref dc370b46-ae3 |

**Pre-fix evidence preserved** in `tranche-02/` — not overwritten.
**Post-fix deploy SHA:** `4e16ae5f434cdeb4449e077a50c828a89e51316c` (current main resolved at run time)
**Re-tested FAIL-IDs:** FAIL-481-001, FAIL-481-002, FAIL-UX-481-001, FAIL-UX-481-002
**Authenticated S0–S3 complete:** 0 / 2
**Credentials present — post-fix evidence captured.**
**No FAIL-IDs closed yet** — run with secrets on current-main deploy @ 4e16ae5f.
**S3 rule:** Approve & Activate enabled evidence only — button NOT clicked (HUMAN-GATED).
