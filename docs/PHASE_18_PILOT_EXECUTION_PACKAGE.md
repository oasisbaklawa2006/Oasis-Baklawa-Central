# PHASE 18 — Pilot execution package (production)

**Production:** `tcxvcatsqqertcnycuop`  
**Prerequisite:** Migration package complete — reprobe G1–G8 PASS, DBA GO for pilot.  
**References:** `PRODUCTION_PILOT_CHECKLIST.md`, `PILOT_ORDER_TEST_MATRIX.md`, `PHASE_18_ROUTE_CONTAINMENT_PLAN.md`

**Rules:** UI writes only through governance boards. **No manual SQL INSERT/UPDATE** on governance tables.

---

## 1. Pilot order selection rules

Select **exactly 5** orders before any UI step. All five must satisfy **every** rule.

| Rule | Requirement |
|------|-------------|
| R1 | Real production order (not test/demo flag if identifiable) |
| R2 | Status **before 4B** must allow readiness work — typically `cleared_for_dispatch`, `packed_ready`, or ops-approved equivalent (not already `dispatched` unless rehearsing post-dispatch chain only) |
| R3 | **Not** currently processed on legacy finance-board for payment release during pilot window |
| R4 | Single primary SKU line preferred (multi-SKU allowed if operator capacity) |
| R5 | Known `product_id` + SKU + location `WH-MAIN` (or documented pilot location) |
| R6 | Customer / company not on “do not experiment” list (ops sign-off) |
| R7 | Order UUID + human SO number recorded in matrix **before** 4B |
| R8 | No concurrent pilot on same order by two operators |
| R9 | Exclude orders with open WhatsApp cancel/dispute automation risk (or add to containment watch list) |
| R10 | Finance head confirms order is appropriate for commercial release test |

**Disqualifiers:** already `dispatched` with consumption lineage (use different order); missing line items; blocked credit hold without finance path.

**Staging reference only (do not copy IDs to production):** SO-2026-000002 / `d6c79498-cde9-4394-b4d0-7b56d5371e85`.

---

## 2. Five-order matrix (fill before execution)

| # | SO / label | `order_id` (UUID) | SKU | Location | Operator | Start (UTC) | 4B | 4C | 4D | 4E | 4F | 4G | Final |
|---|------------|-------------------|-----|----------|----------|-------------|----|----|----|----|----|----|-------|
| 1 | | | | WH-MAIN | | | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | | | | WH-MAIN | | | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | | | | WH-MAIN | | | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | | | | WH-MAIN | | | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | | | | WH-MAIN | | | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

Copy to `PILOT_ORDER_TEST_MATRIX.md` when finalized.

---

## 3. Operator instructions (per order)

### 3.1 Roles

| Step | Primary operator | Minimum role |
|------|------------------|--------------|
| 4B | Dispatch lead | Internal staff; not `SALES_EXECUTIVE` |
| 4C | Finance lead | Finance governance insert role |
| 4D | Dispatch lead | Dispatch completion role |
| 4E | Dispatch lead | Dispatch finalization role |
| 4F | Inventory lead | Internal staff |
| 4G | Inventory lead | Stock authority; SUPER_ADMIN needs override text |

### 3.2 Sequence (do not skip)

1. **4B** — `/admin/dispatch-readiness`  
   - Select order from list.  
   - Add evidence: packing photo, document placeholder, gate scan as required by UI.  
   - **Record readiness review** when gate shows eligible.  
   - **Stop if** gate not eligible — escalate; do not force.

2. **4C** — `/admin/finance-governance`  
   - **Start finance review.**  
   - **Record commercial release** when enabled.  
   - **Stop if** commercial release blocked.

3. **4D** — `/admin/dispatch-completion`  
   - **Review completion** → **Attest completion.**  
   - **Stop if** attestation blocked.

4. **4E** — `/admin/dispatch-finalization`  
   - Enter handoff references (transporter, gate, completion refs per UI).  
   - **Finalize dispatch (governed)** — **only** step that sets `orders.status = dispatched`.  
   - Confirm toast success and board shows finalized.

5. **4F** — `/admin/reservation-board`  
   - Select **same** order and line.  
   - Wait until context indicator matches selection (no stale context).  
   - Use staging seed buttons only if board shows balance/scan blockers (document in matrix notes).  
   - **Create & reserve.**  
   - **Stop if** reserve fails — check compensation cancelled orphan before retry once.

6. **4G** — `/admin/stock-finalization`  
   - Select order + reservation line.  
   - If SUPER_ADMIN: enter **override reason** before finalize.  
   - **Finalize consumption.**  
   - **Stop if** `already_finalized` — do not double-finalize.

### 3.3 Between steps

- Dismiss onboarding overlays.  
- Confirm **live** signals (not preview/demo cards).  
- Do not use Class **A** routes (`PHASE_18_ROUTE_CONTAINMENT_PLAN.md`).

---

## 4. SQL verification per stage (read-only)

Replace `:order_id`, `:sku`, `:location` per matrix row. Run after **each** stage for first order; after full chain for orders 2–5.

### After 4B

```sql
SELECT evidence_type, evidence_status, correlation_id, created_at
FROM dispatch_readiness_evidence
WHERE order_id = :order_id
ORDER BY created_at DESC
LIMIT 10;
-- PASS: >=1 row; gate eligibility reflected in UI
```

### After 4C

```sql
SELECT review_type, review_status, correlation_id, created_at
FROM finance_review_evidence
WHERE order_id = :order_id
ORDER BY created_at DESC
LIMIT 10;
-- PASS: commercial release recorded (review_status per UI)
```

### After 4D

```sql
SELECT evidence_type, completion_status, correlation_id, created_at
FROM dispatch_completion_evidence
WHERE order_id = :order_id
ORDER BY created_at DESC
LIMIT 10;
-- PASS: attestation row present
```

### After 4E

```sql
SELECT id, status FROM orders WHERE id = :order_id;
-- PASS: status = 'dispatched'

SELECT release_type, previous_status, next_status, correlation_id, created_at
FROM dispatch_release_lineage
WHERE order_id = :order_id
ORDER BY created_at DESC
LIMIT 5;
-- PASS: >=1 finalize lineage row; next_status = 'dispatched'
```

### After 4F

```sql
SELECT reservation_number, reservation_status, reserved_qty, fulfilled_qty, correlation_id
FROM inventory_reservations
WHERE order_id = :order_id
ORDER BY created_at DESC;

SELECT movement_type, quantity, correlation_id
FROM inventory_movements
WHERE reservation_id IN (SELECT id FROM inventory_reservations WHERE order_id = :order_id)
ORDER BY created_at DESC;
-- PASS: >=1 reservation; reserved_qty > 0 typical; movement rows include reservation_created / reserve types
```

### After 4G (final)

```sql
SELECT id, status FROM orders WHERE id = :order_id;
-- PASS: still 'dispatched'

SELECT lineage_type, consumed_qty, correlation_id
FROM stock_consumption_lineage
WHERE order_id = :order_id;
-- PASS: >=1 consumption_finalized

SELECT movement_type, quantity
FROM inventory_movements
WHERE correlation_id IN (SELECT correlation_id FROM stock_consumption_lineage WHERE order_id = :order_id);
-- PASS: includes dispatch_consumption_confirmed

SELECT sku, location_code, available_qty, reserved_qty, version
FROM inventory_stock_balances
WHERE sku = :sku AND location_code = :location;
-- PASS: available_qty decreased vs post-4F snapshot; version incremented
```

---

## 5. Pass/fail criteria (per order)

| Criterion | PASS | FAIL |
|-----------|------|------|
| P1 | All six UI steps complete without override of governance | Any step skipped or forced via legacy route |
| P2 | `orders.status = dispatched` only after 4E | Dispatched before 4E or changed after 4G |
| P3 | `dispatch_release_lineage` row exists | Missing lineage |
| P4 | `consumption_finalized` lineage exactly **one** per consumed line | 0 or >1 duplicate |
| P5 | `dispatch_consumption_confirmed` movement exists | Missing movement |
| P6 | No manual SQL writes performed | Any governance table manual DML |
| P7 | Reservation row + movements exist after 4F | Reserve failed without documented compensation |
| P8 | Operator notes anomalies (reservation vs lineage) | Undocumented mismatch |

**Order PASS:** P1–P8 all PASS.  
**Pilot PASS:** 5/5 orders PASS + post-pilot E1–E3 (`PRODUCTION_PILOT_CHECKLIST.md` §E).

---

## 6. Escalation criteria

| Level | Trigger | Action | Contact |
|-------|---------|--------|---------|
| **E1 — Hold order** | Gate not eligible at 4B | Stop chain for that order; pick backup order | Dispatch lead |
| **E2 — Hold order** | Finance commercial release blocked | Finance review; do not use finance-board | Finance head |
| **E3 — Hold pilot** | Persistence / schema error on any board | Stop all pilots | Engineering owner |
| **E4 — Hold pilot** | `orders.status` changed outside 4E | Incident; compare `order_status_history` + lineage | Eng + DBA |
| **E5 — Stop pilot** | Duplicate `consumption_finalized` | **Halt all orders** | Eng + DBA + Pilot coordinator |
| **E6 — Stop pilot** | Unexpected RLS / auth mass failure | Halt; DBA | DBA owner |
| **E7 — Policy** | Operator used Class A route on pilot order | Document; exclude order from PASS | Ops lead |

**War room channel:** (fill in command center doc)

---

## 7. Post-pilot (same day)

| # | Task | Owner |
|---|------|-------|
| 1 | Complete matrix Final column | Pilot coordinator |
| 2 | Post-pilot E1–E5 checklist | Ops |
| 3 | Update `PHASE_15_PRODUCTION_PILOT_REPORT.md` or Phase 18 outcome log | Eng |
| 4 | Route containment review — any A route usage? | Ops lead |

---

*End of pilot execution package.*
