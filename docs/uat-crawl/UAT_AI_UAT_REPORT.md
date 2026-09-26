# APPVERSE AI UAT — Tranche 1

Generated: 2026-09-26T21:59:30.552Z  
Target: https://oasis-baklawa-central.vercel.app/  
AI planner: disabled  
Visual model input: disabled

**PASS 0 · FAIL 10 · BLOCKED 0**

| UAT | Status | Role | Severity | Final URL | Actual |
|---|---|---|---|---|---|
| UAT-001 | **FAIL** | DISPATCH_MANAGER | P0 | https://oasis-baklawa-central.vercel.app/staff/login | Credentialed login or authenticated scenario failed; see sanitized diagnostics. |
| UAT-002 | **FAIL** | ANONYMOUS | P0 | https://oasis-baklawa-central.vercel.app/admin/finance | Anonymous Finance direct-open must land on governed unauthenticated entry (/login, /staff/login, or /buyer/login) [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m Expected: [32mtrue[39m Received:  |
| UAT-003 | **FAIL** | DISPATCH_MANAGER | P0 | https://oasis-baklawa-central.vercel.app/staff/login | Credentialed login or authenticated scenario failed; see sanitized diagnostics. |
| UAT-004 | **FAIL** | DISPATCH_MANAGER | P0 | https://oasis-baklawa-central.vercel.app/staff/login | Credentialed login or authenticated scenario failed; see sanitized diagnostics. |
| UAT-005 | **FAIL** | DISPATCH_MANAGER | P0 | https://oasis-baklawa-central.vercel.app/staff/login | Credentialed login or authenticated scenario failed; see sanitized diagnostics. |
| UAT-006 | **FAIL** | DISPATCH_MANAGER | P0 | https://oasis-baklawa-central.vercel.app/staff/login | Credentialed login or authenticated scenario failed; see sanitized diagnostics. |
| UAT-007 | **FAIL** | DISPATCH_MANAGER | P0 | https://oasis-baklawa-central.vercel.app/staff/login | Credentialed login or authenticated scenario failed; see sanitized diagnostics. |
| UAT-008 | **FAIL** | DISPATCH_MANAGER | P1 | https://oasis-baklawa-central.vercel.app/staff/login | Credentialed login or authenticated scenario failed; see sanitized diagnostics. |
| UAT-009 | **FAIL** | ASSEMBLY_MANAGER | P1 | https://oasis-baklawa-central.vercel.app/staff/login | Credentialed login or authenticated scenario failed; see sanitized diagnostics. |
| UAT-010 | **FAIL** | DISPATCH_MANAGER | P0 | https://oasis-baklawa-central.vercel.app/staff/login | Credentialed login or authenticated scenario failed; see sanitized diagnostics. |

## Evidence details

### UAT-001 — FAIL

- **Role:** DISPATCH_MANAGER
- **Expected:** After logout the browser must reach the login flow and a direct revisit of /admin/dispatch-mgmt must not restore the authenticated Dispatch surface.
- **Actual:** Credentialed login or authenticated scenario failed; see sanitized diagnostics.
- **Final URL:** https://oasis-baklawa-central.vercel.app/staff/login

### UAT-002 — FAIL

- **Role:** ANONYMOUS
- **Expected:** An anonymous direct-open of /admin/finance must not render the Finance workspace and must end in an authentication-safe destination.
- **Actual:** Anonymous Finance direct-open must land on governed unauthenticated entry (/login, /staff/login, or /buyer/login) [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m Expected: [32mtrue[39m Received: [31mfalse[39m
- **Final URL:** https://oasis-baklawa-central.vercel.app/admin/finance

### UAT-003 — FAIL

- **Role:** DISPATCH_MANAGER
- **Expected:** After Assembly login the current role must resolve as Assembly/production and no Dispatch role badge or Dispatch-home title may remain from the prior session.
- **Actual:** Credentialed login or authenticated scenario failed; see sanitized diagnostics.
- **Final URL:** https://oasis-baklawa-central.vercel.app/staff/login

### UAT-004 — FAIL

- **Role:** DISPATCH_MANAGER
- **Expected:** The post-login destination must be /admin/dispatch-mgmt or the Dispatch role home must provide the governed Dispatch workflow without redirecting into unrelated authority.
- **Actual:** Credentialed login or authenticated scenario failed; see sanitized diagnostics.
- **Final URL:** https://oasis-baklawa-central.vercel.app/staff/login

### UAT-005 — FAIL

- **Role:** DISPATCH_MANAGER
- **Expected:** Dispatch must not remain on any Finance/Accounts route after direct navigation and must not be offered Finance controls in permitted navigation.
- **Actual:** Credentialed login or authenticated scenario failed; see sanitized diagnostics.
- **Final URL:** https://oasis-baklawa-central.vercel.app/staff/login

### UAT-006 — FAIL

- **Role:** DISPATCH_MANAGER
- **Expected:** The Dispatch role navigation must not render broad Admin/Governance/Store/Gate tools and direct protected routes must fail closed.
- **Actual:** Credentialed login or authenticated scenario failed; see sanitized diagnostics.
- **Final URL:** https://oasis-baklawa-central.vercel.app/staff/login

### UAT-007 — FAIL

- **Role:** DISPATCH_MANAGER
- **Expected:** Dispatch must have no cmd_war_room authority through cards, navigation, or direct URL access.
- **Actual:** Credentialed login or authenticated scenario failed; see sanitized diagnostics.
- **Final URL:** https://oasis-baklawa-central.vercel.app/staff/login

### UAT-008 — FAIL

- **Role:** DISPATCH_MANAGER
- **Expected:** After loading completes, DispatchManagement must show the governed-consignments UI and either rows or the explicit 'No governed consignments yet.' empty state; an unexplained blank panel is FAIL.
- **Actual:** Credentialed login or authenticated scenario failed; see sanitized diagnostics.
- **Final URL:** https://oasis-baklawa-central.vercel.app/staff/login

### UAT-009 — FAIL

- **Role:** ASSEMBLY_MANAGER
- **Expected:** Assembly role home/navigation must be production-oriented and direct unrelated authority routes must fail closed.
- **Actual:** Credentialed login or authenticated scenario failed; see sanitized diagnostics.
- **Final URL:** https://oasis-baklawa-central.vercel.app/staff/login

### UAT-010 — FAIL

- **Role:** DISPATCH_MANAGER
- **Expected:** Every forbidden direct route must bounce Dispatch to a permitted destination; hiding links alone is not sufficient for PASS.
- **Actual:** Credentialed login or authenticated scenario failed; see sanitized diagnostics.
- **Final URL:** https://oasis-baklawa-central.vercel.app/staff/login

