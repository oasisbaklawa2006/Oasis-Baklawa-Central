# APPVERSE END-TO-END JOURNEY CENSUS

**Run type:** Read-only discovery and certification-design audit. No code repaired, no migrations created, no production changed, no implementation PRs opened.
**Repos audited:** `oasisbaklawa2006/Oasis-Baklawa-Central`, `oasisbaklawa2006/oasis-supabase-core`, `oasisbaklawa2006/oasis-baklawa`. All `main` at session time (`Oasis-Baklawa-Central@ea56500e5373515f283a79742a9a014be206c55e`).
**Method:** Four parallel deep-research passes, one per journey, each required to cite exact migration files, RPC names, and UI file paths for every claim rather than infer from screen existence, CI status, or prior certification alone.

---

## CONTINUITY WITH PRIOR CLAUDE WORK

This is a genuinely new mission, not a restart of prior work. It does not duplicate or conflict with:

- **PR #603** (`fix(uat-462): restore evidence pipeline`) — a bounded CI/tooling repair for the physical-UAT evidence pipeline, unrelated to application-journey correctness. Left open, unmodified, still watched.
- **PR #462** (`Physical UAT Readiness Matrix`) — the existing UAT-#### route/role/device evidence ledger. This census **reuses** its two known defect findings (Select-dropdown-behind-Sheet on mobile in `AdminClients.tsx`; pending-count KPI desync in the same file) as a starting hypothesis and independently re-examined the code: **both are confirmed already fixed** in that one screen, with a regression test covering the Select/Sheet issue. This census does **not** re-litigate #462's physical-evidence rows.
- **Mission Control** (`APPVERSE_MISSION_CONTROL.md`, `appverse-control/state.json`, `appverse-control/dependency-graph.json`) — this census's findings sharpen, but do not contradict, Stage 05 "Order / Pre-Factory Commercial Flow — 🔴 NOT CLEARED" and Stage 19 "UI/UX Completion — 🔴 NOT CLEARED": the reasons those stages are not cleared are now concretely enumerated below rather than asserted generically.

No prior certification is reopened without new evidence; the findings below are exactly that new evidence, cited to exact files.

---

## WHAT THIS CENSUS PROVES AND WHAT IT DOES NOT

The four journeys share a consistent shape: **the commercial/financial spine of the platform (order → advance → clearance → dispatch-gate) is genuinely well-engineered** — idempotency, advisory locks, fail-closed clearance gates, immutable audit trails, and RBAC enforced at the RPC/RLS layer (not just the UI) are proven with exact citations across dozens of transitions. This is real, substantive engineering, not UI-only theater.

Against that, four categories of gap were found, all evidence-backed:

1. **A tail with no front door.** The DB-governed delivery-proof and complaint-resolution system (Golden Pipeline step 8) is fully built and never called from any UI in either app.
2. **A parallel, weaker system doing the job the strong one was built for.** The actually-used `support_tickets` system lacks almost everything the unused `commercial_complaints` system has: no enum, no message thread, no notification wiring, no audit ledger, no scheduler, and one RLS policy that silently empties the queue for its designated owner role.
3. **A recurring defect class, fixed once, not fixed everywhere.** The KPI/count-desync pattern #462 found and fixed in `AdminClients.tsx` independently recurs in the Support module across three different screens.
4. **Isolated but real drift/inconsistency bugs**: a duplicated advance-calculation formula, an RPC-naming ambiguity, an orphaned role, a route-gating inconsistency, and one confirmed idempotency-fix that wasn't applied to a sibling RPC.

**None of these are physical-hardware or credential-gate limitations.** They are software defects and gaps, fully within this programme's power to fix without any physical UAT. The only genuinely PHYSICAL-UAT-REQUIRED / CREDENTIAL-GATED items found are: the barcode scan at the dispatch gate itself (software and RPC around it are proven), and the MSG91 OTP send/verify/retry mechanics (not read in depth, would need a live provider sandbox regardless of code review).

---

## JOURNEY-BY-JOURNEY SUMMARY

| Journey | Document | Headline finding |
|---|---|---|
| A — B2B Customer | `CUSTOMER_JOURNEY_MATRIX.md` | Intake → approval → login → catalogue → cart → checkout → 30%-advance is **PROVEN** end-to-end with real code citations, including the specific rounding rule and its isolation from a legacy 50% path. General-query idempotency has an unfixed sibling of an already-fixed ticket bug. No reorder RPC exists. Buyer-facing production/QC/delay visibility is real but coarse (7-state enum, no QC or delay detail). |
| B — Internal Roles | `INTERNAL_ROLE_JOURNEY_MATRIX.md` | Login→role→landing-route chain is **PROVEN** as real server-side authority (not UI-only) for every role checked. Finance and Sales dashboards are clean (no count/list divergence). Found one orphaned role (`SALES_MANAGER`), one route-gate inconsistency, one self-documented blanket-authorization gap in production RPCs, and confirmed the #462 defect classes are fixed only where originally found. |
| C — Golden Order Pipeline | `GOLDEN_ORDER_PIPELINE_MATRIX.md` | SO→advance→clearance→production-handoff→invoice→balance→dispatch-clearance→gate-release is **PROVEN** with deep evidence (idempotency, advisory locks, dual independent clearance gates, immutable settlement). The tail — delivery proof and complaint resolution — is DB-only with **zero UI wiring found anywhere.** Two lower-severity drift/naming issues found in the middle of the chain. |
| D — Support | `SUPPORT_JOURNEY_MATRIX.md` | The weakest-proven journey. Ticket raise is solid; almost everything downstream — assignment, queue visibility for its own designated role, acknowledgement, communication, escalation, department routing, notification, governed audit, SLA automation — is **BROKEN or UNPROVEN/NOT FOUND**, several confirmed absent by the codebase's own comments rather than merely undiscovered. A separate, well-governed complaint system exists and is completely unused. |
| E — Exception/Recovery | (folded into C and D above per mission structure) | Payment-missing, payment-duplicate, order-edit-after-SO, concurrent-action, and duplicate-click paths are **PROVEN** robust across the pipeline (advisory locks + idempotency keys used near-universally). Production-delay and QC-failure paths are **UNPROVEN** (RGS migrations not read this pass). SLA-timeout/escalation recovery is **confirmed absent**, not just unproven. |

---

## EXISTING TEST RECONCILIATION

| Prior evidence | Scope | Still valid? |
|---|---|---|
| PR #462 physical-UAT screenshots/manifests | Route/role/device visual+function crawl, ~131 surfaces | Valid for what it covers (page-load auth gating). Does not cover transition-level RPC/DB correctness — that gap is exactly what this census fills. Not duplicated here. |
| `selectSheetStacking.test.tsx` | Regression test for the Select-in-Sheet bug | Valid, confirmed present, confirmed passing in spirit (code shape matches the fix) — **not re-run this session**. |
| `orderManagementSurfaceGuard.test.ts`, `tests/factory-operations-order-production-release.cert.spec.ts` | Production-release RPC call-site + role-guard tests | Cited as evidence for Golden Pipeline §3 (PROVEN) — **not re-run this session**, existence + content consistent with the claimed behavior confirmed by reading. |
| `supabase/tests/20260917170000_support_ticket_idempotency_v2_contract.sql` | Ticket-v2 idempotency contract test | Cited as evidence for Support §1 (PROVEN) — confirms the fix pattern that FL-CUST-01 found *not* applied to the general-query RPC. |
| Mission Control Stage 05/19 "NOT CLEARED" | Programme-level status | Remains accurate; this census is the delta that explains *why*, in concrete terms, for the first time. |

No prior certification was found to be contradicted by current code. Several were found to be under-scoped (proving page-load, not transition correctness) — that is a scope gap in the prior evidence, not a defect in it.

---

## DEFECT / GAP COUNT

See `JOURNEY_FAILURE_LEDGER.md` for the full cited list. Total: **22 findings** — 5 × P0, 8 × P1, 5 × P2, 4 × P3. See `JOURNEY_REPAIR_PLAN.md` for the 21-tranche bounded repair queue.

---

## FINAL RESPONSE

**END-TO-END JOURNEYS NOT YET PROVEN — REPAIR TRANCHE COUNT: 21**

Remaining tranches (P0→P3, full detail in `JOURNEY_REPAIR_PLAN.md`):

- **P0 (5):** TR-P0-1 support-queue RLS fix · TR-P0-2 SLA-state mis-stamp fix · TR-P0-3 unify support-ticket KPI predicates · TR-P0-4 general-query idempotency fix · TR-P0-5 deduplicate advance-calculation formula
- **P1 (7):** TR-P1-1 resolve DPL RPC naming ambiguity · TR-P1-2 build GATEKEEPER→COMPLETE UI · TR-P1-3 fix staff-on-behalf-of-customer ticket paths · TR-P1-4 resolve SALES_MANAGER orphaned role · TR-P1-5 build ticket communication/acknowledgement/notification · TR-P1-6 implement SLA/escalation automation · TR-P1-7 implement department-routing execution
- **P2 (5):** TR-P2-1 fix 3PGS-visibility route gate · TR-P2-2 verify/fix PACKING_SUPERVISOR landing route · TR-P2-3 scope production RPC authorization to department · TR-P2-4 consolidate or separate the two complaint systems (owner decision required) · TR-P2-5 server-derive SLA timers + missing audit records
- **P3 (4):** TR-P3-1 implement reorder flow · TR-P3-2 verify FINANCE_HEAD/FINANCE_EXEC differential · TR-P3-3 trace/harden logout-session-expiry · TR-P3-4 exhaustive Select-in-Sheet/KPI-divergence scan across all admin pages

Physical/credential gates remain separately and additionally required after software repair: dispatch-gate barcode scan (software proven, hardware act itself is physical-UAT), MSG91 OTP provider mechanics (credential-gated regardless of code state).
