# RBAC Decision Recommendation — WhatsApp Operator Inbox (Stage-1)

**Date:** 2026-06-04  
**Scope:** `/admin/operator-inbox`, `/admin/whatsapp`  
**Environment assessed:** Staging behavior + static code audit  
**Implementation status:** Recommendation only — **no code changes in this sprint**

---

## Current behavior (observed + static)

| Layer | Behavior | Evidence |
|-------|----------|----------|
| **Nav visibility** | WhatsApp Inbox link uses `moduleKey: "support"` in `AdminLayout`. Roles without `support` in `ROLE_MODULE_ACCESS` (e.g. `FINANCE_HEAD`, `DISPATCH_MANAGER`) do not see the nav link. | Static: `src/lib/auth/adminModuleAccess.ts`, `AdminLayout.tsx` |
| **Direct URL** | Routes use `ProtectedRoute` + `RoleProtectedRoute allowedRoles={ADMIN_STAFF_ROLES}`. Any admin-staff role can navigate to `/admin/operator-inbox` by URL. | Static: `rbac-url-access.md` |
| **Data visibility (post Option A RLS)** | Even when URL is reachable, non-inbox-reader roles see **0 packets** via RLS. Inbox readers (`SUPER_ADMIN`, `ADMIN`, `SUPPORT_EXECUTIVE`) see open packets. | `wa_stage1_rls_post_apply_verification.md`, finance/dispatch screenshots |
| **Edge invoke** | All WhatsApp Edge functions have `verify_jwt = false`. Anon key + function slug can invoke reply/classify/route outside UI. | Static audit — **separate NO-GO for send pilot** |

**Net effect today:** Soft RBAC — nav hides the module for many roles, but direct URL is allowed at the route layer; **RLS now enforces data** for packet visibility.

---

## Option 1 — Keep soft RBAC (current + RLS)

### Pros
- Minimal engineering churn; aligns with read-only observation pilot.
- RLS Option A already prevents finance/dispatch from seeing packet rows even if they hit the URL.
- Support and admin workflows unchanged; no new redirect UX to maintain.

### Cons
- Direct URL still loads inbox shell for non-support admin-staff (empty list for non-readers).
- Does not address Edge anon-key invoke gap (orthogonal but related security concern).
- Operators may find empty inbox confusing without an explicit "no access" message.

### Security impact
- **Medium (UI layer):** Route reachable but data gated by RLS — acceptable for read-only pilot if documented.
- **High (send path):** Does not fix `verify_jwt = false` on `whatsapp-operator-reply` — must remain NO-GO for send pilot regardless.

### Operational impact
- Low friction for support/admin.
- Training note: "No nav link ≠ no URL access; RLS controls data."

---

## Option 2 — Add hard route enforcement

Implement `AdminModuleRoute moduleKey="support"` (or equivalent) on operator inbox routes so non-support admin-staff receive redirect/403 before the page shell loads.

### Pros
- Clear deny at UI layer; matches operator mental model (hidden nav = no access).
- Reduces support tickets from empty inbox confusion.
- Defense in depth alongside RLS.

### Cons
- Requires role matrix review (e.g. should `OPERATIONS_MANAGER` ever observe WhatsApp?).
- May block legitimate future cross-module observers unless role map updated.
- Does not alone secure Edge invoke path.

### Security impact
- **Low–medium improvement** at UI layer; RLS remains authoritative for data.
- Still requires Edge JWT hardening before send pilot.

### Operational impact
- One-time role matrix sign-off with Ops.
- Possible need to grant `support` module to roles that legitimately need read-only visibility.

---

## Recommendation

**Adopt Option 1 for Stage-1 read-only observation pilot**, with these **conditions**:

1. **Document** soft RBAC + RLS data gate in operator training (this pack + `rbac-url-access.md`).
2. **Schedule Option 2** before any send-pilot or non-support staff onboarding to inbox.
3. **Treat Edge JWT + reply idempotency** as mandatory regardless of route choice (see `idempotency-reply-gap.md`).

**Optional quick win (non-blocking):** Show an in-app banner when authenticated user is not an inbox reader: "You do not have WhatsApp inbox access" instead of an empty list — UX only, not a substitute for Option 2 or RLS.

---

## Decision requested from stakeholders

| Question | Suggested answer (Stage-1) |
|----------|---------------------------|
| Read-only pilot with soft RBAC + RLS? | **Yes** |
| Hard route enforcement before send pilot? | **Yes — implement in WA-02B+ hardening sprint** |
| Expand inbox nav to finance/dispatch? | **No** — RLS intentionally excludes |

---

*No implementation performed in this document.*
