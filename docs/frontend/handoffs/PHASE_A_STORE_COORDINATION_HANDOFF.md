# Phase A Handoff: Store Coordination

Status: **DRAFT — pending backend sign-off** (not eligible for sign-off; see §Unresolved gaps)

Route: `/admin/store-coordination`  
Disposition: SIMPLIFY (`docs/frontend/APPVERSE_ROUTE_DISPOSITION_MATRIX.md`)  
Module key: `orders` (`src/components/AdminLayout.tsx` L78, `src/lib/appverse/routeAccess.ts` L41)

Evidence reviewed on `main` at `144e9d8d` (2026-08-03). Repository sources only — no invented RPCs or capabilities.

---

## 1. Module identity

| Field | Value |
|---|---|
| Module/domain | Store coordination |
| Owning backend domain | Stores / Retail coordination |
| Owning application | Oasis-Baklawa-Central |
| Primary personas | STORE_INCHARGE, STORE_READY_GOODS, STORE_3RD_PARTY, OPERATIONS_MANAGER |
| Secondary personas | SUPER_ADMIN, ADMIN |
| Read-only personas | Roles with `orders` module read (route gate today) |

**REVIEW-BACKEND:** Module key is `orders` but store personas map to `inventory` in `roleAccess.ts`. Confirm intended gate before Wave 2.

## 2. Business outcome

Mobile-first retail coordination: outlet visibility, reservation intent, factory follow-up, pickup readiness — with explicit labeling when data is factory snapshot vs shelf truth.

## 3. Current frontend (AS-IS — do not redesign in Phase A)

| Aspect | Verified state | Source |
|---|---|---|
| UI | `src/pages/admin/StoreCoordination.tsx` | B1 shell + B2 visibility + B5 projections |
| Read path | `factory_inventory` SELECT join `products` | L164–166 |
| Writes | **None** to DB | Local browser drafts only |
| Outlets | `DEFAULT_RETAIL_OUTLETS` static array | `src/lib/operational-events/storeFeed.ts` L7–16 |
| Status doc | `docs/RETAIL_STORE_COORDINATION_MODULE_STATUS.md` | Shipped vs not-real |
| Visibility doc | `docs/INVENTORY_READY_GOODS_VISIBILITY_STATUS.md` | Factory vs shelf truth |

---

## 4. Canonical entities and fields

| Entity | Identifier(s) | Source of truth | Verified | Notes |
|---|---|---|---|---|
| Product | `products.id` → `productId`, `sku`, `default_store` | `products` | ✅ | Join in `StoreCoordination.tsx` L166 |
| Factory snapshot row | `factory_inventory.product_id`, `quantity`, `last_updated` | `factory_inventory` | ✅ | **Not shelf stock** — `INVENTORY_READY_GOODS_VISIBILITY_STATUS.md` L13–14 |
| Retail outlet | `id`, `name` | `DEFAULT_RETAIL_OUTLETS` (static) | ✅ code only | **BLOCKED-BY-BACKEND** — no DB registry |
| Outlet grouping | `products.default_store` matched to outlet name | Best-effort string match | ✅ | `matchOutletDisplayName()` — unmatched → `Factory snapshot · outlet not linked` |
| Store confidence | `unknown`, `partial`, `verified_numeric`, `manual_verification_required` | Derived projection | ✅ | `readyGoodsVisibility.ts` L26–30 — not persisted |
| Reservation (UI draft) | Local `id`, customer, store, product, status | Browser state only | ✅ | **No persistence** |
| Factory follow-up (UI draft) | Local `id`, store, product, urgency | Browser state only | ✅ | **No persistence** |
| Store requisition | `id`, `order_id`, `target_store`, `status`, `fulfilled_at` | `store_requisitions` | ⚠️ REVIEW-BACKEND | types + permissive RLS; **not read by StoreCoordination.tsx** |
| Requisition line | `requisition_id`, `product_id`, `requested_qty`, `fulfilled_qty` | `store_requisition_items` | ⚠️ REVIEW-BACKEND | Not wired to UI |
| Label preview | `labelKind`, JSON payload | Local preview log | ✅ | No print/backend submit |

---

## 5. Authoritative tables, views and RPCs

### Tables used today (read)

| Table | Operation | RLS | Wired to UI |
|---|---|---|---|
| `factory_inventory` | SELECT | `is_internal_staff` + buyer read | ✅ `StoreCoordination.tsx` |
| `products` | SELECT (join) | product policies | ✅ via join |

### Tables exist but not wired to Store Coordination

| Table | Columns (summary) | RLS | Gap |
|---|---|---|---|
| `store_requisitions` | `target_store`, `status`, `is_panic_order`, `fulfilled_at` | Authenticated full access — **no role scoping** | **REVIEW-BACKEND** — `20260328110331_*.sql` |
| `store_requisition_items` | `requested_qty`, `fulfilled_qty` | Same | **REVIEW-BACKEND** |
| `inventory_reservations` | Phase 4A reservation model | `is_internal_staff` | **BLOCKED-BY-BACKEND** — no store-coordination read/write |
| `inventory_stock_balances` | Location-level ATP components | `is_internal_staff` | **BLOCKED-BY-BACKEND** — shelf/location truth |
| `production_rgs_transfers` | RGS transfer records | Migration `20260407161306_*.sql` | **REVIEW-BACKEND** — not wired |

### Views / RPCs

**None verified** for store coordination, per-outlet shelf stock, or reservation persistence. No inventory business RPCs in migrations.

---

## 6. Source of truth per displayed metric

| Metric | Authoritative source today | Verified | Gap |
|---|---|---|---|
| Store-wise stock visibility | `factory_inventory` + `products.default_store` grouping | ✅ read path | **REVIEW-BACKEND** — factory snapshot, not shelf |
| Per-outlet shelf qty | Not implemented | ❌ | **BLOCKED-BY-BACKEND** |
| Outlet registry | `DEFAULT_RETAIL_OUTLETS` static | ✅ code | **BLOCKED-BY-BACKEND** — needs DB/CMS authority |
| Reservation queue | Local browser drafts | ✅ UI only | **BLOCKED-BY-BACKEND** |
| Factory follow-up queue | Local browser drafts | ✅ UI only | **BLOCKED-BY-BACKEND** |
| Inter-store movement | `store_requisitions` (table exists) | ⚠️ not wired | **REVIEW-BACKEND** |
| Pickup / label readiness | Label JSON preview only | ✅ local | **BLOCKED-BY-BACKEND** |
| ATP / shortage | No view; formula in reservation lib only | ❌ | **BLOCKED-BY-BACKEND** |

---

## 7. State machine and frontend projections

### Local reservation draft (UI only — not backend)

| Status | Meaning (current) | Backend target | Classification |
|---|---|---|---|
| `draft_only` | Browser-only | TBD persisted state | **BLOCKED-BY-BACKEND** |
| `pending_backend` | Awaiting integration | TBD | **BLOCKED-BY-BACKEND** |
| `manual_verification_required` | Human verify | TBD + audit | **BLOCKED-BY-BACKEND** |

### Local factory follow-up (UI only)

| Status | Meaning | Backend target |
|---|---|---|
| `pending_backend` | Local only | TBD workflow states — **BLOCKED-BY-BACKEND** |

### Store requisition (DB — not wired to UI)

| Field | Values (from types) | Frontend projection | Status |
|---|---|---|---|
| `status` | string (types) | Unknown until backend defines enum | **REVIEW-BACKEND** |

### Phase 4A reservation (governed — separate from store-coordination drafts)

If store reservations persist to `inventory_reservations`, use DB states from `reservationLifecycle.ts` — see Inventory Command Center handoff. **Do not conflate** with local draft statuses above.

### Store stock confidence (projection)

| Confidence | Meaning | Frontend label |
|---|---|---|
| `verified_numeric` | Known qty rows present | "Limited numeric" |
| `partial` | Mixed known/unknown | "Partial" |
| `manual_verification_required` | Fetch error or empty | "Manual verify" |
| `unknown` | Default | "Unknown" |

Source: `readyGoodsVisibility.ts` — null qty never coerced to zero.

---

## 8. Authority matrix action identifiers

### Page access (verified)

| Action | Gate | Source |
|---|---|---|
| View store coordination | `orders` module + admin route guard | `AdminLayout.tsx`, `AdminRouteGuard` |

### Mutations (all blocked today)

| Action | Current | Backend command | Status |
|---|---|---|---|
| Save reservation draft | Local browser | TBD `reservation:create` or store-specific RPC | **BLOCKED-BY-BACKEND** |
| Submit reservation | Disabled | TBD | **BLOCKED-BY-BACKEND** |
| Create factory follow-up | Local browser | TBD | **BLOCKED-BY-BACKEND** |
| Notify production | Disabled | TBD | **BLOCKED-BY-BACKEND** |
| Print/submit label | JSON preview | TBD | **BLOCKED-BY-BACKEND** |
| Create store requisition | Not exposed | TBD (table exists) | **REVIEW-BACKEND** |

### Governed reservation actions (if store coord persists to 4A)

See `inventoryAuthorityMatrix.ts` — `reservation:create`, `reservation:reserve`, etc. Finance roles **denied**. SUPER_ADMIN override only for `reservation:override`.

### RLS note — REVIEW-BACKEND

`store_requisitions` policy: any authenticated user — `20260328110331_*.sql` L7–12. Must be tightened before Wave 2 write UI.

---

## 9. Role boundaries and server-side authorization

| Layer | Store coordination today | Gap |
|---|---|---|
| App route guard | `orders` module | **REVIEW-BACKEND** — store personas use `inventory` module elsewhere |
| RLS on `factory_inventory` | `is_internal_staff` + buyer SELECT | ✅ |
| RLS on `store_requisitions` | Blanket authenticated | **REVIEW-BACKEND** — no role scoping |
| Reservation authority matrix | App-layer only | **REVIEW-BACKEND** — must align with RLS before writes |

Primary personas `STORE_READY_GOODS`, `RGS_ADMIN` in handoff but **not** in `is_internal_staff()` — may fail Phase 4A RLS if wired.

---

## 10. Audit evidence (mutations)

| Mutation | Required evidence (when backend defines) | Today |
|---|---|---|
| Reservation create | Actor, correlation_id, requested/proposed qty, reason | **BLOCKED-BY-BACKEND** |
| Factory follow-up | Actor, store, product, urgency, linked order | **BLOCKED-BY-BACKEND** |
| Store requisition | TBD — table exists without audit contract in UI | **REVIEW-BACKEND** |
| Label print/submit | Scan reference, label payload hash | **BLOCKED-BY-BACKEND** |

Append-only ledgers for stock impact: `inventory_movements`, `stock_consumption_lineage` (Phase 4G) — not triggered from store coordination today.

---

## 11. Exception, rejection, shortage, reconciliation paths

| Path | Verified | Store coordination exposure |
|---|---|---|
| Fetch error on `factory_inventory` | ✅ sets `invError` | Shows integration-pending / manual verification |
| Unlinked outlet SKUs | ✅ `unlinkedSkuRowCount` | Explicit label |
| Shortage / ATP | No backend signal | **BLOCKED-BY-BACKEND** |
| Reservation rejection | No persistence | **BLOCKED-BY-BACKEND** |
| Damage / quarantine | `inventory_stock_balances` columns exist | **BLOCKED-BY-BACKEND** — not read |
| Reconciliation | No UI path | **BLOCKED-BY-BACKEND** |

---

## 12. Realtime / event requirements

| Event source | Verified | Notes |
|---|---|---|
| `derived_store_coordination` | ✅ `storeFeed.ts` | Projection only |
| `derived_inventory_visibility` | ✅ `inventoryFeed.ts` | From `factory_inventory` rows |
| `derived_retail_launch` | ✅ `retailLaunchFeed.ts` | Local drafts + label previews |
| Supabase realtime on inventory | Not subscribed | **REVIEW-BACKEND** |
| Freshness SLA | Not defined | **REVIEW-BACKEND** |

---

## 13. UI state semantics (verified today)

| State | Condition | Display |
|---|---|---|
| Loading | `invLoading` | Loading indicator |
| Empty / error | `invError` or zero rows | Integration-pending / manual verification |
| Stale | Not implemented | **REVIEW-BACKEND** — define SLA |
| Local drafts present | `reservationDrafts` / `factoryDrafts` | Timeline suppresses placeholder pending events |
| Backend-unavailable | Query failure | Error message; no synthetic counts |

---

## 14. Relationship to Inventory Command Center

| Aspect | Store coordination | Inventory command center |
|---|---|---|
| Factory snapshot read | ✅ wired | ❌ not wired |
| Governed reservations | Local drafts only | Specialist board + 4A tables |
| ATP / shortage | Not available | Not available |
| Intended relationship | **REVIEW-BACKEND** — sibling surfaces or parent/child? |

---

## 15. Unresolved gaps (sign-off blockers)

| # | Gap | Classification |
|---|---|---|
| G1 | No per-outlet shelf stock source | **BLOCKED-BY-BACKEND** |
| G2 | Outlet registry is static config, not DB authority | **BLOCKED-BY-BACKEND** |
| G3 | Reservation / factory follow-up persistence | **BLOCKED-BY-BACKEND** |
| G4 | `store_requisitions` exists but unwired; RLS unscoped | **REVIEW-BACKEND** |
| G5 | Module key `orders` vs store `inventory` personas | **REVIEW-BACKEND** |
| G6 | `is_internal_staff` vs store persona roles mismatch | **REVIEW-BACKEND** |
| G7 | Inter-store transfer / fulfilment state machine undefined | **BLOCKED-BY-BACKEND** |
| G8 | Approval graph for reservations before stock impact | **BLOCKED-BY-BACKEND** |
| G9 | Realtime / freshness SLA | **REVIEW-BACKEND** |
| G10 | Label print/submit backend contract | **BLOCKED-BY-BACKEND** |

**Sign-off eligibility:** **NOT eligible.** G1–G3 must be closed; G4–G6 require backend reconciliation.

---

## 16. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Backend owner | — | — | ⬜ |
| Frontend owner | — | — | ⬜ |

**Sign-off recorded in:** [`../APPVERSE_WAVE2_STORES_INVENTORY_CONTRACT_RECONCILIATION.md`](../APPVERSE_WAVE2_STORES_INVENTORY_CONTRACT_RECONCILIATION.md)
