# APPVERSE AI UAT — Tranche 1

Generated: 2026-09-26T09:21:48.901Z  
Target: https://oasis-baklawa-central.vercel.app/  
AI planner: disabled  
Visual model input: disabled

**PASS 0 · FAIL 1 · BLOCKED 0**

| UAT | Status | Role | Severity | Final URL | Actual |
|---|---|---|---|---|---|
| UAT-001 | **FAIL** | DISPATCH_MANAGER | P0 | https://oasis-baklawa-central.vercel.app/login | [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: getByRole('heading', { name: /Welcome Back/i }) Expected: visible Timeout: 30000ms Error: element(s) not found Call log: [2m - Expect "toBeVisible" with timeout 30000m |

## Evidence details

### UAT-001 — FAIL

- **Role:** DISPATCH_MANAGER
- **Expected:** After logout the browser must reach the login flow and a direct revisit of /admin/dispatch-mgmt must not restore the authenticated Dispatch surface.
- **Actual:** [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed Locator: getByRole('heading', { name: /Welcome Back/i }) Expected: visible Timeout: 30000ms Error: element(s) not found Call log: [2m - Expect "toBeVisible" with timeout 30000ms[22m [2m - waiting for getByRole('heading', { name: /Welcome Back/i })[22m
- **Final URL:** https://oasis-baklawa-central.vercel.app/login

