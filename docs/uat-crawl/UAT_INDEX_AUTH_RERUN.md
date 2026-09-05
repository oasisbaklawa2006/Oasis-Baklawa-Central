# UAT Visual + UX Crawl Index — auth-rerun

**UAT range:** UAT-0002..0020 (authenticated repair)
**Crawl base URL:** https://oasis-baklawa-centra-git-b9f168-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-05T20:08:58.375Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0002 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-01/ (pre-auth S0 preserved)) | /operations-controller | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_OPERATIONS_EMAIL, TEST_OPER |
| UAT-0003 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-01/ (pre-auth S0 preserved)) | /security-gate | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_GATE_SECURITY_EMAIL, TEST_G |
| UAT-0006 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-01/ (pre-auth S0 preserved)) | /buyer/access-request | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0007 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-01/ (pre-auth S0 preserved)) | /buyer/* | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0010 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-01/ (pre-auth S0 preserved)) | /admin | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_ADMIN_EMAIL, TEST_ADMIN_PAS |
| UAT-0011 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/customers | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_ADMIN_EMAIL, TEST_ADMIN_PAS |
| UAT-0012 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/assembly | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_ASSEMBLY_EMAIL, TEST_ASSEMB |
| UAT-0013 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/finance/payments | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_FINANCE_EMAIL, TEST_FINANCE |
| UAT-0014 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/finance/invoices | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_FINANCE_EMAIL, TEST_FINANCE |
| UAT-0015 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/crm | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_ADMIN_EMAIL, TEST_ADMIN_PAS |
| UAT-0016 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/roles | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_ADMIN_EMAIL, TEST_ADMIN_PAS |
| UAT-0017 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/clients | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_ADMIN_EMAIL, TEST_ADMIN_PAS |
| UAT-0018 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/clients | sheet-review-open | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PAS |
| UAT-0019 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/approvals | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_ADMIN_EMAIL, TEST_ADMIN_PAS |
| UAT-0020 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/approvals | sheet-review-open | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PAS |

**Pre-auth evidence preserved** in `tranche-01/` and `tranche-02/` — not overwritten.
**Authenticated complete:** 0 / 15
**Blocked secret names:** TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_ASSEMBLY_EMAIL, TEST_ASSEMBLY_PASSWORD, TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD, TEST_FINANCE_EMAIL, TEST_FINANCE_PASSWORD, TEST_GATE_SECURITY_EMAIL, TEST_GATE_SECURITY_PASSWORD, TEST_OPERATIONS_EMAIL, TEST_OPERATIONS_PASSWORD, TEST_SALES_EMAIL, TEST_SALES_PASSWORD
