# UAT Visual + UX Crawl Index — buyer-mobile-auth

**UAT range:** Buyer mobile surfaces (PR #10 @ 0015e7b5)
**Crawl base URL:** https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-05T22:37:39.974Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0114 | [](../../) | /buyer | dashboard-default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0115 | [](../../) | /buyer/catalogue | catalogue-default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0115 | [](../../) | /buyer/catalogue | catalogue-search | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0115 | [](../../) | /buyer/catalogue | favourites-toggle | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0115 | [](../../) | /buyer/catalogue/{productId} | product-detail | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0116 | [](../../) | /buyer/cart | cart-default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0117 | [](../../) | /buyer/orders | orders-list | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0117 | [](../../) | /buyer/orders/{orderId} | order-detail | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0120 | [](../../) | /buyer/documents | documents-default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0120 | [](../../) | /buyer/documents | statement-facts | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0119 | [](../../) | /buyer/support | support-default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0119 | [](../../) | /buyer/support | general-enquiry | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0118 | [](../../) | /buyer/account | account-default | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0121 | [](../../) | /buyer/access-request | access-request-approved | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0006 | [](../../) | /buyer/access-request | access-request-auth | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |
| UAT-0007 | [](../../) | /buyer/catalogue | buyer-wildcard | BLOCKED | BLOCKED | BLOCKED | 0/148 | 0 | AUTH BLOCKED — missing TEST_BUYER_EMAIL, TEST_BUYER_PAS |

**All surfaces BLOCKED** — `TEST_BUYER_EMAIL` / `TEST_BUYER_PASSWORD` not present in repo secrets.
Golden-path certification uses ephemeral synthetic buyer credentials; UAT crawl requires governed repo secrets.
