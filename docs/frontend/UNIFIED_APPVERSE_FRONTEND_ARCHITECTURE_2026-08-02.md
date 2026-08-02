# Unified App-Verse Frontend Architecture

Date: 2026-08-02
Status: implementation specification
Scope: Oasis Baklawa Central + AI Studio + Trace internal frontend

## 1. Objective

Create one coherent internal operating experience across Central, AI Studio and Trace without moving backend authority between repositories.

The frontend may look unified, but repository and data ownership remain separate:

- Central: CRM, orders, finance, inventory, production/assembly/packing/dispatch command, support, WhatsApp operations.
- AI Studio: product/editorial authority, catalogue content, media readiness, approvals.
- Trace: physical identity, barcode/label, carton, scan, gate and traceability evidence.

The unified shell must reduce navigation complexity, preserve role restrictions, and surface only the actions relevant to the signed-in user.

## 2. Current-state findings

### Central

Central already contains extensive role-aware routing and the broadest internal module inventory. Its present admin navigation exposes too many individual destinations at once, including live screens, previews, audit-only boards and advanced governance utilities. The redesign should not remove capability; it should group it into task-oriented workspaces.

### AI Studio

AI Studio already has a separate role-aware shell with Product, Media, Catalogue, Label, Approval and AI workspaces. It should become the Product & Catalogue workspace inside the unified App-Verse experience while retaining its own deployment and authority.

### Trace

Trace has a compact execution-oriented route set covering production entry, stock units, cartonization, DPL, finance PI, dispatch bundles, shipping labels, gate scans, traceability, printers/templates/reprints and reports. It should become the Physical Execution & Trace workspace.

## 3. Canonical global shell

Desktop structure:

1. Slim global rail, always visible.
2. Workspace navigation panel, collapsible.
3. Context header.
4. Main working canvas.
5. Optional contextual inspector/right drawer.

Mobile/tablet structure:

1. Compact header.
2. Bottom navigation containing the five highest-frequency destinations for that role.
3. More menu for secondary modules.
4. Full-screen task flows for scanning, approvals, picking and confirmations.

TV structure:

1. No interactive sidebar.
2. Full-screen operational board.
3. Large status, target, queue and exception typography.
4. Auto-refresh and high-distance readability.

## 4. Global workspaces

The unified shell exposes no more than seven primary workspaces:

- Home — role-specific command dashboard.
- Customers & Sales — CRM, communication, WhatsApp, support, opportunities, buyer context.
- Orders & Finance — order pipeline, approvals, pricing/terms, payment, release and exceptions.
- Operations — production, assembly, ready goods, packing, inventory and dispatch command.
- Products & Catalogue — AI Studio product authority, media, catalogue, labels and approvals.
- Trace & Dispatch — barcode, cartonization, labels, physical scans, gate and traceability.
- Governance — users, permissions, audit, settings, system configuration and diagnostic tools.

A user sees only workspaces allowed by canonical role/permission rules.

## 5. Navigation rule

Do not expose every route as a permanent sidebar item.

Each workspace contains:

- Overview
- My Work
- Queues
- Search
- Reports
- Settings, only when authorized

Advanced audit, preview, diagnostics and legacy-compatible routes move under contextual menus or Governance instead of competing with daily operational tasks.

## 6. Role-specific landing model

Every role lands on Home, but Home is composed differently.

### Executive/Admin

- business pulse
- orders at risk
- payment exposure
- production/dispatch bottlenecks
- customer escalations
- approval queue
- system exceptions
- shortcut to cross-app search

### Sales

- customers needing follow-up
- open enquiries/quotes/orders
- WhatsApp conversations requiring action
- overdue commitments
- recommended reorders
- account/payment visibility appropriate to role

### Finance

- proof/payment review queue
- pending releases
- ageing/exposure
- exceptions
- reconciliation actions

### Operations manager

- department queues
- production/assembly/packing/dispatch progress
- shortages
- blocked orders
- target vs actual
- dispatch readiness

### Department/HOD/Operator

- only assigned queue
- current target
- next action
- blocker/escalation
- scan/complete controls

### Product/Catalogue team

- incomplete product drafts
- approvals
- media readiness
- catalogue publication blockers
- label readiness

### Dispatch/Gate/Trace roles

- cartons ready
- labels pending
- dispatch bundles
- gate queue
- failed/duplicate scans
- reprint approvals

### TV roles

- dedicated board only
- no general app navigation

## 7. Task-oriented design rule

The new frontend should optimize for "what do I need to do next?" rather than "which module contains this record?"

Every operational object should expose a primary next action and state indicator.

Examples:

- Order: Review → Approve → Advance → Produce → QC/Invoice → Balance → Dispatch → Complete.
- Product: Draft → Complete required fields → Media ready → Review → Approve → Publish.
- WhatsApp case: New → Grouped → Identified → Classified → Clarification if needed → Draft → Review → Actioned/Closed.
- Carton: Open → Build → Verify → Label → Ready → Dispatch → Gate release.

## 8. Shared visual system

Adopt one internal visual system across the three apps.

Base surfaces:

- Primary background: #EFEFE9
- Warm card surface: #F1ECDC
- Neutral card/sheet: #F8F8F8
- Dark text: near-black/espresso
- Metallic gold: reserved for active state, premium emphasis and key progress only
- Sage/olive: success/ready states where appropriate
- Terracotta/red: warning/error, not decorative fill

Typography:

- Utility/UI body: Hanken Grotesk or equivalent highly legible grotesk.
- Editorial/premium headings only where useful: Libre Caslon Text.
- Internal operational screens should prioritize readability over decorative typography.

Icons:

- Use one Lucide-based icon family.
- Icons support labels; they do not replace labels for unfamiliar operational actions.
- Maintain consistent 16/18/20/24 px icon tiers.

## 9. Shared component system

Build reusable primitives before redesigning individual pages:

- AppVerseShell
- GlobalWorkspaceRail
- WorkspaceSidebar
- ContextHeader
- RoleHome
- CommandMetricCard
- StatusChip
- NextActionCard
- WorkQueueTable
- EntitySummaryHeader
- Timeline/GoldenPipeline
- AlertBanner
- ApprovalCard
- SearchCommand
- FilterBar
- EmptyState
- Error/OfflineState
- MobileBottomNav
- ScanActionSheet
- TVMetricTile

These components should use CSS/design tokens so visual changes propagate globally instead of being repeated screen by screen.

## 10. CSS/token strategy

Yes: CSS/design tokens should handle most of the theme migration in one sweep.

Centralize:

- colors
- typography
- spacing
- radius
- shadows
- borders
- table density
- control heights
- responsive breakpoints
- navigation dimensions

Do not attempt to solve structural UX changes with CSS alone. Navigation consolidation, role dashboards, task sequences, page hierarchy and modal/detail behavior require component/routing changes.

## 11. Product/detail interaction standard

For catalogue/product browsing, use the approved no-scroll-heavy detail pattern:

- product card remains compact in grid/list
- clicking opens a large detail sheet/modal on desktop/tablet
- product remains visually present on the left/top
- commercial/product details appear beside it
- quantity/MOQ/cart controls remain visible
- secondary technical information uses tabs/accordions inside the sheet
- mobile uses a full-screen detail sheet

This pattern should also influence internal entity previews: open customer/order/product/carton context without forcing users to lose their queue position.

## 12. Cross-app transition rule

The shell may deep-link between repositories, but must preserve authority boundaries.

Examples:

- Central product record → "Open in Product Authority" deep-links to AI Studio.
- Central carton/order → "Open physical trace" deep-links to Trace.
- Trace exception → "Open operational order" deep-links to Central.

No frontend shortcut may create a second write authority.

## 13. Implementation sequence

### Phase F1 — Foundation

1. Freeze unified design tokens.
2. Build AppVerse shell primitives.
3. Build role/workspace registry.
4. Build role-specific Home framework.
5. Implement global search/command entry shell.

### Phase F2 — Central simplification

6. Replace oversized admin route list with seven primary workspaces.
7. Move previews/audit/diagnostic routes out of primary navigation.
8. Implement role Home dashboards.
9. Standardize list/detail/queue patterns.
10. Standardize order pipeline and exception presentation.

### Phase F3 — AI Studio alignment

11. Apply shared shell tokens/components.
12. Keep Fast Create as primary creation path.
13. Consolidate product/catalogue/media/approval navigation.
14. Standardize Product Detail/editor header and readiness states.

### Phase F4 — Trace alignment

15. Apply shared shell and task density.
16. Optimize scan/carton/label flows for tablet/handheld.
17. Separate operator actions from admin/reporting tools.
18. Standardize TV board framework.

### Phase F5 — Cross-app integration

19. Add safe deep links between authority owners.
20. Add shared visual identity for cross-app transitions.
21. Validate role routing and unauthorized-route handling.
22. Validate mobile/tablet/desktop/TV responsive states.
23. Cross-app UAT and accessibility pass.

## 14. Non-negotiable constraints

- No backend authority migration as part of frontend redesign.
- No service-role material in browser/mobile clients.
- No direct customer app writes to operational tables.
- No removal of audit/diagnostic capability until parity and dependency proof exists.
- No production deployment merely to preview the redesign.
- Existing verified business logic and backend contracts are preserved.

## 15. Immediate implementation target

The first coded frontend tranche should be shell-only and low risk:

1. shared design tokens
2. new workspace registry
3. new desktop shell
4. new mobile shell
5. role Home scaffold
6. compatibility mapping from existing Central routes into the seven workspace groups

Existing route components remain untouched behind the new shell during this tranche. This lets the visual/navigation architecture be validated before page-by-page redesign begins.
