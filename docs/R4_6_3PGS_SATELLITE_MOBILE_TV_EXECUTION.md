# R4.6 — 3PGS satellite/mobile/TV execution contract

Controlling issues: #407 and #368.

Depends on merged R4.5 #429 command-centre composition.

## Purpose

Expose read-only, role-filtered 3PGS visibility for satellite audiences and device-specific operator subsets without creating parallel inventory authority or mutation surfaces.

## Canonical inputs to compose

Reuse the same governed read model as R4.5:

- `inventory_stock_balances`
- `b2b_3pgs_pending_demand_priority`
- `b2b_procurement_requirements`
- `b2b_assembly_3pgs_requirements`
- `b2b_inventory_receipts`
- `b2b_inventory_grns`

Shared loader: `src/lib/threePgsSnapshotLoader.ts`.

## Surfaces

| Surface | Route | Audience | Behaviour |
|---|---|---|---|
| Satellite visibility | `/admin/3pgs-visibility` | P&A, outlet, dispatch roles in admin shell | Role-filtered read-only projection; bypasses generic inventory gate |
| Sales satellite visibility | `/sales/3pgs-visibility` | `SALES_EXECUTIVE` | Dedicated non-admin route exposing only the `b2b` projection |
| Mobile urgent subset | `/admin/3pgs-mobile-urgent` | 3PGS operator roles | Touch-friendly urgent queue over governed truth |
| TV wall | `/tv/3pgs` | `STORE_3RD_PARTY`, `TV_3PGS`, `OPERATIONS_MANAGER`, administrators | Chrome-free kiosk route for dedicated TV accounts |
| Admin-path TV duplicate | `/admin/3pgs-tv` | `STORE_3RD_PARTY`, `OPERATIONS_MANAGER`, administrators with inventory module access | In-shell navigation only; excludes kiosk-only `TV_3PGS` |

The canonical operator mutation surface remains `ThreePgsProcurementQueue.tsx` at `/admin/3pgs-procurement-queue`.

## Role boundaries

- Operator roles: `SUPER_ADMIN`, `ADMIN`, `OPERATIONS_MANAGER`, `STORE_3RD_PARTY`
- Satellite roles: `HOD_ASSEMBLY`, `ASSEMBLY_MANAGER`, `PACKING_SUPERVISOR`, `STORE_READY_GOODS`, `STORE_INCHARGE`, `RGS_ADMIN`, `DISPATCH_HEAD`, `DISPATCH_MANAGER`, `DISPATCH_INCHARGE` via `/admin/3pgs-visibility`; `SALES_EXECUTIVE` via `/sales/3pgs-visibility`
- Satellite roles must not inherit the full procurement queue through generic inventory access.

## Non-goals

- no schema/migration;
- no direct stock writes;
- no copied/parallel operator implementation;
- no R4.7 close/audit behaviour;
- no R5 Dispatch behavioural work.

## Exit

R4.6 exits after exact-head CI, security/static/preview gates, and focused tests proving role-scoped read-only composition. Physical UAT #408 remains separate.
