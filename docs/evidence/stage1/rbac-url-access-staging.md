# E11 staging — RBAC direct URL access proof

**Captured:** 2026-06-04  
**URL:** https://cursor-central-vercel.vercel.app  
**Non-support account:** finance@oasisbaklawa.com (FINANCE_HEAD)  
**Support comparison account:** dispatch@oasisbaklawa.com (DISPATCH_HEAD)

## E10 — Nav hidden (finance)

**Artifact:** [`rbac-nav-hidden.png`](./rbac-nav-hidden.png)

**Observation:** Finance sidebar does **not** show "WhatsApp Inbox" link (support module nav filter works).

**Verdict:** **PASS** (nav hidden for non-support role)

## E11 — Direct URL access (finance)

**Artifact:** [`rbac-direct-url-operator-inbox.png`](./rbac-direct-url-operator-inbox.png)

**Steps:**
1. Authenticated as FINANCE_HEAD (no support module in nav).
2. Navigated directly to `/admin/operator-inbox`.

**Observation:**
- Route **loads** (no 403, no redirect to login).
- Operator inbox shell renders (same empty read-only state as dispatch session).
- Confirms static audit gap: **nav hiding ≠ URL blocking** for admin-staff roles.

**Verdict:** **Documented** (observation pilot acceptable if recorded). **Not** a send-pilot pass; Edge JWT hardening still NO-GO per evidence pack §2.6.

## Related static note

[`rbac-url-access.md`](./rbac-url-access.md)
