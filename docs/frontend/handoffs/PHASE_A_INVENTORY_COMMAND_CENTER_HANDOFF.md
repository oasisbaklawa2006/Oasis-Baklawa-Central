# Phase A Handoff: Inventory Command Center

Status: **DRAFT — pending backend sign-off**

Route: `/admin/inventory-command-center`  
Disposition: SIMPLIFY (`APPVERSE_ROUTE_DISPOSITION_MATRIX.md`)  
Module key: `inventory` (`roleAccess.ts`, `routeAccess.ts`)

---

## Module identity

| Field | Value |
|---|---|
| Module/domain | Inventory command center |
| Owning backend domain | Stores / Inventory (Inventory OS) |
| Owning application | Oasis-Baklawa-Central |
| Primary personas | STORE_INCHARGE, STORE_READY_GOODS, STORE_3RD_PARTY, RGS_ADMIN, OPERATIONS_MANAGER |
| Secondary personas | SUPER_ADMIN, ADMIN, PRODUCTION_MANAGER |
| Read-only personas | Roles with `inventory` read but no execution authority |

## Business outcome

Provide a single stores/inventory **attention surface** that answers: what needs attention now, what is blocked, and what is the next valid action — without duplicating specialist boards or inventing stock truth.

## Current implementation (AS-IS on `main`)

| Aspect | State |
|---|---|
| UI entry | `src/pages/admin/InventoryCommandCenter.tsx` |
| Data connection | **Not connected** — hardcoded projection inputs; badge: "Internal preview — not connected to live data" |
| Writes | **None** — merged projections only |
| Feed builders | `buildInventoryOsOperationalFeed`, `buildExecutionOperationalFeed`, `buildGovernanceOperationalFeed`, `buildBarcodeOperationalFeed` |
| Display | `OperationalTimeline` — read-only event stream |

## Canonical entities (to confirm)

| Entity | Identifier | Source (proposed) | Status |
|---|---|---|---|
| Product | `product_id`, `sku` | `products` | ⬜ Confirm |
| Factory inventory row | `product_id`, `quantity` | `factory_inventory` | ⬜ Confirm authoritative scope (factory snapshot, not shelf) |
| Inventory movement | movement id | Inventory OS ledger (TBD) | ⬜ Not wired |
| Reservation signal | reservation id | Reservation subsystem (TBD) | ⬜ Not wired |
| Variance / risk escalation | escalation id | `inventoryRiskDerive` inputs (TBD) | ⬜ Not wired |

## Source-of-truth tables/views/RPCs (to confirm)

| Need | Candidate | Status |
|---|---|---|
| Shortage / ATP signal | TBD view or RPC | ⬜ **Open** |
| Open reservations | TBD | ⬜ **Open** |
| Movement timeline | `buildInventoryMovementTimeline` projection inputs | ⬜ **Open** |
| Execution dependency flags | War Room / execution satisfaction RPC | ⬜ **Open** — currently hardcoded `false` |
| Governance escalations | TBD | ⬜ **Open** |

## State machine (to define)

Current UI has no persisted states. Backend must define:

- [ ] Shortage states and transitions
- [ ] Reservation hold states
- [ ] Reconciliation backlog states
- [ ] Frontend projection per state (label, category, actionable-by)
- [ ] Unknown-state fallback

## Authority matrix (to define)

| Action | Backend command | Preconditions | Status |
|---|---|---|---|
| View command center | page read | `inventory` module | ✅ Exists (route guard) |
| Apply reservation hold | TBD | TBD | ⬜ **Blocked** |
| Release / transfer stock | TBD | TBD | ⬜ **Blocked** |
| Acknowledge variance | TBD | TBD | ⬜ **Blocked** |

No write controls may be designed until action identifiers and RPC contracts are frozen.

## Open questions (must resolve before sign-off)

1. Which view/RPC is authoritative for **shortage** vs **reservation** vs **available-to-promise**?
2. Is `factory_inventory` the correct primary feed for the command center, or a derived ATP view?
3. Which execution satisfaction flags from War Room must appear on this surface?
4. How do reservation board and inventory risk board relate — filtered lenses or separate domains?

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Backend owner | — | — | ⬜ |
| Frontend owner | — | — | ⬜ |

**Sign-off recorded in:** `docs/frontend/APPVERSE_WAVE2_STORES_INVENTORY_CONTRACT_RECONCILIATION.md`
