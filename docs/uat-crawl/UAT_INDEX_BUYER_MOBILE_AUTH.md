# UAT Visual + UX Crawl Index — buyer-mobile-auth

**UAT range:** Buyer mobile surfaces (PR #10 @ `0015e7b5`)
**Crawl base URL:** https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app
**Buyer merge SHA:** `0015e7b56532826a40c7beb3f33b028271c2c2f5`
**GHA run:** [33996335627](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33996335627)
**Captured:** 2026-09-05T22:36:04Z

| UAT ID | Surface | Route | State | Visual | Function | UX | Notes |
|---|---|---|---|---|---|---|---|
| UAT-0114 | Dashboard | /buyer | dashboard-default | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0115 | Catalogue | /buyer/catalogue | catalogue-default | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0115 | Catalogue search | /buyer/catalogue | catalogue-search | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0115 | Favourites | /buyer/catalogue | favourites-toggle | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0115 | Product Detail | /buyer/catalogue/{productId} | product-detail | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0116 | Cart | /buyer/cart | cart-default | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0117 | Orders | /buyer/orders | orders-list | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0117 | Order Detail | /buyer/orders/{orderId} | order-detail | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0120 | Documents | /buyer/documents | documents-default | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0120 | Statement | /buyer/documents | statement-facts | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0119 | Support | /buyer/support | support-default | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0119 | General enquiry | /buyer/support | general-enquiry | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0118 | Account | /buyer/account | account-default | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0121 | Access request | /buyer/access-request | access-request-approved | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0006 | Access request auth | /buyer/access-request | access-request-auth | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |
| UAT-0007 | Buyer entry | /buyer/catalogue | buyer-wildcard | BLOCKED | BLOCKED | BLOCKED | TEST_BUYER_* missing |

**Authenticated complete:** 0 / 16 surfaces · **Screenshots:** 0 (no fabricated PASS)

**Blockers:** `TEST_BUYER_EMAIL`, `TEST_BUYER_PASSWORD` — not configured in Central repo secrets.

**Deploy note:** URL auto-resolved to ace340fe Vercel deploy; no successful deployment found for buyer merge SHA `0015e7b5`. Re-run with `TEST_PREVIEW_URL` pointing at a deploy containing PR #10 once secrets are provisioned.
