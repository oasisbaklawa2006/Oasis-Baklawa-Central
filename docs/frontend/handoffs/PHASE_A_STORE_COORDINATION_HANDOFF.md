# Phase A Handoff: Store Coordination

Status: **DRAFT — pending backend sign-off**

Route: `/admin/store-coordination`  
Disposition: SIMPLIFY (`APPVERSE_ROUTE_DISPOSITION_MATRIX.md`)  
Module key: `orders` (`AdminLayout.tsx`, `routeAccess.ts`)

---

## Module identity

| Field | Value |
|---|---|
| Module/domain | Store coordination |
| Owning backend domain | Stores / Retail coordination |
| Owning application | Oasis-Baklawa-Central |
| Primary personas | STORE_INCHARGE, STORE_READY_GOODS, STORE_3RD_PARTY, OPERATIONS_MANAGER |
| Secondary personas | SUPER_ADMIN, ADMIN |
| Read-only personas | Roles with order-pipeline read access |

## Business outcome

Coordinate retail outlet visibility, reservation intent, factory follow-up, and pickup readiness in one mobile-first surface — with explicit labeling when data is factory snapshot vs shelf truth.

## Current implementation (AS-IS on `main`)

| Aspect | State |
|---|---|
| UI entry | `src/pages/admin/StoreCoordination.tsx` |
| Read path | `factory_inventory` + `products` join via Supabase client |
| Writes | **None** — reservation and factory follow-up are **local browser drafts only** |
| Visibility | `readyGoodsVisibility.ts` — confidence: `unknown`, `partial`, `verified_numeric`, `manual_verification_required` |
| Event feeds | `buildStoreCoordinationOperationalFeed`, `buildInventoryOperationalFeed`, `buildRetailLaunchOperationalFeed` |
| Outlets | `DEFAULT_RETAIL_OUTLETS` — static config, not DB-backed |
| Status doc | `docs/RETAIL_STORE_COORDINATION_MODULE_STATUS.md` |

## Canonical entities (to confirm)

| Entity | Identifier | Source (current/proposed) | Status |
|---|---|---|---|
| Product | `product_id`, `sku`, `default_store` | `products` | ✅ Read today |
| Factory inventory row | `product_id`, `quantity`, `last_updated` | `factory_inventory` | ✅ Read today — **not shelf stock** |
| Retail outlet | `outletId`, `outletName` | `DEFAULT_RETAIL_OUTLETS` (static) | ⬜ Needs DB/registry authority |
| Reservation | `id`, customer, store, product, status | Local draft only | ⬜ **No persistence** |
| Factory follow-up | `id`, store, product, urgency | Local draft only | ⬜ **No persistence** |
| Label preview | `labelKind`, JSON payload | Local preview log | ⬜ No print/backend submit |

## Source-of-truth tables/views/RPCs (to confirm)

| Need | Current | Target | Status |
|---|---|---|---|
| Factory snapshot qty | `factory_inventory` SELECT | Confirm scope + freshness SLA | ⬜ |
| Per-outlet shelf qty | Not implemented | POS / receiving loop TBD | ⬜ **Open** |
| Outlet registry | Static `DEFAULT_RETAIL_OUTLETS` | DB-backed outlets collection | ⬜ **Open** |
| Reservation persistence | None | TBD table/RPC + approval graph | ⬜ **Open** |
| Factory follow-up persistence | None | TBD workflow RPC | ⬜ **Open** |
| Store transfer | Not in this module | TBD — may overlap store coordination | ⬜ **Open** |

## State machine (to define)

### Reservation (local draft statuses today)

| Status | Meaning (current UI) | Backend target |
|---|---|---|
| `draft_only` | Browser-only, no submit | ⬜ Define persisted equivalent |
| `pending_backend` | Awaiting backend integration | ⬜ Define RPC + terminal states |
| `manual_verification_required` | Human verify before action | ⬜ Define authority + audit |

### Factory follow-up (local draft)

| Status | Meaning (current UI) | Backend target |
|---|---|---|
| `pending_backend` | Local only | ⬜ Define workflow states |

Backend must supply full state machines with frontend projections before Wave 2 write UI.

## Authority matrix (to define)

| Action | Current | Backend command | Status |
|---|---|---|---|
| View store coordination | ✅ Route + `orders` module | read | ✅ |
| Save reservation draft | Local browser only | TBD create RPC | ⬜ **Blocked** |
| Submit reservation | Disabled in UI | TBD | ⬜ **Blocked** |
| Create factory follow-up | Local browser only | TBD | ⬜ **Blocked** |
| Notify production | Disabled | TBD | ⬜ **Blocked** |
| Print/submit label | JSON preview only | TBD | ⬜ **Blocked** |

## Safety invariants (current — must preserve)

- No inventory writes from this module today
- No `functions.invoke`, no new DB writes from current tree
- Null quantities remain **unknown**, never coerced to zero
- Factory snapshot explicitly labeled **not shelf stock**

## Open questions (must resolve before sign-off)

1. What is the terminal state model for **store transfers** and who approves exceptions?
2. Where do outlets become authoritative — static config vs CMS/DB collection?
3. Which reservation fields require governed approval before stock impact?
4. How does store coordination relate to inventory command center — sibling surfaces or parent/child?

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Backend owner | — | — | ⬜ |
| Frontend owner | — | — | ⬜ |

**Sign-off recorded in:** `docs/frontend/APPVERSE_WAVE2_STORES_INVENTORY_CONTRACT_RECONCILIATION.md`
