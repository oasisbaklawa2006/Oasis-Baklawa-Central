# Retail store coordination module — status

Last updated: 2026-05-24 (Phase B kickoff)

## Shipped in tree (B1)

- **Route:** `/admin/store-coordination`
- **Access:** Inherits admin `RoleProtectedRoute` + `ADMIN_STAFF_ROLES`; sidebar uses `moduleKey: "orders"` so roles with order-pipeline access see **Store coordination**.
- **UI:** Mobile-first shell, six read-only section placeholders, CMD-safe spacing, sticky action bar (refresh + neutral dispatch badge), status chips (visibility / operator / no automation / no writes).
- **Data:** No Supabase reads yet — sections show **“Retail integration pending”** until projections are wired.

## Not started (this document tracks intent)

- B2–B8: visibility cards, reservation shell, factory queue, operational event projections, timeline filters, CMD pulse, full Metro polish pass.
- Phases C–I: cross-module timeline expansion, WhatsApp correlation hints, media strip, execution safety highlights, customer tracking shell, AI draft mode, notification design-only.

## Safety invariants

- No inventory writes, no auto-reallocation, no automation from this module unless explicitly approved later.
- No Edge / migration requirements for B1.

## Verification

- `npm run typecheck`
- `npm run build`
