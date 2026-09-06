# APPVERSE AI UAT — Tranche 1

Generated: 2026-09-06T20:04:25.239Z  
Target: https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/  
AI planner: disabled  
Visual model input: disabled

**PASS 10 · FAIL 0 · BLOCKED 0**

| UAT | Status | Role | Severity | Final URL | Actual |
|---|---|---|---|---|---|
| UAT-001 | **PASS** | DISPATCH_MANAGER | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/login | Logout reached Login and a direct Dispatch revisit returned to Login without restoring authenticated Dispatch content. |
| UAT-002 | **PASS** | ANONYMOUS | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/login | Anonymous Finance probe failed closed to the canonical Login route with no protected Finance content. |
| UAT-003 | **PASS** | DISPATCH_MANAGER | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin | Assembly login replaced Dispatch session state and rendered the production role home at /admin. |
| UAT-004 | **PASS** | DISPATCH_MANAGER | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt | Dispatch landed on /admin/dispatch-mgmt with the governed carton/DPL workflow. |
| UAT-005 | **PASS** | DISPATCH_MANAGER | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt | Finance navigation absent; direct probes: /admin/finance -> /admin/dispatch-mgmt; /admin/finance-governance -> /admin/dispatch-mgmt; /admin/accounts-release -> /admin/dispatch-mgmt |
| UAT-006 | **PASS** | DISPATCH_MANAGER | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt | All-tools least privilege verified; direct probes: /admin/users -> /admin/dispatch-mgmt; /admin/settings -> /admin/dispatch-mgmt; /admin/audit -> /admin/dispatch-mgmt; /admin/ready-goods -> /admin/dispatch-mgmt; /admin/3pgs-packing-material -> /admin/dispatch- |
| UAT-007 | **PASS** | DISPATCH_MANAGER | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt | CMD/Legacy War Room absent; direct probes: /admin/cmd-war-room -> /admin/dispatch-mgmt; /admin/execution-command-center -> /admin/dispatch-mgmt; /admin/live-work-queues -> /admin/dispatch-mgmt; /admin/entity-graph-explorer -> /admin/dispatch-mgmt |
| UAT-008 | **PASS** | DISPATCH_MANAGER | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt | Governed Dispatch rendered an explicit empty state. |
| UAT-009 | **PASS** | ASSEMBLY_MANAGER | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/assembly-tasks | Assembly remained production-oriented; unrelated route probes: /admin/finance -> /admin/assembly-tasks; /security-gate -> /admin/assembly-tasks; /admin/cmd-war-room -> /admin/assembly-tasks |
| UAT-010 | **PASS** | DISPATCH_MANAGER | P1 | https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt | Every forbidden direct route failed closed: /admin/finance -> /admin/dispatch-mgmt; /admin/users -> /admin/dispatch-mgmt; /admin/cmd-war-room -> /admin/dispatch-mgmt; /admin/ready-goods -> /admin/dispatch-mgmt; /security-gate -> /admin/dispatch-mgmt |

## Evidence details

### UAT-001 — PASS

- **Role:** DISPATCH_MANAGER
- **Expected:** After logout the browser must reach the login flow and a direct revisit of /admin/dispatch-mgmt must not restore the authenticated Dispatch surface.
- **Actual:** Logout reached Login and a direct Dispatch revisit returned to Login without restoring authenticated Dispatch content.
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/login
- **Console errors:** 1
- **Failed requests:** 1

### UAT-002 — PASS

- **Role:** ANONYMOUS
- **Expected:** An anonymous direct-open of /admin/finance must not render the Finance workspace and must end in an authentication-safe destination.
- **Actual:** Anonymous Finance probe failed closed to the canonical Login route with no protected Finance content.
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/login

### UAT-003 — PASS

- **Role:** DISPATCH_MANAGER
- **Expected:** After Assembly login the current role must resolve as Assembly/production and no Dispatch role badge or Dispatch-home title may remain from the prior session.
- **Actual:** Assembly login replaced Dispatch session state and rendered the production role home at /admin.
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin
- **Console errors:** 1
- **Failed requests:** 1

### UAT-004 — PASS

- **Role:** DISPATCH_MANAGER
- **Expected:** The post-login destination must be /admin/dispatch-mgmt or the Dispatch role home must provide the governed Dispatch workflow without redirecting into unrelated authority.
- **Actual:** Dispatch landed on /admin/dispatch-mgmt with the governed carton/DPL workflow.
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt
- **Console errors:** 1
- **Failed requests:** 1

### UAT-005 — PASS

- **Role:** DISPATCH_MANAGER
- **Expected:** Dispatch must not remain on any Finance/Accounts route after direct navigation and must not be offered Finance controls in permitted navigation.
- **Actual:** Finance navigation absent; direct probes: /admin/finance -> /admin/dispatch-mgmt; /admin/finance-governance -> /admin/dispatch-mgmt; /admin/accounts-release -> /admin/dispatch-mgmt
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt

### UAT-006 — PASS

- **Role:** DISPATCH_MANAGER
- **Expected:** The Dispatch role navigation must not render broad Admin/Governance/Store/Gate tools and direct protected routes must fail closed.
- **Actual:** All-tools least privilege verified; direct probes: /admin/users -> /admin/dispatch-mgmt; /admin/settings -> /admin/dispatch-mgmt; /admin/audit -> /admin/dispatch-mgmt; /admin/ready-goods -> /admin/dispatch-mgmt; /admin/3pgs-packing-material -> /admin/dispatch-mgmt; /security-gate -> /admin/dispatch-mgmt
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt

### UAT-007 — PASS

- **Role:** DISPATCH_MANAGER
- **Expected:** Dispatch must have no cmd_war_room authority through cards, navigation, or direct URL access.
- **Actual:** CMD/Legacy War Room absent; direct probes: /admin/cmd-war-room -> /admin/dispatch-mgmt; /admin/execution-command-center -> /admin/dispatch-mgmt; /admin/live-work-queues -> /admin/dispatch-mgmt; /admin/entity-graph-explorer -> /admin/dispatch-mgmt
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt

### UAT-008 — PASS

- **Role:** DISPATCH_MANAGER
- **Expected:** After loading completes, DispatchManagement must show the governed-consignments UI and either rows or the explicit 'No governed consignments yet.' empty state; an unexplained blank panel is FAIL.
- **Actual:** Governed Dispatch rendered an explicit empty state.
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt
- **Console errors:** 1
- **Failed requests:** 1

### UAT-009 — PASS

- **Role:** ASSEMBLY_MANAGER
- **Expected:** Assembly role home/navigation must be production-oriented and direct unrelated authority routes must fail closed.
- **Actual:** Assembly remained production-oriented; unrelated route probes: /admin/finance -> /admin/assembly-tasks; /security-gate -> /admin/assembly-tasks; /admin/cmd-war-room -> /admin/assembly-tasks
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/assembly-tasks

### UAT-010 — PASS

- **Role:** DISPATCH_MANAGER
- **Expected:** Every forbidden direct route must bounce Dispatch to a permitted destination; hiding links alone is not sufficient for PASS.
- **Actual:** Every forbidden direct route failed closed: /admin/finance -> /admin/dispatch-mgmt; /admin/users -> /admin/dispatch-mgmt; /admin/cmd-war-room -> /admin/dispatch-mgmt; /admin/ready-goods -> /admin/dispatch-mgmt; /security-gate -> /admin/dispatch-mgmt
- **Final URL:** https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app/admin/dispatch-mgmt

