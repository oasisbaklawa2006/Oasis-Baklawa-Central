# Stage-1 evidence: RBAC direct URL access (static note)

**Status:** Static audit only — **does not claim pass**. Multi-role staging test still required.  
**Date captured:** 2026-06-03  
**Scope:** `/admin/operator-inbox`, `/admin/whatsapp`

---

## What static code review shows

| Layer | Mechanism | Static conclusion |
|-------|-----------|-------------------|
| Route guard | `ProtectedRoute` + `RoleProtectedRoute allowedRoles={ADMIN_STAFF_ROLES}` in `src/App.tsx` | Any admin-staff role can reach inbox routes by **direct URL** if authenticated |
| Nav visibility | `AdminLayout` `moduleKey: "support"` | WhatsApp Inbox nav link hidden for roles without `support` module access |
| Gap | No `AdminModuleRoute` on operator inbox routes | Nav hiding ≠ URL blocking for other admin-staff roles |

---

## What is NOT proven yet

- [ ] Non-support admin-staff role cannot see WhatsApp Inbox nav link (screenshot **E10** pending)
- [ ] `SUPPORT_EXECUTIVE` (or similar) direct URL behavior documented with session proof (**staging required**)
- [ ] Edge invoke authorization (`verify_jwt = false` on all WhatsApp functions) — separate NO-GO for send pilot

---

## Staging test required (do not skip)

1. Authenticate as a role **without** `support` in `ROLE_MODULE_ACCESS` (e.g. production-only role if available).
2. Confirm nav does not show "WhatsApp Inbox".
3. Attempt direct navigation to `/admin/operator-inbox`.
4. Record: allowed redirect, 403, or empty shell — attach screenshot and short note.

**Pass criteria (observation pilot):** Document actual behavior; for read-only pilot, staff-only route guard may be acceptable if documented. For send pilot, Edge JWT hardening is mandatory regardless.

---

## Related evidence

- Staging runbook: `docs/evidence/stage1/staging-evidence-runbook.md` (E10, E11, P16, P17)
- Evidence pack: `docs/WHATSAPP_STAGE1_GO_NO_GO_EVIDENCE_PACK.md` §1.7

---

*This document is a static note only. RBAC URL access is **pending** staging verification.*
