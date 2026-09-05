# UAT Visual + UX Crawl Index — tranche-07-auth

**UAT range:** UAT-0091..UAT-0110
**Crawl base URL:** https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-05T23:25:27.680Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0091 | [UAT-0091_central_dispatch_admin-dispatch-finalization-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-07-auth/UAT-0091_central_dispatch_admin-dispatch-finalization-default_S0-auth-settled.png) | /admin/dispatch-finalization | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_DISPATCH_* (values not logged).  |
| UAT-0092 | [UAT-0092_central_admin_staff_admin-stock-finalization-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-07-auth/UAT-0092_central_admin_staff_admin-stock-finalization-default_S0-auth-settled.png) | /admin/stock-finalization | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0093 | [UAT-0093_central_dispatch_admin-dispatch-mgmt-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-07-auth/UAT-0093_central_dispatch_admin-dispatch-mgmt-default_S0-auth-settled.png) | /admin/dispatch-mgmt | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_DISPATCH_* (values not logged).  |
| UAT-0094 | [UAT-0094_central_dispatch_admin-dispatch-mgmt-filter-empty_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-07-auth/UAT-0094_central_dispatch_admin-dispatch-mgmt-filter-empty_S0-auth-settled.png) | /admin/dispatch-mgmt | filter-empty | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_DISPATCH_* (values not logged).  |
| UAT-0095 | [UAT-0095_central_dispatch_admin-dispatch-tv-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-07-auth/UAT-0095_central_dispatch_admin-dispatch-tv-default_S0-auth-settled.png) | /admin/dispatch-tv | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_DISPATCH_* (values not logged).  |
| UAT-0096 | [UAT-0096_central_admin_staff_admin-target-vs-actual-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-07-auth/UAT-0096_central_admin_staff_admin-target-vs-actual-default_S0-auth-settled.png) | /admin/target-vs-actual | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0097 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/3pcs-store | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_PRODUCTION_EMAIL, TEST_PROD |
| UAT-0098 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/3pgs-procurement-queue | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_PRODUCTION_EMAIL, TEST_PROD |
| UAT-0099 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/3pgs-visibility | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_PRODUCTION_EMAIL, TEST_PROD |
| UAT-0100 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/3pgs-mobile-urgent | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_PRODUCTION_EMAIL, TEST_PROD |
| UAT-0101 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /admin/3pgs-tv | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_PRODUCTION_EMAIL, TEST_PROD |
| UAT-0102 | [UAT-0102_central_admin_staff_admin-verification-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-07-auth/UAT-0102_central_admin_staff_admin-verification-default_S0-auth-settled.png) | /admin/verification | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0103 | [UAT-0103_central_admin_staff_admin-announcements-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-07-auth/UAT-0103_central_admin_staff_admin-announcements-default_S0-auth-settled.png) | /admin/announcements | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0104 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /sales/dashboard | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PAS |
| UAT-0105 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /sales/3pgs-visibility | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PAS |
| UAT-0106 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /tv/arabic-sweets | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_TV_RGS_EMAIL, TEST_TV_RGS_P |
| UAT-0107 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /tv/chocolate | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_TV_RGS_EMAIL, TEST_TV_RGS_P |
| UAT-0108 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /tv/dragees | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_TV_RGS_EMAIL, TEST_TV_RGS_P |
| UAT-0109 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /tv/fusion | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_TV_RGS_EMAIL, TEST_TV_RGS_P |
| UAT-0110 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /tv/bakery | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_TV_RGS_EMAIL, TEST_TV_RGS_P |

Authenticated crawl only — login-gate captures do not satisfy function/UX for role surfaces.
**Authenticated complete:** 8 / 20
**Blocked:** TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD, TEST_SALES_EMAIL, TEST_SALES_PASSWORD, TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD
**Remaining after tranche-07-auth:** 21 / 131 (UAT-0111..0131).
