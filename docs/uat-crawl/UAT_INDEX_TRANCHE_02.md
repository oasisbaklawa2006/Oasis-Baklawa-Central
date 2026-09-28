# UAT Visual + UX Crawl Index — tranche-02

**UAT range:** UAT-0011..0020
**Crawl base URL:** https://oasis-baklawa-centra-git-b9f168-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-05T19:53:01.259Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0011 | [UAT-0011_central_admin_staff_admin-customers-default_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0011_central_admin_staff_admin-customers-default_S0-default.png) | /admin/customers | default | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Navigate redirect — capture destination in function cra |
| UAT-0012 | [UAT-0012_central_p_and_a_admin-assembly-default_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0012_central_p_and_a_admin-assembly-default_S0-default.png) | /admin/assembly | default | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Navigate redirect — capture destination in function cra |
| UAT-0013 | [UAT-0013_central_finance_admin-finance-payments-default_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0013_central_finance_admin-finance-payments-default_S0-default.png) | /admin/finance/payments | default | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Navigate redirect — capture destination in function cra |
| UAT-0014 | [UAT-0014_central_finance_admin-finance-invoices-default_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0014_central_finance_admin-finance-invoices-default_S0-default.png) | /admin/finance/invoices | default | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Navigate redirect — capture destination in function cra |
| UAT-0015 | [UAT-0015_central_admin_staff_admin-crm-default_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0015_central_admin_staff_admin-crm-default_S0-default.png) | /admin/crm | default | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Navigate redirect — capture destination in function cra |
| UAT-0016 | [UAT-0016_central_admin_staff_admin-roles-default_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0016_central_admin_staff_admin-roles-default_S0-default.png) | /admin/roles | default | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Navigate redirect — capture destination in function cra |
| UAT-0017 | [UAT-0017_central_admin_staff_admin-clients-default_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0017_central_admin_staff_admin-clients-default_S0-default.png) | /admin/clients | default | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Unauthenticated gate — CREDENTIAL_REQUIRED for function |
| UAT-0018 | [UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-default.png) | /admin/clients | sheet-review-open | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Buyer approval sheet — BLOCKED pending P0 #483 deploy;  |
| UAT-0019 | [UAT-0019_central_admin_staff_admin-approvals-default_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0019_central_admin_staff_admin-approvals-default_S0-default.png) | /admin/approvals | default | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Unauthenticated gate — CREDENTIAL_REQUIRED for function |
| UAT-0020 | [UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-default.png](../../uat-evidence/screenshots/tranche-02/UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-default.png) | /admin/approvals | sheet-review-open | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Buyer approval sheet — BLOCKED pending P0 #483 deploy;  |

**Buyer sheet states (UAT-0018, UAT-0020):** function+UX **BLOCKED** pending P0 **#483** deploy — pre-fix physical evidence preserved under FAIL-481-* / FAIL-UX-481-*; re-test same UAT/FAIL IDs only post-deploy.
**Auth surfaces:** CREDENTIAL_REQUIRED — does not block unrelated Trace / Point41 / Dispatch crawl lanes.
**Remaining untested after this tranche:** 111 / 131 (UAT-0021..UAT-0131).
