# UAT Visual + UX Crawl Index — Tranche 01

**Crawl base URL:** https://oasis-baklawa-centra-git-b9f168-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-05T18:24:27.433Z

| UAT ID | S0 | Route | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---:|---:|---|
| UAT-0001 | [UAT-0001_central_unauthenticated_splash_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0001_central_unauthenticated_splash_S0-default.png) | /splash | OBSERVED | NOT-TESTED | PARTIAL | 4/148 | 0 | title="Oasis Baklawa Central | B2B Partner Portal" finalUrl= |
| UAT-0002 | [UAT-0002_central_admin_staff_operations-controller_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0002_central_admin_staff_operations-controller_S0-default.png) | /operations-controller | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Unauthenticated gate — page content not exercised. CREDENTIA |
| UAT-0003 | [UAT-0003_central_gate_security_security-gate_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0003_central_gate_security_security-gate_S0-default.png) | /security-gate | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Unauthenticated gate — page content not exercised. CREDENTIA |
| UAT-0004 | [UAT-0004_central_unauthenticated_root_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0004_central_unauthenticated_root_S0-default.png) | / | OBSERVED | NOT-TESTED | PARTIAL | 4/148 | 0 | title="Oasis Baklawa Central | B2B Partner Portal" finalUrl= |
| UAT-0005 | [UAT-0005_central_admin_staff_customer-app-redirect_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0005_central_admin_staff_customer-app-redirect_S0-default.png) | /customer-app-redirect | OBSERVED | NOT-TESTED | PARTIAL | 4/148 | 0 | title="Oasis Baklawa Central | B2B Partner Portal" finalUrl= |
| UAT-0006 | [UAT-0006_central_buyer_buyer-access-request_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0006_central_buyer_buyer-access-request_S0-default.png) | /buyer/access-request | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Unauthenticated gate — page content not exercised. CREDENTIA |
| UAT-0007 | [UAT-0007_central_buyer_buyer-_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0007_central_buyer_buyer-_S0-default.png) | /buyer/* | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Wildcard route visited as /buyer/catalogue substitute Unauth |
| UAT-0008 | [UAT-0008_central_unauthenticated_login_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0008_central_unauthenticated_login_S0-default.png) | /login | OBSERVED | NOT-TESTED | PARTIAL | 4/148 | 0 | title="Oasis Baklawa Central | B2B Partner Portal" finalUrl= |
| UAT-0009 | [UAT-0009_central_unauthenticated_reset-password_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0009_central_unauthenticated_reset-password_S0-default.png) | /reset-password | OBSERVED | NOT-TESTED | PARTIAL | 4/148 | 0 | title="Oasis Baklawa Central | B2B Partner Portal" finalUrl= |
| UAT-0010 | [UAT-0010_central_admin_staff_admin_S0-default.png](../../uat-evidence/screenshots/tranche-01/UAT-0010_central_admin_staff_admin_S0-default.png) | /admin | OBSERVED | BLOCKED | BLOCKED | 0/148 | 0 | Unauthenticated gate — page content not exercised. CREDENTIA |

**UX evidence gaps (tranche 01):** S1–S3 not captured on auth-blocked routes; full 148-criterion evaluation requires role credentials + interactive crawl per [`UAT_UX_FAILURE_MATRIX.md`](./UAT_UX_FAILURE_MATRIX.md).
