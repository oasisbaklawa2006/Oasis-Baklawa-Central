# ASM-BUYER-CARTON-MOQ-01 — Buyer Carton MOQ — Mandatory Full-Carton Checkout Enforcement

**ASM-ID:** `ASM-BUYER-CARTON-MOQ-01`  
**THREAD-ID:** `buyer-carton-moq-20261031`  
**STATUS:** REGISTRATION CANDIDATE — takes effect only when this change is merged by Mission Control. Until then the identifier is proposed, not assigned.  
**CONTROL REPOSITORY:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**IMPLEMENTATION REPOSITORIES:** `oasisbaklawa2006/oasis-supabase-core` (authority: server-side validation, governed master data), `oasisbaklawa2006/oasis-baklawa` (consumer: Buyer UX, flag-gated)  
**LINKED NODES:** `BUYER-APP-RECERT` (Buyer certification), `CORE-CARTON-MOQ` (Core protected release governance for this migration)

## Mission

Every order accepted through the customer checkout consists of complete, compatible shipping cartons, while every SKU keeps following its established primary-container Sales Order rules.

## Owner-confirmed rules (recorded verbatim in intent)

- 888 primary container: 6 kg Sales Order standard; four containers per full shipping carton (888×4).
- 666 primary container: 3 kg Sales Order standard; six containers per full shipping carton (666×6).
- PET tray: 1 kg Sales Order standard; ten trays per full shipping carton (RTC1×10).
- MOQ per SKU: one whole primary container.
- Mixed SKUs are permitted across separate, compatible primary containers within one shipping carton.
- Variants are never mixed inside one primary container.
- Different primary-container families are not combined unless a separately approved configuration expressly permits it.
- Partially filled shipping cartons are prohibited for dispatch.
- Additional shipping-carton types remain configuration-driven (governed `carton_configurations` / `product_packing_profiles`), never hard-coded.
- Existing SKU packing assignments and Sales Order commercial authority (price, GST, credit, MOQ, increment, advance) are reused and not replaced; carton validation is additive to, and never weakens, existing product-level MOQ/increment validation.

## Authority and routing

- Core is the sole authority for validation and governed master data; the Buyer app displays server results and never computes an authoritative carton count.
- Core backend changes are Core-routed (this item) and follow the protected Production Migration Release; no production migration, deployment or activation is authorised by this registration.
- Enforcement activation is a separate, evidence-gated Core action; the Buyer flag stays OFF until Core is published and verified.

## Dependencies

- Core `main` at or after `20708e7b4e6dedf5dcd187f6638909ac51951ea0` (order path: `submit_customer_order_v1`, `submit_customer_order_quoted_v1`, `customer_checkout_quote_v1`, `customer_validate_order_quantity_v1`).
- Operations-approved packing master data (SKU → packing group, container quantity, carton configuration) with evidence; none is invented.
- Core candidate `local/carton-packing-profile-v1` (projection v1 governed tables).
- Buyer candidate lineage `local/carton-core-wiring` (requires its base commit `448bad9`).

## Stop condition

Core and Buyer implementations are exact-head certified within repository authority (clean replay, rollback, real-PostgreSQL pgTAP, Buyer regression/build, authenticated E2E where an authorised environment exists); the master-data readiness report shows no orderable SKU without an approved packing profile; activation is explicitly authorised with evidence. A merged PR alone does not clear this item (`PR MERGED != STAGE CLEARED`).
