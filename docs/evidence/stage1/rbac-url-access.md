# Stage-1 evidence: RBAC direct URL access

**Status:** Static audit + Session 1 staging observation captured.  
**Date captured (static):** 2026-06-03  
**Date captured (staging):** 2026-06-04  
**Scope:** `/admin/operator-inbox`, `/admin/whatsapp`

---

## What static code review shows

| Layer | Mechanism | Static conclusion |
|-------|-----------|-------------------|
| Route guard | `ProtectedRoute` + `RoleProtectedRoute allowedRoles={ADMIN_STAFF_ROLES}` in `src/App.tsx` | Any admin-staff role can reach inbox routes by **direct URL** if authenticated |
| Nav visibility | `AdminLayout` `moduleKey: "support"` | WhatsApp Inbox nav link hidden for roles without `support` module access |
| Gap | No `AdminModuleRoute` on operator inbox routes | Nav hiding ≠ URL blocking for other admin-staff roles |

---

## Session 1 staging observation (2026-06-04)

**Environment:** https://cursor-central-vercel.vercel.app  
**Non-support account:** `finance@oasisbaklawa.com` (FINANCE_HEAD)

| Check | Result | Artifact |
|-------|--------|----------|
| Nav: WhatsApp Inbox link | **Hidden** | [`rbac-nav-hidden.png`](./rbac-nav-hidden.png) |
| Direct URL: `/admin/operator-inbox` | **Allowed** — page loads, no 403/redirect | [`rbac-direct-url-operator-inbox.png`](./rbac-direct-url-operator-inbox.png) |

**Observed behavior:** Finance user **cannot** see WhatsApp Inbox in nav but **can** access `/admin/operator-inbox` directly. Same read-only inbox shell as other staff sessions (0 packets shown in Session 1).

---

## RBAC classification (owner decision required)

| Interpretation | Implication |
|----------------|-------------|
| **Soft RBAC (intentional)** | Nav guides role-appropriate workflows; finance/ops may retain read-only URL access for audit/oversight. Acceptable for **read-only observation pilot** if documented and signed off. |
| **RBAC gap (unintentional)** | Module nav implies access control; missing `AdminModuleRoute` (or equivalent) on operator-inbox routes is a **defect** to fix before send pilot or broader rollout. |

**Stage-1 posture:** Classify as **soft-RBAC with documented URL gap** for read-only planning. **Not** sufficient for send pilot — Edge JWT hardening remains NO-GO regardless (see evidence pack §2.6).

**Owner action:** Engineering + Security to confirm intended policy (soft vs hard module RBAC on `/admin/operator-inbox`).

---

## Remaining gaps

- [ ] Owner sign-off on soft-RBAC vs hard-RBAC for finance direct URL access
- [ ] Edge invoke authorization (`verify_jwt = false` on WhatsApp Edge functions) — separate NO-GO for send pilot
- [ ] SUPPORT_EXECUTIVE vs non-support comparison with **visible packets** (Session 2 after packet seed)

---

## Related evidence

- Session log: [`CAPTURE-SESSION-REPORT.md`](./CAPTURE-SESSION-REPORT.md)
- Staging runbook: [`staging-evidence-runbook.md`](./staging-evidence-runbook.md) (E10, E11)
- Evidence pack: `docs/WHATSAPP_STAGE1_GO_NO_GO_EVIDENCE_PACK.md` §1.7
