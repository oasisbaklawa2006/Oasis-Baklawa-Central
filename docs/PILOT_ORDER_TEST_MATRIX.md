# Pilot order test matrix — production (5–10 orders)

Record one row per pilot order **before** starting UI steps. Use production project `tcxvcatsqqertcnycuop` only when authorized.

**Legend:** ☐ not started · 🔄 in progress · ✅ pass · ❌ fail · ⏭ skipped (document reason)

---

## Order roster

| # | SO / label | `order_id` (UUID) | SKU(s) | Location | Operator | Date | Notes |
|---|------------|-------------------|--------|----------|----------|------|-------|
| 1 | | | | WH-MAIN | | | |
| 2 | | | | WH-MAIN | | | |
| 3 | | | | WH-MAIN | | | |
| 4 | | | | WH-MAIN | | | |
| 5 | | | | WH-MAIN | | | |
| 6 | | | | WH-MAIN | | | |
| 7 | | | | WH-MAIN | | | |
| 8 | | | | WH-MAIN | | | |
| 9 | | | | WH-MAIN | | | |
| 10 | | | | WH-MAIN | | | |

**Staging rehearsal reference (do not copy IDs to production):** SO-2026-000002 · `d6c79498-cde9-4394-b4d0-7b56d5371e85` · S12-GOLDEN-001 · validated on staging through 4G.

---

## Step matrix (per order)

| Step | Board | Pass criteria (summary) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|------|-------|---------------------------|---|---|---|---|---|---|---|---|---|---|---|
| **4B** | Dispatch readiness | Gate eligible; evidence rows | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **4C** | Finance governance | Commercial release recorded | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **4D** | Dispatch completion | Completion attested | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **4E** | Dispatch finalization | `orders.status=dispatched`; finalize lineage | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **4F** | Reservation board | Reservation `reserved`; movements ≥2 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| **4G** | Stock finalization | Lineage ≥1; `dispatch_consumption_confirmed`; status still dispatched | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## SQL snapshot columns (fill after 4G)

| # | `lineage_count` | `movement_type` (consumption) | `available_qty` after | `reservation_status` | Anomaly? |
|---|-----------------|------------------------------|------------------------|----------------------|----------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |

---

## Scenario coverage (aim to include variety)

| Scenario | Target orders | Covered by # |
|----------|---------------|--------------|
| Single-SKU, single line | ≥3 | |
| Multi-line order (one SKU finalized per pass if needed) | ≥1 | |
| Order requiring staging scan (`Record verified scan`) | ≥1 | |
| Order requiring initial balance seed | ≥1 | |
| `SUPER_ADMIN` completes 4G with override reason | ≥1 | |
| Non–SUPER_ADMIN role completes 4G (no override field) | ≥1 | |
| Re-open stock board after 4G (expect `already_finalized` blocker) | ≥1 | |

---

## Failure log

| Order # | Step | Error / blocker | Compensated? | Resolution |
|---------|------|-----------------|--------------|------------|
| | | | | |
