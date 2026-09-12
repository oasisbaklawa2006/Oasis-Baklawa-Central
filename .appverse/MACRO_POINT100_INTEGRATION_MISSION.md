# MACRO POINT100 INTEGRATION MISSION

This branch is the Leap 11/14 integration tranche for Oasis Baklawa Appverse completion.

Objective: build and continuously repair the executable cross-repository journey from authenticated Buyer catalogue/order intent through governed quotation/SO, payment/finance, production, inventory, packing/DPL, dispatch, independent gate, Trace, customer completion and complaint-window opening.

Rules:
- This is not an audit-only PR. Build the executable integration harness, adapters, fixtures, route bindings and repair code needed on Central to consume canonical authorities.
- Reuse and bind canonical macro tranches: Buyer revenue, Core Finance, Core Inventory/Factory, Central CRM, Central Order→Gate, Management #558, AI Catalogue, merged Trace #37, Core Dispatch Finalization #260, and production-certified Core Trace reprint authority #290. Do not create shadow truth.
- Missing upstream authorities must be reported precisely and fail closed; where Central-side binding or orchestration is missing, implement it here.
- Final software recertification is bound to production-certified Core SHA `7b2a09d4a70ee9632c264b552c3265f2495ce48a` and protected Production Migration Release #182 run `34661721779`.
- Core `release_order_to_dispatched_v1` is canonical on that certified pin. Disposable/shadow substitutes are forbidden and `POINT100_ALLOW_DISPOSABLE_BOOTSTRAP` must remain `false` for final recertification.
- Trace #37 remains the merged Trace main authority, but Trace #38 is the active Point95/99 recovery lane. Final Point100 certification must remain fail-closed until #38 consumes Core #290, clears review/certification and merges. Scanner/printer/TV/physical handover remains `physical_uat_only` and is not claimed by Point100 software tests.
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
export POINT100_CORE_VERIFIED_SHA=7b2a09d4a70ee9632c264b552c3265f2495ce48a
export POINT100_RECERT_AFTER_CORE_MIGRATION_RUN_ID=34661721779
export POINT100_PRODUCTION_MIGRATION_RUN_ID=34661721779
export POINT100_DISPATCH_PRODUCTION_VERIFIED=true
export POINT100_ALLOW_LOCAL_RESET=true
export POINT100_ALLOW_DISPOSABLE_BOOTSTRAP=false
bash scripts/point100-certification/recert-after-core-260.sh
```

The runner may instantiate a disposable local database from the exact production-certified Core source for deterministic software testing; it must not create or accept shadow Core authorities. A green Core-bound rehearsal is necessary but not sufficient while Trace #38 remains open.

Artifacts: `point100-capability-matrix.json`, `point100-dress-rehearsal-ledger.json`, `point100-negative-paths-ledger.json`, `point100-certification-results.json`.
