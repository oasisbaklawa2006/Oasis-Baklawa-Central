# UAT Visual + UX Crawl Index — tranche-08-auth

**UAT range:** UAT-0111..UAT-0131
**Crawl base URL:** https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-05T23:25:30.685Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0111 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /tv/nuts | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_TV_RGS_EMAIL, TEST_TV_RGS_P |
| UAT-0112 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /tv/rgs | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_TV_RGS_EMAIL, TEST_TV_RGS_P |
| UAT-0113 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /tv/3pgs | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_TV_PRODUCTION_EMAIL, TEST_T |
| UAT-0114 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /buyer | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0115 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /buyer/catalogue | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0116 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /buyer/cart | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0117 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /buyer/orders | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0118 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /buyer/account | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0119 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /buyer/support | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0120 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /buyer/documents | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0121 | [ (pre-auth S0 preserved)](../../uat-evidence/screenshots/tranche-02/ (pre-auth S0 preserved)) | /buyer/access-request | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0122 | [](../../) | / | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — ai-studio requires TEST_AI_STUDIO_PREV |
| UAT-0123 | [](../../) | /media | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — ai-studio requires TEST_AI_STUDIO_PREV |
| UAT-0124 | [](../../) | /media/review | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — ai-studio requires TEST_AI_STUDIO_PREV |
| UAT-0125 | [](../../) | /products/new/fast | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — ai-studio requires TEST_AI_STUDIO_PREV |
| UAT-0126 | [](../../) | /testing/pilot-readiness | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — ai-studio requires TEST_AI_STUDIO_PREV |
| UAT-0127 | [](../../) | /media | camera-capture-flow | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — ai-studio requires TEST_AI_STUDIO_PREV |
| UAT-0128 | [](../../) | / | scan-home | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — trace requires TEST_TRACE_PREVIEW_URL; |
| UAT-0129 | [](../../) | /scan | gate-scan | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — trace requires TEST_TRACE_PREVIEW_URL; |
| UAT-0130 | [](../../) | /scan | carton-scan | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — trace requires TEST_TRACE_PREVIEW_URL; |
| UAT-0131 | [](../../) | /scan | offline-queue | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | DEPLOY BLOCKED — trace requires TEST_TRACE_PREVIEW_URL; |

Authenticated crawl only — login-gate captures do not satisfy function/UX for role surfaces.
**Authenticated complete:** 0 / 21
**Blocked:** TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD, TEST_TV_PRODUCTION_EMAIL, TEST_TV_PRODUCTION_PASSWORD, TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD, TEST_AI_STUDIO_PREVIEW_URL, TEST_TRACE_PREVIEW_URL
**Census complete for configured range.**
