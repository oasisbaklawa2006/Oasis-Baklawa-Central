# MACRO POINT100 INTEGRATION MISSION

This branch is the Leap 11/14 integration tranche for Oasis Baklawa Appverse completion.

Objective: build and continuously repair the executable cross-repository journey from authenticated Buyer catalogue/order intent through governed quotation/SO, payment/finance, production, inventory, packing/DPL, dispatch, independent gate, Trace, customer completion and complaint-window opening.

## Current-main reconciliation (read-only census)

| Authority | Evidence |
|-----------|----------|
| Central protected `main` | `f41b9cee85ac4e534de1b77f2abcead73795ef7e` (merged #618 UAT harness; Point100 branch reconciled here) |
| Core production pin | SHA `5800f4b84ae72e7fef06d57c11fc22b3117f3c52` — Core #290 lineage, protected Production Migration Release **#245** / run `36636198402` |
| Merged Trace software (#37) | `894f27327381ce168d168530eba3c3722d71eaee` |
| Programme dependency census | `appverse-control/dependency-graph.json` on current `main` (15 declared Point100 upstream edges) |
| Software upstream census | All declared software lanes merged (Core #326/#300/#307/#321/#328/#309/#329, Central #588/#591, AI #217/#218/#220, Trace #38 on 2026-09-19, Buyer `4e5ec846`) — see `upstreamDependencyRegistry.ts` |
| Remaining production gates | `physical_uat_only` external evidence only (scanner/printer/TV/handheld/Gatekeeper/Buyer-phone/payment/provider) |

Live programme graph rows may lag protected merges; Point100 binds to repository/runtime evidence above, not stale OPEN states.

Rules:
- This is not an audit-only PR. Build the executable integration harness, adapters, fixtures, route bindings and repair code needed on Central to consume canonical authorities.
- Reuse and bind canonical macro tranches: Buyer revenue, Core Finance, Core Inventory/Factory, Central CRM, Central Order→Gate, Management #558, AI Catalogue, merged Trace #37, Core Dispatch Finalization #260, and production-certified Core Trace reprint authority #290. Do not create shadow truth.
- Missing upstream authorities must be reported precisely and fail closed; where Central-side binding or orchestration is missing, implement it here.
- Final software recertification is bound to production-certified Core SHA `5800f4b84ae72e7fef06d57c11fc22b3117f3c52` and protected Production Migration Release #245 run `36636198402`.
- Core `release_order_to_dispatched_v1` is canonical on that certified pin. Disposable/shadow substitutes are forbidden and `POINT100_ALLOW_DISPOSABLE_BOOTSTRAP` must remain `false` for final recertification.
- Trace #37 and merged Trace #38 software authority are consumed on the production pin; scanner/printer/TV/physical handover remains `physical_uat_only` and is not claimed by Point100 software tests.
- Test whole journeys, not isolated programme points. Batch defects and repairs inside this tranche.
- Maintain role/tenant isolation, idempotency, audit lineage, AAL2/maker-checker where required, Dispatch least privilege, independent Security Gate, and Core migration serialization.
- No physical-device/provider PASS claims. Physical scanner/printer/TV/mobile/gate, WhatsApp provider/media, and payment/bank evidence remain downstream UAT gates.

Minimum executable scenarios:
1. Buyer catalogue → Genie/editable draft → quotation → accept → SO → advance payable.
2. Advance payment/provider event → Finance verification/reconciliation → production release.
3. Inventory reservation/lot allocation → production execution/QC → packing/carton/DPL.
4. Final invoice/balance → Finance Dispatch Clearance → Dispatch → independent Security Gate → Trace handover.
5. Customer dispatch proof → order complete → 10-day complaint window opened.
6. Negative paths: duplicate/replay, wrong tenant/role, insufficient payment, active finance hold, stock shortage, quarantined/expired lot, invalid carton/scan, gate mismatch, provider/webhook replay.

Exit gate: one deterministic automated Point100 software dress rehearsal against canonical production-certified Core source and the current merged application authorities, with explicit provider/physical blockers and no silent skips.

## Final software recertification

```bash
export POINT100_CORE_REPO=/path/to/oasis-supabase-core
export POINT100_CORE_VERIFIED_SHA=5800f4b84ae72e7fef06d57c11fc22b3117f3c52
export POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID=36636198402
export POINT100_PRODUCTION_MIGRATION_RUN_ID=36636198402
export POINT100_DISPATCH_PRODUCTION_VERIFIED=true
export POINT100_ALLOW_LOCAL_RESET=true
export POINT100_ALLOW_DISPOSABLE_BOOTSTRAP=false
bash scripts/point100-certification/recert-after-core-260.sh
```

The runner may instantiate a disposable local database from the exact production-certified Core source for deterministic software testing; it must not create or accept shadow Core authorities. A green Core-bound software rehearsal clears Point100 software; external physical/provider evidence remains separately gated.

Artifacts: `point100-capability-matrix.json`, `point100-dress-rehearsal-ledger.json`, `point100-negative-paths-ledger.json`, `point100-certification-results.json`.
