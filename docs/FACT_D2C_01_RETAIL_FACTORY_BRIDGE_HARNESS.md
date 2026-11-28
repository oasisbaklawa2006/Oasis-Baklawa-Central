# FACT-D2C-01 — D2C Website → Central Factory | separate scope and read-only harness

**Date:** 20 November 2026. **Tracking:** [Central #685](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/685).  
**Stage:** DESIGN/HARNESS, **not implemented runtime integration**; D2C checkout and factory acceptance remain **NO-GO** until governed release.
**Relation:** an additive sub-scope alongside the 55 factory certification checkpoints, not a replacement or additional Appverse numbered Point.

## Owner outcome

Use existing operational engines for D2C retail orders without introducing B2B invoice/advance/commercial workflow, B2B company identity, wholesale picking or B2B Dispatch Packing List where inappropriate.

```text
Gifting website -> Core retail order/payment acceptance (or approved future COD eligibility)
                 -> retail factory intake projection (Core; not yet built)
                 -> Central Order Pool + retail CRM/exception ownership
                 -> Operations: ready stock | P&A | production shortage
                 -> P&A with RGS/3PGS materials as needed (reuse Core custody + BOM)
                 -> retail carton/parcel/Trace/waybill/courier (Core + Central)
                 -> independent physical Security Gate
                 -> shipping/tracking / customer status
```

**Critical distinction:** Direct retail order intake into factory planning/P&A does *not* prohibit RGS food supply to P&A, RGS allocation to production, or 3PGS packaging/component supply to P&A. The default retail order must not become a wholesale RGS fulfilment request.

## Cross-repo authority and existing evidence (20 Nov 2026)

| Concern | Existing authoritative code | Disposition |
| --- | --- | --- |
| D2C quote/order/payment | Core `retail_orders` migration `20261119200000`; Core `retail-checkout` / Razorpay webhook candidate | **REUSE**; not live/deployed; no physical stock reservation enforced |
| Gifting checkout | `oasis-baklawa-gifting/src/payments/launch-policy.ts` (`operational=false`), `retail-checkout-client.ts` not wired | **REUSE/EXTEND later**; preserve launch hold |
| Website enquiry/CRM | Central #677 + Gifting F01–F10 issue #2 | **REUSE**; do not create competing receiver |
| Central order management | `CentralOrderPoolCommandCentre.tsx` + governed B2B order readers | **EXTEND read projection** after Core retail factory contract exists |
| Operations / production | `OperationsController.tsx` reads Core `production_jobs` | **REUSE**; retail demand only when real shortage demands production |
| P&A | `AssemblyManagement.tsx` reads `b2b_assembly_jobs`, `orders/order_items`; all writes via governed RPC | **EXTEND bridge/visibility** but do not repurpose B2B keys or create parallel BOM authority |
| Material custody | RGS, 3PGS, P&A governed Core reservation/issue/acknowledgement chains | **REUSE** existing sources |
| B2B dispatch | `DispatchManagement.tsx` owns `b2b_dispatch_*` DPL chain | **KEEP UNCHANGED**; retail courier/parcel path needs distinct validated Core contract |
| Trace + Security Gate | Existing barcode/label/gate separation | **REUSE shared physical verification**, no bypass |

Existing controlling registers: [Factory #368](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/368), [D2C backend #566](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/566), [Gifting #2](https://github.com/oasisbaklawa2006/oasis-baklawa-gifting/issues/2). Core retail checkout source indicates `stock_reservation_enforced=false`, a quote reservation *window* only, and pending commercial policy. A local test harness cannot change those facts.

## Dedicated requirements in this sub-scope

- **RD01: Core acceptance and idempotent handoff.** Distinguish pending/failed/cancelled from independently verified prepaid; distinct COD eligibility after policy approval only. Persist unique retail order ID, order version, source channel and event evidence. Replay/concurrency creates no duplicates.
- **RD02: Staff CRM and customer safety.** Reuse #677 enquiry receiver, add retail order context to the appropriate customer service surface, separate purchaser, recipient and optional account. Respect PII roles; B2B account/credit are not retail facts.
- **RD03: Operations triage.** Core-backed order source/owner/SLA, preparation deadline, goods availability, fulfilment requirement and exception owner. Three choices: already available retail stock to pack; P&A required; production shortage → RGS/Production → accepted ready output → P&A.
- **RD04: P&A extension.** Retail gift message, ribbon, product variants, individual pack quantities, QC/labels and photo/artwork versions in the existing job/workboard. No duplicate assembly ledger or direct client-side mutable stock.
- **RD05: Stock and component allocation.** Approved BOM and Core balances only. RGS food issue and 3PGS packaging procurement/issue retain custody acknowledgments; no physical release from a mere reservation window.
- **RD06: Retail dispatch.** Individual parcel/tracking/courier, verified label/scan/weight, recipient/conceal-invoice rule, COD collection instruction if later authorized, exception handling. Cannot inherit B2B DPL or B2B Finance advanced payment decisions by default.
- **RD07: Independent gate.** Security authorizes physical exit independently; Trace label scan, courier carton/vehicle handoff, denied/replayed gate scans and immutable evidence required.
- **RD08: Priority UI.** Unified management overview with distinct retail/B2B filters; floor queues segmented by actual work. Priority from **server-attested dispatch SLA and operational exception**, not blanket priority for retail and not bright colours alone.
- **RD09: Failure recovery.** Wrong SKU, wrong customer, unpaid/pending payment, COD undecided, understock, rejected QC, missing component, pending handover, retry/offline, cancellation, late paid webhook, partial dispatch and courier cancellation all fail closed and show owner/escalation.
- **RD10: Certification.** Full test orders, negative-path ledger, Core RLS/pgTAP, unit/contract/UI E2E, protected exact-head CI, provider staging test, physical scanner/label/gate UAT, owner-governed release.

## First engineering harness in this branch

`src/lib/factory-d2c/retailIntakeTriage.ts` is a **pure read-only classifier** with no database, API or UI connections. It accepts a future *attested* Core planning projection and returns **HOLD** or **PLANNING_CANDIDATE_ONLY**. It can never release stock, accept COD, create a job, book a courier or mark dispatched.

`src/lib/factory-d2c/__tests__/retailIntakeTriage.test.ts` covers:
- T01 prepaid/P&A, T02 production requirement, T03 ready stock retail pack.
- T04 COD forbidden without policy, T05 pending/failed payment and missing verified event.
- T06 deterministic replay (read-only), T07 pending/cancelled orders.
- T08 SLA evidence required for risk highlight, not retail blanket priority.
- T09 invalid order identity/version, T10 missing Core planning proof / unknown path.

**Important:** Passing these tests will prove only the pure read-only planning contract, not a live Core handoff. No Gifting, Core, Trace or Central runtime factory pipeline code is changed by this PR.

## Next ordered engineering steps

1. Reconcile current Core retail order schema and intake product/BOM/stock controls; certify the exact Core acceptance event and payment source of truth. Do not build a new customer/order master.
2. Review Core owner-specific forward-only migration / RPC proposal with deduplication and tenant isolation tests. No migration applied until reviewed.
3. After Core attested runtime contract exists, adapt read-only Central Order Pool/Operations projections first; confirm source-filtered counts, ticket assignment and SLA.
4. Extend P&A and retail parcel/Trace operations using the existing governed backends; preserve B2B regression suite.
5. Run isolated staging E2E with actual payment sandbox/provider and field device tests; keep live release behind protected approvals.

## Owner decisions batched for a single approval package

- COD: eligibility by PIN/order value/customer, prepaid vs collection timing, cancellation/no-show risk, collection evidence and reconciliation.
- Courier/serviceability cutoffs and dispatch SLA, order cancellation/refund/return policy, stock reservation window and late payment handling.
- PII roles/retention for personal gift recipient information and approval of retail packaging exceptions.

**Recommended safe interim posture:** verified prepaid only; **COD HOLD**, unknown stock HOLD, failed payment HOLD, unknown SLA not urgent. No fictional stock, promise date, customer identity, fees, credit or delivery capability.

## Exit criteria

- No production settings, payments, customer communication or live checkout turned on.
- No existing B2B code paths, data schema or roles modified in the harness PR.
- Central, Core and Gifting work stays in their respective repositories.
- Final status remains `NOT CERTIFIED` until integrated staged execution and physically witnessed gate/Trace acceptance.
