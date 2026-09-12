# UAT Visual + UX Crawl Index — auth-rerun

**UAT range:** UAT-0002..0020 minus UAT-0018/0020 (buyer sheet → post-fix-483)
**Crawl base URL:** https://oasis-baklawa-central-hvbmnekge-oasisbaklawa2006-6222s-projects.vercel.app
**Central baseline SHA:** `08ccb1cfd4a3624103f0681b5515e26727e77cd2`
**UX matrix:** [UAT_UX_FAILURE_MATRIX.md](./UAT_UX_FAILURE_MATRIX.md) (148 criteria)
**Captured:** 2026-09-09T04:51:17.988Z

| UAT ID | S0 | Route | State | Visual | Function | UX | Evaluated | Failures | Notes |
|---|---|---|---|---|---|---|---:|---:|---|
| UAT-0002 | [UAT-0002_central_admin_staff_operations-controller-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0002_central_admin_staff_operations-controller-default_S0-auth-settled.png) | /operations-controller | default | OBSERVED | OBSERVED | PASS | 4/148 | 0 | Authenticated via TEST_OPERATIONS_* (values not logged) |
| UAT-0003 | [UAT-0003_central_gate_security_security-gate-default_S0-auth-settled.png](../../uat-evidence/screenshots/auth-rerun/UAT-0003_central_gate_security_security-gate-default_S0-auth-settled.png) | /security-gate | default | OBSERVED | OBSERVED | PASS | 4/148 | 0 | Authenticated via TEST_GATE_* (values not logged). titl |

**Pre-auth evidence preserved** in `tranche-01/` and `tranche-02/` — not overwritten.
**Authenticated complete:** 2 / 2
**All required secrets present for this tranche.**
