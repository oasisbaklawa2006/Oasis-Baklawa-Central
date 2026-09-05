# UAT Visual + UX Crawl Index — auth-rerun

**UAT range:** UAT-0002..0020 minus UAT-0018/0020 (buyer sheet → post-fix-483)
**Crawl base URL:** https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-05T23:17:43.606Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0002 | [UAT-0002_central_admin_staff_operations-controller-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0002_central_admin_staff_operations-controller-default_S0-auth-settled.png) | /operations-controller | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_OPERATIONS_* (values not logged) |
| UAT-0003 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-01/ (pre-auth S0 preserved)) | /security-gate | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_GATE_SECURITY_EMAIL, TEST_G |
| UAT-0006 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-01/ (pre-auth S0 preserved)) | /buyer/access-request | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0007 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-01/ (pre-auth S0 preserved)) | /buyer/* | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0010 | [UAT-0010_central_admin_staff_admin-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0010_central_admin_staff_admin-default_S0-auth-settled.png) | /admin | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0011 | [UAT-0011_central_admin_staff_admin-customers-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0011_central_admin_staff_admin-customers-default_S0-auth-settled.png) | /admin/customers | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0012 | [UAT-0012_central_p_and_a_admin-assembly-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0012_central_p_and_a_admin-assembly-default_S0-auth-settled.png) | /admin/assembly | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ASSEMBLY_* (values not logged).  |
| UAT-0013 | [UAT-0013_central_finance_admin-finance-payments-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0013_central_finance_admin-finance-payments-default_S0-auth-settled.png) | /admin/finance/payments | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_FINANCE_* (values not logged). t |
| UAT-0014 | [UAT-0014_central_finance_admin-finance-invoices-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0014_central_finance_admin-finance-invoices-default_S0-auth-settled.png) | /admin/finance/invoices | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_FINANCE_* (values not logged). t |
| UAT-0015 | [UAT-0015_central_admin_staff_admin-crm-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0015_central_admin_staff_admin-crm-default_S0-auth-settled.png) | /admin/crm | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0016 | [UAT-0016_central_admin_staff_admin-roles-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0016_central_admin_staff_admin-roles-default_S0-auth-settled.png) | /admin/roles | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0017 | [UAT-0017_central_admin_staff_admin-clients-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0017_central_admin_staff_admin-clients-default_S0-auth-settled.png) | /admin/clients | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0019 | [UAT-0019_central_admin_staff_admin-approvals-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0019_central_admin_staff_admin-approvals-default_S0-auth-settled.png) | /admin/approvals | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |

**Pre-auth evidence preserved** in `tranche-01/` and `tranche-02/` — not overwritten.
**Authenticated complete:** 10 / 13
**Blocked secret names:** TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD, TEST_GATE_SECURITY_EMAIL, TEST_GATE_SECURITY_PASSWORD
