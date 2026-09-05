# UAT Failure Ledger — Tranche 01 bootstrap

Phase 4 register — **no remediation in this tranche**.

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-001-0002 | UAT-0002 | central | ADMIN_STAFF | desktop | /operations-controller | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0002_central_admin_staff_operations-controller_default.png | console:0 net:0 | Open /operations-controller without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0003 | UAT-0003 | central | GATE_SECURITY | desktop | /security-gate | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0003_central_gate_security_security-gate_default.png | console:0 net:0 | Open /security-gate without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0006 | UAT-0006 | central | BUYER | desktop | /buyer/access-request | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0006_central_buyer_buyer-access-request_default.png | console:0 net:0 | Open /buyer/access-request without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0007 | UAT-0007 | central | BUYER | desktop | /buyer/* | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0007_central_buyer_buyer-_default.png | console:0 net:0 | Open /buyer/catalogue without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-001-0010 | UAT-0010 | central | ADMIN_STAFF | desktop | /admin | Authenticated surface access | Role-specific app surface | Login redirect / auth gate | P1 | UAT-0010_central_admin_staff_admin_default.png | console:0 net:0 | Open /admin without session | Central | Deploy/Auth | TEST_* or operator credentials |
| FAIL-481-001 | UAT-0068† | central | ADMIN_SALES | phone | /admin/clients | Pricing Slab select in review sheet | Dropdown visible above Sheet; slab selectable | Select portal z-50 behind Sheet z-200; options invisible | **P0** | *(physical recording 2026-09-05)* | Issue #481 | Open pending app review sheet on mobile | Central | UI/z-index | Issue **#481** fix merged+deployed |
| FAIL-481-002 | UAT-0068† | central | ADMIN_SALES | phone | /admin/clients | Account Manager select | Managers listed (mixed-case roles) | Role filter lowercase-only excludes production SALES_EXECUTIVE/ADMIN | **P1** | *(physical recording 2026-09-05)* | Issue #481 | Same sheet | Central | RBAC/query | Issue **#481** fix merged+deployed |

† UAT-0068 = census ID for `/admin/clients` default state (see `UAT_ROUTE_CENSUS.json`). Function crawl **NOT-TESTED** until #481 fix deploy + credentials.
