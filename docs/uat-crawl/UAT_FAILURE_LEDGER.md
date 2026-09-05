# UAT Failure Ledger — Tranche 01 bootstrap

Phase 4 register — **no remediation in this tranche**.

Functional + UX failures. UX criteria authority: [`UAT_UX_FAILURE_MATRIX.md`](./UAT_UX_FAILURE_MATRIX.md).

## Functional / access failures

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-001-0002 | UAT-0002 | central | ADMIN_STAFF | desktop | /operations-controller | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0002_central_admin_staff_operations-controller_S0-default.png | console:0 net:0 | Open /operations-controller without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0003 | UAT-0003 | central | GATE_SECURITY | desktop | /security-gate | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0003_central_gate_security_security-gate_S0-default.png | console:0 net:0 | Open /security-gate without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0006 | UAT-0006 | central | BUYER | desktop | /buyer/access-request | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0006_central_buyer_buyer-access-request_S0-default.png | console:0 net:0 | Open /buyer/access-request without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0007 | UAT-0007 | central | BUYER | desktop | /buyer/* | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0007_central_buyer_buyer-_S0-default.png | console:0 net:0 | Open /buyer/catalogue without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0010 | UAT-0010 | central | ADMIN_STAFF | desktop | /admin | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0010_central_admin_staff_admin_S0-default.png | console:0 net:0 | Open /admin without session | Central | Deploy/Auth | TEST_* or operator credentials |

## Pre-registered failures (physical evidence, pending re-crawl)

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-481-001 | UAT-0018† | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | Pricing Slab select in review sheet | Dropdown visible above Sheet; slab selectable | Select portal z-50 behind Sheet z-200; options invisible | **P0** | *(physical recording 2026-09-05)* | Issue #481/#483 | Open pending app review sheet on mobile | Central | UI/z-index | Issue **#483** deploy — re-test SAME FAIL-ID post-fix |
| FAIL-481-002 | UAT-0018† | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | Account Manager select | Managers listed (mixed-case roles) | Role filter lowercase-only excludes production SALES_EXECUTIVE/ADMIN | **P1** | *(physical recording 2026-09-05)* | Issue #481/#483 | Same sheet | Central | RBAC/query | Issue **#483** deploy — re-test SAME FAIL-ID post-fix |
| FAIL-UX-481-001 | UAT-0018† | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | UX 32/33/36 | Overlay above Sheet | Select clipped behind Sheet | **P0** | physical 2026-09-05 | #481/#483 | Mobile review sheet | Central | UI/UX | **#483** deploy — re-test SAME FAIL-ID |
| FAIL-UX-481-002 | UAT-0018† | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | UX 17/36 | Truthful unavailable explanation | Manager list empty (role filter) | **P1** | physical 2026-09-05 | #481/#483 | Same | Central | UI/UX | **#483** deploy — re-test SAME FAIL-ID |
| FAIL-485-001 | UAT-0018† | central | ADMIN_SALES | phone | /admin/clients [post-approval] | Pending Review KPI vs list | KPI matches empty pending list | KPI shows 1 while list empty after approval success | **P1** | external iPhone recording 2026-09-05 | #485 | Approve pending app on production | Central | Data/KPI sync | Issue **#485** — UAT read-only |

† UAT-0018 = census interactive state for `/admin/clients` sheet-review-open; UAT-0020 mirrors on `/admin/approvals`. **#483 merged** — pre-fix evidence preserved in tranche-02; post-fix re-test via `post-fix-483-rerun.spec.ts` on deploy `ace340fe`.

---

## tranche-02 crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-001-0011 | UAT-0011 | central | ADMIN_STAFF | desktop-chrome | /admin/customers | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0011_central_admin_staff_admin-customers-default_S0-default.png | console:0 net:0 | Open /admin/customers without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0012 | UAT-0012 | central | P_AND_A | desktop-chrome | /admin/assembly | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0012_central_p_and_a_admin-assembly-default_S0-default.png | console:0 net:0 | Open /admin/assembly without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0013 | UAT-0013 | central | FINANCE | desktop-chrome | /admin/finance/payments | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0013_central_finance_admin-finance-payments-default_S0-default.png | console:0 net:0 | Open /admin/finance/payments without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0014 | UAT-0014 | central | FINANCE | desktop-chrome | /admin/finance/invoices | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0014_central_finance_admin-finance-invoices-default_S0-default.png | console:0 net:0 | Open /admin/finance/invoices without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0015 | UAT-0015 | central | ADMIN_STAFF | desktop-chrome | /admin/crm | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0015_central_admin_staff_admin-crm-default_S0-default.png | console:0 net:0 | Open /admin/crm without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0016 | UAT-0016 | central | ADMIN_STAFF | desktop-chrome | /admin/roles | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0016_central_admin_staff_admin-roles-default_S0-default.png | console:0 net:0 | Open /admin/roles without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0017 | UAT-0017 | central | ADMIN_STAFF | desktop-chrome | /admin/clients | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0017_central_admin_staff_admin-clients-default_S0-default.png | console:0 net:0 | Open /admin/clients without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-BLOCK-483-0018 | UAT-0018 | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | Buyer approval sheet UX (#483) | Sheet open with visible Select overlays | BLOCKED pending #483 deploy + credentials + fixture | **P0** | UAT-0018_central_admin_sales_admin-clients-sheet-review-open_S0-default.png | pre-fix evidence preserved | Do not re-test until #483 lands | Central | UI/UX | Issue **#483** deploy |
| FAIL-001-0019 | UAT-0019 | central | ADMIN_STAFF | desktop-chrome | /admin/approvals | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0019_central_admin_staff_admin-approvals-default_S0-default.png | console:0 net:0 | Open /admin/approvals without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-BLOCK-483-0020 | UAT-0020 | central | ADMIN_SALES | phone | /admin/approvals [sheet-review-open] | Buyer approval sheet UX (#483) | Sheet open with visible Select overlays | BLOCKED pending #483 deploy + credentials + fixture | **P0** | UAT-0020_central_admin_sales_admin-approvals-sheet-review-open_S0-default.png | pre-fix evidence preserved | Do not re-test until #483 lands | Central | UI/UX | Issue **#483** deploy |

---

## auth-rerun (authenticated repair) crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0002 | UAT-0002 | central | ADMIN_STAFF | desktop | /operations-controller | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_OPERATIONS_EMAIL, TEST_OPERATIONS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_OPERATIONS_EMAIL, TEST_OPERATIONS_PASSWORD |
| FAIL-AUTH-CRED-0003 | UAT-0003 | central | GATE_SECURITY | desktop | /security-gate | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_GATE_SECURITY_EMAIL, TEST_GATE_SECURITY_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_GATE_SECURITY_EMAIL, TEST_GATE_SECURITY_PASSWORD |
| FAIL-AUTH-CRED-0006 | UAT-0006 | central | BUYER | phone | /buyer/access-request | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0007 | UAT-0007 | central | BUYER | phone | /buyer/* | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0010 | UAT-0010 | central | ADMIN_STAFF | desktop | /admin | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD |
| FAIL-AUTH-CRED-0011 | UAT-0011 | central | ADMIN_STAFF | desktop | /admin/customers | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD |
| FAIL-AUTH-CRED-0012 | UAT-0012 | central | P_AND_A | desktop | /admin/assembly | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_ASSEMBLY_EMAIL, TEST_ASSEMBLY_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_ASSEMBLY_EMAIL, TEST_ASSEMBLY_PASSWORD |
| FAIL-AUTH-CRED-0013 | UAT-0013 | central | FINANCE | desktop | /admin/finance/payments | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_FINANCE_EMAIL, TEST_FINANCE_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_FINANCE_EMAIL, TEST_FINANCE_PASSWORD |
| FAIL-AUTH-CRED-0014 | UAT-0014 | central | FINANCE | desktop | /admin/finance/invoices | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_FINANCE_EMAIL, TEST_FINANCE_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_FINANCE_EMAIL, TEST_FINANCE_PASSWORD |
| FAIL-AUTH-CRED-0015 | UAT-0015 | central | ADMIN_STAFF | desktop | /admin/crm | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD |
| FAIL-AUTH-CRED-0016 | UAT-0016 | central | ADMIN_STAFF | desktop | /admin/roles | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD |
| FAIL-AUTH-CRED-0017 | UAT-0017 | central | ADMIN_STAFF | desktop | /admin/clients | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD |
| FAIL-AUTH-CRED-0018 | UAT-0018 | central | ADMIN_SALES | phone | /admin/clients | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0019 | UAT-0019 | central | ADMIN_STAFF | desktop | /admin/approvals | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD |
| FAIL-AUTH-CRED-0020 | UAT-0020 | central | ADMIN_SALES | phone | /admin/approvals | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |

---

## post-fix-483 (#483 deploy ace340fe) crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0018 | UAT-0018 | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0020 | UAT-0020 | central | ADMIN_SALES | phone | /admin/approvals [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |

---

## post-fix-483 (#483 deploy ace340fe) crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0018 | UAT-0018 | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0020 | UAT-0020 | central | ADMIN_SALES | phone | /admin/approvals [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |

---

## auth-rerun (authenticated repair) crawl failures (2026-09-05)

---

## post-fix-483 (#483 deploy ace340fe) crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0018 | UAT-0018 | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0020 | UAT-0020 | central | ADMIN_SALES | phone | /admin/approvals [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |

---

## auth-rerun (authenticated repair) crawl failures (2026-09-05)

---

## tranche-03-auth crawl failures (2026-09-05)

---

## post-fix-483 (#483 deploy ace340fe) crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0018 | UAT-0018 | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0020 | UAT-0020 | central | ADMIN_SALES | phone | /admin/approvals [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |

---

## auth-rerun (authenticated repair) crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0003 | UAT-0003 | central | GATE_SECURITY | desktop | /security-gate | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_GATE_SECURITY_EMAIL, TEST_GATE_SECURITY_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_GATE_SECURITY_EMAIL, TEST_GATE_SECURITY_PASSWORD |
| FAIL-AUTH-CRED-0006 | UAT-0006 | central | BUYER | phone | /buyer/access-request | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0007 | UAT-0007 | central | BUYER | phone | /buyer/* | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |

---

## tranche-03-auth crawl failures (2026-09-05)

---

## post-fix-483 (#483 deploy ace340fe) crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0018 | UAT-0018 | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0020 | UAT-0020 | central | ADMIN_SALES | phone | /admin/approvals [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |

---

## auth-rerun (authenticated repair) crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0003 | UAT-0003 | central | GATE_SECURITY | desktop | /security-gate | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_GATE_SECURITY_EMAIL, TEST_GATE_SECURITY_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_GATE_SECURITY_EMAIL, TEST_GATE_SECURITY_PASSWORD |
| FAIL-AUTH-CRED-0006 | UAT-0006 | central | BUYER | phone | /buyer/access-request | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0007 | UAT-0007 | central | BUYER | phone | /buyer/* | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |

---

## tranche-03-auth crawl failures (2026-09-05)

---

## post-fix-483 (#483 deploy ace340fe) crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0018 | UAT-0018 | central | ADMIN_SALES | phone | /admin/clients [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0020 | UAT-0020 | central | ADMIN_SALES | phone | /admin/approvals [sheet-review-open] | Post-fix #483 retest | Authenticated sheet S0–S3 | BLOCKED — missing TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P0 | pre-fix preserved | — | Post-fix #483 | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
