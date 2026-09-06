# UAT Failure Ledger — Tranche 01 bootstrap

Phase 4 register — **no remediation in this tranche**.

Functional + UX failures. UX criteria authority: [`UAT_UX_FAILURE_MATRIX.md`](./UAT_UX_FAILURE_MATRIX.md).

## Post-merge targeted proofs (2026-09-06) — NOT current-main certification

| Proof | Deploy SHA | GitHub deploy ID | GHA run | Status |
|---|---|---:|---:|---|
| FAST PATH A #493 original | `8f042fa` | 6289603800 | [34015742110](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34015742110) | **UAT-005 FAIL** — UAT-006–010 NOT RUN |
| FAST PATH A #497 repair | `9715c20d` | 7GCAJ79HNbN5oLDKtbVfefvjkg6q | [34016393457](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/34016393457) | **UAT-005–010 PASS (6/6)** |
| FAST PATH B #491 KPI (FAIL-485-001) | `efd1419` | 6289622998 | 34015742110 / 34016393457 | **BLOCKED** (`TEST_SALES_*`) |
| Full 131-surface rebaseline | `64a107df` | — | — | **HELD** (no Vercel deploy) |

**Verified preview URLs (GitHub Deployments API — not user-supplied host):**
- #493 original: `https://oasis-baklawa-central-omgfjj6e3-oasisbaklawa2006-6222s-projects.vercel.app`
- #497 repair: `https://oasis-baklawa-centra-git-719166-oasisbaklawa2006-6222s-projects.vercel.app`
- #491: `https://oasis-baklawa-central-adpz5kw86-oasisbaklawa2006-6222s-projects.vercel.app`

Original UAT-005 failure evidence preserved in prior manifests — post-merge rows append only.

| FAIL-ID | UAT-ID | Run | Actual | Disposition |
|---|---|---|---|---|
| FAIL-493-001 | UAT-005 | 34015742110 @ `8f042fa` | Dispatch direct probe `/admin/finance` did not fail closed (stale harness + async guard) | **OPEN on original deploy** — preserved |
| FAIL-493-001 repair | UAT-005–010 | 34016393457 @ `9715c20d` (#497) | All forbidden routes fail closed to `/admin/dispatch-mgmt` | **REPAIR PROVEN** — pending #497 merge to main |
| FAIL-493-001 repair (newer #497 head) | — | — | `fa3b879` preview — **NOT re-run**; preserved evidence at `9715c20d` only | **NOT current-main cert** while #497 open |

**Policy:** ace340fe not substituted as post-#490 current evidence. If no Vercel deploy for `67b3d1cc`, all deploy-dependent tranches record **BLOCKED** with provenance in `UAT_DEPLOY_PROVENANCE.json`.

| Tranche | Deploy-dependent | Credential blockers |
|---|---|---|
| AI-UAT UAT-001–010 | Requires `67b3d1cc` Vercel URL | `TEST_DISPATCH_*`, `TEST_ASSEMBLY_*` |
| post-fix-483 UAT-0018/0020 | Requires `67b3d1cc` Vercel URL | `TEST_SALES_*` |
| 131-surface auth crawl | Requires `67b3d1cc` Vercel URL | per-role `TEST_*` (see progress doc) |

**Prior ace340fe-era evidence (80/131 authenticated):** preserved unchanged in manifests/screenshots.

**Deploy:** ace340fe (`https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app`) · **Evidence SHA:** `80e1f1c2` · **Authenticated S0–S3:** **80 / 131** · **Remaining:** **51**

| FAIL-ID cluster | Status | Blocker | Governed re-crawl |
|---|---|---|---|
| FAIL-481-001, FAIL-481-002, FAIL-UX-481-001, FAIL-UX-481-002 | **OPEN** | `TEST_SALES_EMAIL`, `TEST_SALES_PASSWORD` | post-fix-483 tranche — 0/2 S0–S3 captured |
| FAIL-485-001 | **OPEN** | Issue **#485** (KPI stale) | Physical recording only; repair not in UAT lane |
| FAIL-AUTH-CRED-* (51 UAT IDs) | **BLOCKED** | See [`UAT_CRAWL_PROGRESS.md`](./UAT_CRAWL_PROGRESS.md) secret table | No screenshot = not tested |
| Buyer mobile (16 surfaces) | **BLOCKED** | `TEST_BUYER_EMAIL`, `TEST_BUYER_PASSWORD` | PR #10 cert does not substitute |

**Classification rule enforced:** No screenshot = not tested; no action/result evidence = function not tested. Pre-fix tranche-02 screenshots preserved; post-fix-483 folder empty pending `TEST_SALES_*`.

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

## tranche-04-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0044 | UAT-0044 | central | SALES | desktop | /admin/sales-hub | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |

---

## tranche-05-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0062 | UAT-0062 | central | RGS | desktop | /admin/ready-goods | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0063 | UAT-0063 | central | RGS | desktop | /admin/ready-goods-day-close | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0064 | UAT-0064 | central | RGS | desktop | /admin/ready-goods-reports | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0065 | UAT-0065 | central | RGS | desktop | /admin/ready-goods-stock | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0067 | UAT-0067 | central | 3PGS | desktop | /admin/3pgs-packing-material | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |

---

## tranche-06-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0082 | UAT-0082 | central | RGS | desktop | /admin/execution/ready-goods | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0087 | UAT-0087 | central | RGS | desktop | /admin/rgs-tv | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |

---

## tranche-07-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0097 | UAT-0097 | central | 3PGS | desktop | /admin/3pcs-store | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0098 | UAT-0098 | central | 3PGS | desktop | /admin/3pgs-procurement-queue | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0099 | UAT-0099 | central | 3PGS | desktop | /admin/3pgs-visibility | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0100 | UAT-0100 | central | 3PGS | desktop | /admin/3pgs-mobile-urgent | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0101 | UAT-0101 | central | 3PGS | desktop | /admin/3pgs-tv | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0104 | UAT-0104 | central | SALES | desktop | /sales/dashboard | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0105 | UAT-0105 | central | SALES | desktop | /sales/3pgs-visibility | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0106 | UAT-0106 | central | TV | tv | /tv/arabic-sweets | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0107 | UAT-0107 | central | TV | tv | /tv/chocolate | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0108 | UAT-0108 | central | TV | tv | /tv/dragees | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0109 | UAT-0109 | central | TV | tv | /tv/fusion | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0110 | UAT-0110 | central | TV | tv | /tv/bakery | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |

---

## tranche-08-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0111 | UAT-0111 | central | TV | tv | /tv/nuts | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0112 | UAT-0112 | central | RGS | tv | /tv/rgs | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0113 | UAT-0113 | central | 3PGS | tv | /tv/3pgs | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_PRODUCTION_EMAIL, TEST_TV_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_PRODUCTION_EMAIL, TEST_TV_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0114 | UAT-0114 | central | BUYER | phone | /buyer | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0115 | UAT-0115 | central | BUYER | phone | /buyer/catalogue | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0116 | UAT-0116 | central | BUYER | phone | /buyer/cart | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0117 | UAT-0117 | central | BUYER | phone | /buyer/orders | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0118 | UAT-0118 | central | BUYER | phone | /buyer/account | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0119 | UAT-0119 | central | BUYER | phone | /buyer/support | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0120 | UAT-0120 | central | BUYER | phone | /buyer/documents | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0121 | UAT-0121 | central | BUYER | phone | /buyer/access-request | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-DEPLOY-0122 | UAT-0122 | ai-studio | AI_CATALOGUE | desktop-chrome | / | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0123 | UAT-0123 | ai-studio | AI_CATALOGUE | iphone-14 | /media | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0124 | UAT-0124 | ai-studio | AI_APPROVER | desktop-chrome | /media/review | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0125 | UAT-0125 | ai-studio | AI_CATALOGUE | desktop-chrome | /products/new/fast | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0126 | UAT-0126 | ai-studio | AI_CATALOGUE | desktop-chrome | /testing/pilot-readiness | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0127 | UAT-0127 | ai-studio | AI_CATALOGUE | iphone-14 | /media | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0128 | UAT-0128 | trace | TRACE_SCANNER | desktop-chrome | / | Authenticated crawl on trace deploy | Role surface on correct preview host | BLOCKED — missing TEST_TRACE_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for trace) | P1 | — | — | tranche-08-auth | oasis-trace | Deploy | TEST_TRACE_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0129 | UAT-0129 | trace | TRACE_SCANNER | desktop-chrome | /scan | Authenticated crawl on trace deploy | Role surface on correct preview host | BLOCKED — missing TEST_TRACE_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for trace) | P1 | — | — | tranche-08-auth | oasis-trace | Deploy | TEST_TRACE_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0130 | UAT-0130 | trace | TRACE_SCANNER | desktop-chrome | /scan | Authenticated crawl on trace deploy | Role surface on correct preview host | BLOCKED — missing TEST_TRACE_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for trace) | P1 | — | — | tranche-08-auth | oasis-trace | Deploy | TEST_TRACE_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0131 | UAT-0131 | trace | TRACE_SCANNER | desktop-chrome | /scan | Authenticated crawl on trace deploy | Role surface on correct preview host | BLOCKED — missing TEST_TRACE_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for trace) | P1 | — | — | tranche-08-auth | oasis-trace | Deploy | TEST_TRACE_PREVIEW_URL |

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

## tranche-04-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0044 | UAT-0044 | central | SALES | desktop | /admin/sales-hub | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |

---

## tranche-05-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0062 | UAT-0062 | central | RGS | desktop | /admin/ready-goods | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0063 | UAT-0063 | central | RGS | desktop | /admin/ready-goods-day-close | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0064 | UAT-0064 | central | RGS | desktop | /admin/ready-goods-reports | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0065 | UAT-0065 | central | RGS | desktop | /admin/ready-goods-stock | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0067 | UAT-0067 | central | 3PGS | desktop | /admin/3pgs-packing-material | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |

---

## tranche-06-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0082 | UAT-0082 | central | RGS | desktop | /admin/execution/ready-goods | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |
| FAIL-AUTH-CRED-0087 | UAT-0087 | central | RGS | desktop | /admin/rgs-tv | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_RGS_EMAIL, TEST_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_RGS_EMAIL, TEST_RGS_PASSWORD |

---

## tranche-07-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0097 | UAT-0097 | central | 3PGS | desktop | /admin/3pcs-store | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0098 | UAT-0098 | central | 3PGS | desktop | /admin/3pgs-procurement-queue | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0099 | UAT-0099 | central | 3PGS | desktop | /admin/3pgs-visibility | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0100 | UAT-0100 | central | 3PGS | desktop | /admin/3pgs-mobile-urgent | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0101 | UAT-0101 | central | 3PGS | desktop | /admin/3pgs-tv | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_PRODUCTION_EMAIL, TEST_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0104 | UAT-0104 | central | SALES | desktop | /sales/dashboard | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0105 | UAT-0105 | central | SALES | desktop | /sales/3pgs-visibility | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_SALES_EMAIL, TEST_SALES_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_SALES_EMAIL, TEST_SALES_PASSWORD |
| FAIL-AUTH-CRED-0106 | UAT-0106 | central | TV | tv | /tv/arabic-sweets | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0107 | UAT-0107 | central | TV | tv | /tv/chocolate | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0108 | UAT-0108 | central | TV | tv | /tv/dragees | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0109 | UAT-0109 | central | TV | tv | /tv/fusion | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0110 | UAT-0110 | central | TV | tv | /tv/bakery | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |

---

## tranche-08-auth crawl failures (2026-09-05)

### Functional / access / blocked

| FAIL-ID | UAT-ID | App | Role | Device | Route/Page | Function | Expected | Actual | Severity | Screenshot(s) | Console/Network | Repro | Owning repo | Layer | Fix dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAIL-AUTH-CRED-0111 | UAT-0111 | central | TV | tv | /tv/nuts | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0112 | UAT-0112 | central | RGS | tv | /tv/rgs | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_RGS_EMAIL, TEST_TV_RGS_PASSWORD |
| FAIL-AUTH-CRED-0113 | UAT-0113 | central | 3PGS | tv | /tv/3pgs | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_TV_PRODUCTION_EMAIL, TEST_TV_PRODUCTION_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_TV_PRODUCTION_EMAIL, TEST_TV_PRODUCTION_PASSWORD |
| FAIL-AUTH-CRED-0114 | UAT-0114 | central | BUYER | phone | /buyer | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0115 | UAT-0115 | central | BUYER | phone | /buyer/catalogue | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0116 | UAT-0116 | central | BUYER | phone | /buyer/cart | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0117 | UAT-0117 | central | BUYER | phone | /buyer/orders | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0118 | UAT-0118 | central | BUYER | phone | /buyer/account | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0119 | UAT-0119 | central | BUYER | phone | /buyer/support | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0120 | UAT-0120 | central | BUYER | phone | /buyer/documents | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-CRED-0121 | UAT-0121 | central | BUYER | phone | /buyer/access-request | Authenticated crawl | Logged-in role surface | BLOCKED — missing secret(s): TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD | P1 | pre-auth preserved | — | Auth rerun | Central | Deploy/Auth | TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD |
| FAIL-AUTH-DEPLOY-0122 | UAT-0122 | ai-studio | AI_CATALOGUE | desktop-chrome | / | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0123 | UAT-0123 | ai-studio | AI_CATALOGUE | iphone-14 | /media | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0124 | UAT-0124 | ai-studio | AI_APPROVER | desktop-chrome | /media/review | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0125 | UAT-0125 | ai-studio | AI_CATALOGUE | desktop-chrome | /products/new/fast | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0126 | UAT-0126 | ai-studio | AI_CATALOGUE | desktop-chrome | /testing/pilot-readiness | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0127 | UAT-0127 | ai-studio | AI_CATALOGUE | iphone-14 | /media | Authenticated crawl on ai-studio deploy | Role surface on correct preview host | BLOCKED — missing TEST_AI_STUDIO_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for ai-studio) | P1 | — | — | tranche-08-auth | oasis-ai-studio | Deploy | TEST_AI_STUDIO_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0128 | UAT-0128 | trace | TRACE_SCANNER | desktop-chrome | / | Authenticated crawl on trace deploy | Role surface on correct preview host | BLOCKED — missing TEST_TRACE_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for trace) | P1 | — | — | tranche-08-auth | oasis-trace | Deploy | TEST_TRACE_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0129 | UAT-0129 | trace | TRACE_SCANNER | desktop-chrome | /scan | Authenticated crawl on trace deploy | Role surface on correct preview host | BLOCKED — missing TEST_TRACE_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for trace) | P1 | — | — | tranche-08-auth | oasis-trace | Deploy | TEST_TRACE_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0130 | UAT-0130 | trace | TRACE_SCANNER | desktop-chrome | /scan | Authenticated crawl on trace deploy | Role surface on correct preview host | BLOCKED — missing TEST_TRACE_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for trace) | P1 | — | — | tranche-08-auth | oasis-trace | Deploy | TEST_TRACE_PREVIEW_URL |
| FAIL-AUTH-DEPLOY-0131 | UAT-0131 | trace | TRACE_SCANNER | desktop-chrome | /scan | Authenticated crawl on trace deploy | Role surface on correct preview host | BLOCKED — missing TEST_TRACE_PREVIEW_URL (Central TEST_PREVIEW_URL is not valid for trace) | P1 | — | — | tranche-08-auth | oasis-trace | Deploy | TEST_TRACE_PREVIEW_URL |
