# WhatsApp Stage-1 Executive Summary

**To:** Dinesh Mutreja  
**From:** Engineering (Stage-1 finalization sprint)  
**Date:** 2026-06-04  
**Re:** WhatsApp operator inbox — Stage-1 readiness and GO recommendation

---

## What was fixed

Over PRs **#168–#172**, the team replaced fragile regex guards with **AST-based scanners** that prove the inbox UI performs **SELECT-only PostgREST** access and invokes only three allowed Edge functions. The wa-governance test suite (**137/137 pass**) is the CI anchor.

On staging, we identified why the inbox showed **zero packets** despite **15 open rows** in the database: legacy RLS policies referenced role keys that do not exist in the catalog, and related tables blocked the embed path. **Option A RLS** (`is_whatsapp_inbox_reader()` for SUPER_ADMIN, ADMIN, SUPPORT_EXECUTIVE) was applied on staging only. Post-apply verification confirms inbox readers see **15 packets**; finance and dispatch see **0** — matching intent.

A temporary staging account (`support.stage1@oasisbaklawa.com`) was used to capture governance-bar, read-only label, and full-inbox screenshots. Its password was rotated after an accidental doc commit; credential lives outside git.

---

## What was proven

| Area | Result |
|------|--------|
| Read-only UI guards | Static tests pass; no forbidden writes in inbox tree |
| Staging packet visibility | Inbox readers see data; non-readers denied by RLS |
| Governance disabled actions | Screenshot — Send Automation / Approve Draft / Reassign locked |
| Resolution panels | Screenshot — "read-only · not persisted" |
| Audit tables (override/suggestions) | SQL — zero rows (expected for Stage-1) |
| Webhook auto-order flag | Code defaults **off** when unset (unit tests); dashboard confirm still advised |
| Operator reply send | **NO-GO** — no idempotency; Edge JWT not enforced |

---

## What remains

Ten of fourteen PR #69 smoke checks were **not re-run** this sprint (keyboard shortcuts, localStorage features, mobile, devtools network, failed-message panel). Failure-path alerts (load error, phone validation, suggestions error) lack screenshots. Realtime refresh and failed-send panel evidence are **blocked** without natural traffic or forbidden test mutations. Human **Eng/Ops/Security sign-off** is empty. Temp account remains **active** until evidence and sign-off complete.

---

## Operational risks

1. **Reply send** — Live code path exists; expanding pilot without idempotency and JWT exposes duplicate sends and anon-key abuse.  
2. **Soft RBAC** — Nav hides WhatsApp for many roles, but direct URL still loads for admin-staff; RLS now protects data, not the Edge layer.  
3. **Temp account** — Active on staging; must be banned after sign-off.  
4. **Production** — No RLS migration or inbox changes applied; production parity not validated here.

---

## Recommendation

**GO WITH CONDITIONS** for a **read-only observation pilot on staging**.

Proceed with packet/thread observation and resolution panels for inbox-reader roles. **Do not** include operator reply send or webhook auto-order writes in the pilot. Close remaining smoke and alert evidence, obtain human sign-off, confirm webhook env in Supabase secrets, then disable the temp account.

**Production deployment and RLS apply:** separate approval required — **not authorized** in this sprint.

---

*Supporting artifacts: `docs/evidence/stage1/STAGE1_FINAL_READINESS_REPORT.md`, `docs/WHATSAPP_STAGE1_GO_NO_GO_EVIDENCE_PACK.md`*
