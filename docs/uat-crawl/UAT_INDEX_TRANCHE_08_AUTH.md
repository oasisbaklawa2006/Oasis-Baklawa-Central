# UAT Visual + UX Crawl Index — tranche-08-auth

**UAT range:** UAT-0111..UAT-0131
**Crawl base URL:** https://oasis-baklawa-central.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-28T16:48:21.574Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0111 | [UAT-0111_central_tv_tv-nuts-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0111_central_tv_tv-nuts-default_S0-auth-settled.png) | /tv/nuts | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_ADMIN_* (values not logged). tit |
| UAT-0112 | [UAT-0112_central_rgs_tv-rgs-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0112_central_rgs_tv-rgs-default_S0-auth-settled.png) | /tv/rgs | default | OBSERVED | OBSERVED | PASS | 4/148 | 0 | Authenticated via TEST_TV_RGS_* (values not logged). ti |
| UAT-0113 | [UAT-0113_central_3pgs_tv-3pgs-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0113_central_3pgs_tv-3pgs-default_S0-auth-settled.png) | /tv/3pgs | default | OBSERVED | OBSERVED | PARTIAL | 4/148 | 0 | Authenticated via TEST_3PGS_* (values not logged). titl |
| UAT-0114 | [UAT-0114_buyer-mobile_buyer_buyer-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0114_buyer-mobile_buyer_buyer-default_S0-auth-settled.png) | /buyer | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | Authenticated via TEST_BUYER_* (values not logged). tit |
| UAT-0115 | [UAT-0115_buyer-mobile_buyer_buyer-catalogue-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0115_buyer-mobile_buyer_buyer-catalogue-default_S0-auth-settled.png) | /buyer/catalogue | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | Authenticated via TEST_BUYER_* (values not logged). tit |
| UAT-0116 | [UAT-0116_buyer-mobile_buyer_buyer-cart-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0116_buyer-mobile_buyer_buyer-cart-default_S0-auth-settled.png) | /buyer/cart | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | Authenticated via TEST_BUYER_* (values not logged). tit |
| UAT-0117 | [UAT-0117_buyer-mobile_buyer_buyer-orders-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0117_buyer-mobile_buyer_buyer-orders-default_S0-auth-settled.png) | /buyer/orders | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | Authenticated via TEST_BUYER_* (values not logged). tit |
| UAT-0118 | [UAT-0118_buyer-mobile_buyer_buyer-account-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0118_buyer-mobile_buyer_buyer-account-default_S0-auth-settled.png) | /buyer/account | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | Authenticated via TEST_BUYER_* (values not logged). tit |
| UAT-0119 | [UAT-0119_buyer-mobile_buyer_buyer-support-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0119_buyer-mobile_buyer_buyer-support-default_S0-auth-settled.png) | /buyer/support | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | Authenticated via TEST_BUYER_* (values not logged). tit |
| UAT-0120 | [UAT-0120_buyer-mobile_buyer_buyer-documents-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0120_buyer-mobile_buyer_buyer-documents-default_S0-auth-settled.png) | /buyer/documents | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | Authenticated via TEST_BUYER_* (values not logged). tit |
| UAT-0121 | [UAT-0121_buyer-mobile_buyer_buyer-access-request-default_S0-auth-settled.png](../../uat-evidence/screenshots/tranche-08-auth/UAT-0121_buyer-mobile_buyer_buyer-access-request-default_S0-auth-settled.png) | /buyer/access-request | default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | Authenticated via TEST_BUYER_* (values not logged). tit |
| UAT-0122 | [](../../) | / | default | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — ai-studio preview is configured, but thi |
| UAT-0123 | [](../../) | /media | default | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — ai-studio preview is configured, but thi |
| UAT-0124 | [](../../) | /media/review | default | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — ai-studio preview is configured, but thi |
| UAT-0125 | [](../../) | /products/new/fast | default | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — ai-studio preview is configured, but thi |
| UAT-0126 | [](../../) | /testing/pilot-readiness | default | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — ai-studio preview is configured, but thi |
| UAT-0127 | [](../../) | /media | camera-capture-flow | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — ai-studio preview is configured, but thi |
| UAT-0128 | [](../../) | / | scan-home | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — trace preview is configured, but this Ce |
| UAT-0129 | [](../../) | /scan | gate-scan | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — trace preview is configured, but this Ce |
| UAT-0130 | [](../../) | /scan | carton-scan | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — trace preview is configured, but this Ce |
| UAT-0131 | [](../../) | /scan | offline-queue | NOT-TESTED | NOT-TESTED | NOT-TESTED | 0/148 | 0 | NOT EXECUTED — trace preview is configured, but this Ce |

Authenticated crawl only — login-gate captures do not satisfy function/UX for role surfaces.
**Authenticated complete:** 3 / 21
**Blocked:** credential/login/network
**Census complete for configured range.**
