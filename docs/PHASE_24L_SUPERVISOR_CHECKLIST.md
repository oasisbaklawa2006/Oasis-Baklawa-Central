# Phase 24L — Supervisor Daily Checklist (Golden Chain Pilot)

**Audience:** Operations manager, admin, dispatch head, inventory lead  
**Pilot path:** `/admin/golden-chain-operator`  
**Cadence:** Start of shift, mid-shift, end of shift (minimum once per day per site)

---

## 1. Daily order count

| Check | How | Pass criteria |
|-------|-----|---------------|
| Orders touched today | War Room or operational search + wizard search logs | Count matches dispatch sheet / handover |
| New clears for dispatch | Orders in `cleared_for_dispatch` (or equivalent) entering wizard | Each has an owner (dispatch / finance / store) |
| Completions | Orders reaching **Done** in wizard | Count reconciled to outbound manifest |

Record: date, site, orders started, orders completed, supervisor initials.

---

## 2. Stuck orders

| Check | How | Pass criteria |
|-------|-----|---------------|
| Same stage > 4 hours | Search SO in wizard; note stage strip position | Zero unexplained stalls; or ticket opened |
| Inconsistent state | Wizard shows supervisor review / warnings | Escalated to eng if > 1 per day |
| Reload drift | Operator reports button stuck after success | Resolved with refresh or documented bug |

Action: assign named owner (dispatch / finance / inventory) per stuck SO.

---

## 3. Finance blockers

| Check | How | Pass criteria |
|-------|-----|---------------|
| Finance stage backlog | List orders on **Finance** step | Finance lead acknowledges each SO |
| Payment not cleared | `payment_status` / advance vs required | No dispatch finalize while finance blockers active |
| Finance using wizard | Spot-check finance users on audit board | Finance on wizard only during pilot |

Escalate to finance head if advance rules block more than 2 orders.

---

## 4. Stock blockers

| Check | How | Pass criteria |
|-------|-----|---------------|
| Reserve failures | Orders on **Reserve** with active blockers | SKU balance or alternate SKU plan documented |
| Finalize stock failures | Orders on **Stock** after dispatch finalized | Override reason present if policy requires |
| Short balance | Inventory command center vs order lines | No silent override without reason |

---

## 5. Duplicate finalize check

| Check | How | Pass criteria |
|-------|-----|---------------|
| Double finalize attempts | Wizard guard messages / audit | No duplicate `dispatch_release_lineage` finalize rows from operators |
| Already finalized UI | Order shows **Reserve stock** not **Finalize dispatch** | Matches DB `dispatched` (or in-transit) status |
| Operator habit | Interviews / screen share | No use of dispatch-finalization audit board for routine work |

SQL spot (read-only): one governed finalize lineage row per order in pilot lane.

---

## 6. Stock balance check

| Check | How | Pass criteria |
|-------|-----|---------------|
| SKU available before reserve | `inventory_stock_balances` vs order qty | Reserve only when balance supports policy |
| Post-finalize deduction | Consumption lineage exists after stock step | Balances moved consistent with qty |
| Negative / zero surprise | Risk board or inventory command center | Investigate same day |

---

## 7. Reservation fulfilment check

| Check | How | Pass criteria |
|-------|-----|---------------|
| Row status after stock | `inventory_reservations` for SO | `fulfilled_qty` aligned with consumption; status `fulfilled` when complete |
| Partial reserve | Active `reserved` with zero fulfill after stock done | **Fail** — run repair path in wizard (Finalize stock) per Phase 24J |
| Drift pattern | Same SKU repeating on multiple SOs | Pattern noted for eng if > 1 order |

Reference: Phase 24J fixed reservation fulfill drift after stock consumption — verify no regression.

---

## End-of-day sign-off

| Item | Done |
|------|------|
| Daily order count recorded | ☐ |
| All stuck orders have owner | ☐ |
| Finance blockers cleared or escalated | ☐ |
| Stock blockers cleared or escalated | ☐ |
| Duplicate finalize scan clean | ☐ |
| Stock balances spot-checked | ☐ |
| Reservation fulfilment spot-checked | ☐ |
| Operators reminded: wizard only | ☐ |

**Supervisor verdict today:** ☐ Continue pilot ☐ Pause pilot (reason: _____________)

---

## Roles and navigation (supervisor reference)

| Role group | Sees Golden Chain Operator? | Audit six-boards hidden? |
|------------|----------------------------|---------------------------|
| Dispatch manager / incharge / head | Yes (`dispatch`) | Yes (operator policy) |
| Finance head / exec | Yes (`finance`) | Yes |
| Store incharge / ready goods | Yes (`inventory`) | Yes |
| Operations manager / admin | Yes | No (supervisor sees audit) |

---

*Phase 24L — 2026-06-01*
