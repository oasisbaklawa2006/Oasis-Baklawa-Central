# Unified App-Verse Route Grouping

Date: 2026-08-02
Purpose: compatibility map for the first frontend shell tranche.

This map changes navigation hierarchy only. It does not change route ownership or backend authority.

## Home

Primary landing:
- `/admin`
- `/admin/execution-command-center`

Home should become role-specific. Existing command-center content may be reused as data panels rather than forcing every role into the same dashboard.

## Customers & Sales

Current destinations to group here:
- `/admin/clients`
- `/sales/dashboard`
- `/admin/operator-inbox`
- `/admin/support`
- `/admin/exceptions`
- `/admin/customer-timeline-preview`
- `/admin/operational-search`

Secondary tools should not all appear as permanent sidebar items. Customer Timeline and Operational Search belong inside customer context/search actions.

## Orders & Finance

Current destinations to group here:
- `/admin/order-management`
- `/admin/accounts-release`
- `/admin/finance`
- `/admin/finance-governance`
- pricing/MOQ/currency management routes when commercial terms are being managed

Order pipeline should be the primary entry. Finance, release and exception panels should open in the order/customer context where possible.

## Operations

Current destinations to group here:
- `/admin/execution/production`
- `/admin/execution/assembly`
- `/admin/execution/ready-goods`
- `/admin/execution/dispatch`
- `/admin/execution/retail`
- `/admin/execution/third-party`
- `/admin/execution/complaints`
- `/admin/live-work-queues`
- `/admin/inventory-command-center`
- `/admin/reservation-board`
- `/admin/stock-finalization`
- `/admin/inventory-risk-board`
- `/admin/assembly-tasks`
- `/admin/ready-goods`
- `/admin/store-coordination`
- `/admin/dispatch-readiness`
- `/admin/dispatch-completion`
- `/admin/dispatch-finalization`
- `/admin/dispatch-mgmt`

Primary navigation inside Operations should be Overview, My Work, Production, Assembly, Ready Goods, Packing/Dispatch, Inventory, Exceptions.

Audit and preview boards remain accessible, but are moved under contextual tabs or Governance.

## Products & Catalogue

Central compatibility routes:
- `/admin/products`
- `/admin/merchandising`
- `/admin/catalogue-sync`
- `/admin/catalogue-approvals`

Canonical editorial/product-authority actions should deep-link to AI Studio rather than creating parallel editing authority in Central.

AI Studio primary destinations:
- `/products`
- `/products/new/fast`
- `/media`
- `/catalogues`
- `/admin/catalogue-builder`
- `/admin/catalogue-product-studio`
- `/labels`
- `/label-queue`
- `/approvals`
- `/ingredients`
- `/hampers`

Lower-frequency AI Studio admin/diagnostic destinations move under Governance/Tools.

## Trace & Dispatch

Trace primary destinations:
- `/production`
- `/stock`
- `/cartons`
- `/dpl`
- `/finance`
- `/dispatch`
- `/shipping`
- `/gate`
- `/trace`

Trace secondary/governance destinations:
- `/printers`
- `/templates`
- `/print-logs`
- `/reprints`
- `/reports`
- `/settings`

Central trace-adjacent routes:
- `/admin/scan-timeline`
- `/admin/carton-explorer`
- `/admin/label-command-center`
- `/security-gate`

These should deep-link to the canonical Trace surface when physical evidence/action belongs there.

## Governance

Current Central destinations:
- `/admin/users`
- `/admin/settings`
- `/admin/audit`
- `/admin/notifications`
- `/admin/announcements`
- `/admin/display-management`
- `/admin/logistics`
- `/admin/moq`
- `/admin/currency`
- entity graph/verification/advanced audit utilities

Current AI Studio destinations:
- `/settings`
- `/audit-log`
- `/testing`
- `/data-correction`
- import/resolver review tools

Current Trace destinations:
- `/printers`
- `/templates`
- `/print-logs`
- `/reprints`
- `/reports`
- `/settings`

Governance is role-gated and should not be visible to daily operators unless a specific permission requires it.

## Primary-nav limit

The permanent desktop global rail must not exceed seven workspace entries:

1. Home
2. Customers & Sales
3. Orders & Finance
4. Operations
5. Products & Catalogue
6. Trace & Dispatch
7. Governance

The permanent mobile bottom navigation must not exceed five entries. The exact five are selected by role. All other destinations remain available through More, contextual actions, search or deep links.

## Compatibility rule

During the first shell tranche, all current URLs remain valid. The new navigation is a compatibility layer over the existing route tree. Route retirement happens only after the relevant workspace redesign has parity, role validation and UAT evidence.
