# MACRO POINT100 INTEGRATION MISSION

This branch is the Leap 11/14 integration tranche for Oasis Baklawa Appverse completion.

Objective: build and continuously repair the executable cross-repository journey from authenticated Buyer catalogue/order intent through governed quotation/SO, payment/finance, production, inventory, packing/DPL, dispatch, independent gate, Trace, customer completion and complaint-window opening.

Rules:
- This is not an audit-only PR. Build the executable integration harness, adapters, fixtures, route bindings and repair code needed on Central to consume canonical authorities.
- Reuse and bind the macro tranches already under construction: Buyer revenue, Core Finance, Core Inventory/Factory, Central CRM, Central Order→Gate, AI Catalogue, and Trace. Do not create shadow truth.
- Missing upstream authorities must be reported precisely and fail closed; where Central-side binding or orchestration is missing, implement it here.
- Test whole journeys, not isolated programme points. Batch defects and repairs inside this tranche.
- Maintain role/tenant isolation, idempotency, audit lineage, AAL2/maker-checker where required, and Core migration serialization.
- No physical-device PASS claims. Physical scanner/printer/TV/mobile/gate evidence remains Leap 13.

Minimum executable scenarios:
1. Buyer catalogue → Genie/editable draft → quotation → accept → SO → advance payable.
2. Advance payment/provider event → Finance verification/reconciliation → production release.
3. Inventory reservation/lot allocation → production execution/QC → packing/carton/DPL.
4. Final invoice/balance → Finance Dispatch Clearance → Dispatch → independent Security Gate → Trace handover.
5. Customer dispatch proof → order complete → 10-day complaint window opened.
6. Negative paths: duplicate/replay, wrong tenant/role, insufficient payment, active finance hold, stock shortage, quarantined/expired lot, invalid carton/scan, gate mismatch, provider/webhook replay.

Exit gate: one deterministic automated synthetic Point100 dress rehearsal runnable against canonical preview/runtime contracts, with explicit upstream-blocker reporting and no silent skips.
