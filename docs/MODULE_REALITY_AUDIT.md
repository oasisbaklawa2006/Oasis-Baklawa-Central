# Oasis Central Module Reality Audit

**Date:** 2026-06-09  
**Method:** Static analysis only (routes, grep, file reads). No runtime tests, no SQL apply, no code changes.

---

## Module inventory

### 1. Customer storefront / catalogue

| # | Field | `/catalogue`, `/quick-order`, `/product/:id`, `/home` |
|---|--------|------------------------------------------------------|
| 1 | Route | `/catalogue`, `/quick-order`, `/product/:id`, `/home` |
| 2 | Screen | `src/pages/Catalogue.tsx`, `QuickOrder.tsx`, `ProductDetail.tsx`, `Index.tsx` |
| 3 | Reads live Supabase | **YES** — via `useProducts` → `products`, `factory_inventory` |
| 4 | Writes live Supabase | **PARTIAL** — cart/checkout writes on other routes; catalogue browse is read-only |
| 5 | Mock/sample/localStorage | **NO** (sessionStorage SWR cache in `useProducts` only) |
| 6 | Buttons functional | **YES** — browse, search, navigate to product/cart |
| 7 | E2E connected | **PARTIAL** — browse → cart → submit works; not wired to WA or governance boards |
| 8 | Tables | `products`, `factory_inventory` |
| 9 | Blocked stitching | Price tier / company context required; no catalogue→WA path |
| 10 | Risk | **LOW** |

| # | Field | `/cart`, `/orders`, `/orders/:id` |
|---|--------|-----------------------------------|
| 1 | Route | `/cart`, `/orders`, `/orders/:id` |
| 2 | Screen | `Cart.tsx`, `Orders.tsx`, `OrderTracking.tsx`; cart logic in `useCart.ts` |
| 3 | Reads | **YES** — `orders`, `order_items`, `delivery_addresses`, `companies`, `moq_rules`, etc. |
| 4 | Writes | **YES** — draft `orders` insert/update, `order_items`, `order_payments`, `support_tickets` |
| 5 | Mock/local | **PARTIAL** — `localStorage` impersonation key `impersonated_client` (sales impersonation) |
| 6 | Functional | **YES** — submit draft order, upload receipts, raise tickets |
| 7 | E2E | **PARTIAL** — customer submit → admin production/dispatch is separate legacy path |
| 8 | Tables/RPC | `orders`, `order_items`, `order_payments`, `delivery_addresses`, RPC `log_cart_failure` |
| 9 | Blocked | Post-submit status driven by admin screens, not governance boards |
| 10 | Risk | **LOW** |

| # | Field | `/track` (public) |
|---|--------|---------------------|
| 1 | Route | `/track?token=` |
| 2 | Screen | `PublicOrderTracking.tsx` |
| 3 | Reads | **YES** — Edge `public-order-tracking` |
| 4 | Writes | **NO** |
| 5 | Mock | **NO** |
| 6 | Functional | **YES** — if valid token |
| 7 | E2E | **PARTIAL** — read-only slice of order lifecycle |
| 8 | Edge | `public-order-tracking` |
| 9 | Blocked | Token must exist on order at creation |
| 10 | Risk | **LOW** |

---

### 2. Admin catalogue / products

| # | Field | `/admin/products`, `/admin/pricing`, `/admin/merchandising`, `/admin/catalogue-sync`, `/admin/catalogue-approvals` |
|---|--------|----------------------------------------------------------------------------------------------------------------------|
| 1 | Routes | As above |
| 2 | Screens | `AdminProducts.tsx`, `AdminPricing.tsx`, `AdminMerchandising.tsx`, `AdminCatalogueSyncStatus.tsx`, `ApprovalInbox.tsx` |
| 3 | Reads | **YES** |
| 4 | Writes | **YES** — products, variants, BOM, tags, pricing slabs; catalogue connector + approval service |
| 5 | Mock | **NO** |
| 6 | Functional | **YES** |
| 7 | E2E | **PARTIAL** — catalogue changes flow to customer `useProducts`; no auto WA product resolution sync verified in UI |
| 8 | Tables/Edge | `products`, `product_variants`, `product_bom`, `product_tags`, `product_tag_mapping`; Edge `generate-product-attributes` |
| 9 | Blocked | Connector intake vs live storefront cache invalidation |
| 10 | Risk | **LOW** |

---

### 3. WhatsApp inbox / order draft

| # | Field | `/admin/operator-inbox`, `/admin/whatsapp` |
|---|--------|---------------------------------------------|
| 1 | Route | `/admin/operator-inbox`, `/admin/whatsapp` |
| 2 | Screen | `OperatorInbox.tsx` → `WhatsAppInbox.tsx` + `OperatorInboxSalesOrderDraftSection.tsx` |
| 3 | Reads | **YES** — `whatsapp_message_packets`, realtime channel; draft tables via repository |
| 4 | Writes | **PARTIAL** — Edge `whatsapp-operator-reply`, `whatsapp-classify-intent`, `whatsapp-route-packet`; draft RPCs write **staging only** |
| 5 | Mock/local | **YES** — `operatorInboxDraftOrderLocalState.ts` (localStorage approve/reject); local AI preview panels; UI prefs in localStorage |
| 6 | Functional | **PARTIAL** — inbox load/reply/classify/route invoke edges; persisted draft workflow works; **does not create live orders** |
| 7 | E2E | **NO** — `APPROVED_FOR_SO` stops at `sales_order_drafts` (migration comment: explicitly no live orders) |
| 8 | Tables/RPC/Edge | `whatsapp_message_packets`; `sales_order_drafts`, `sales_order_draft_lines`, `sales_order_draft_audit_log`; RPCs `create_sales_order_draft_atomic`, `submit_sales_order_draft_for_review_atomic`, `approve_sales_order_draft_for_so_atomic`, `reject_sales_order_draft_atomic`, `update_sales_order_draft_operator_final`; Edges above |
| 9 | Blocked | **Draft approval → `orders` insert**; local draft UI can mislead operators |
| 10 | Risk | **HIGH** |

Note: `C2C_EXECUTION_FLAGS` in `src/config/c2cExecutionFlags.ts` are all `false` but **not referenced** by inbox runtime — flags are inert scaffold.

---

### 4. Sales order flow (admin + sales)

| # | Field | `/admin/orders`, `/admin/order-management`, `/admin/central-pool`, `/sales/dashboard`, `/admin/sales-hub` |
|---|--------|--------------------------------------------------------------------------------------------------------|
| 1 | Routes | As above |
| 2 | Screens | `AdminOrders.tsx`, `OrderManagement.tsx`, `CentralOrderPool.tsx`, `SalesDashboard.tsx`, `SalesPerformanceHub.tsx` |
| 3 | Reads | **YES** |
| 4 | Writes | **YES** — status transitions, manual order create, returns, interactions |
| 5 | Mock | **PARTIAL** — sales impersonation `localStorage`; AdminClients invite toast says "(demo)" |
| 6 | Functional | **YES** — legacy order ops |
| 7 | E2E | **PARTIAL** — parallel to governance/golden-chain path; WA drafts not merged |
| 8 | Tables/Edge | `orders`, `order_items`, `order_status_history`, `client_interactions`, `crm_tasks`; Edge `send-whatsapp` on status change |
| 9 | Blocked | Single canonical order intake (portal vs WA vs central pool) |
| 10 | Risk | **MEDIUM** |

---

### 5. Finance flow

| # | Field | `/admin/finance`, `/admin/finance-board`, `/admin/finance-governance`, `/admin/accounts-release` |
|---|--------|-----------------------------------------------------------------------------------------------------|
| 1 | Routes | As above |
| 2 | Screens | `AdminFinance.tsx`, `FinanceReleaseBoard.tsx`, `FinanceGovernanceBoard.tsx`, `AdminAccountsRelease.tsx` |
| 3 | Reads | **YES** |
| 4 | Writes | **PARTIAL** — **AdminFinance** + **FinanceReleaseBoard** + **AdminAccountsRelease** write `orders`, payments, credit, dispatch prep; **FinanceGovernanceBoard** writes only via governed bundle when `persistenceMode === "supabase"` |
| 5 | Mock | **PARTIAL** — governance preview cards when `VITE_EXECUTION_PREVIEW_FALLBACK=true` |
| 6 | Functional | **PARTIAL** — two parallel finance UIs (legacy vs governance) |
| 7 | E2E | **PARTIAL** — legacy path can advance orders; governance board may be unavailable/demo |
| 8 | Tables/RPC | `orders`, `order_payments`, `credit_requests`, `inward_material_advice`, `commission_payouts`, `dispatches`; RPC `restore_order_financials`; governed `finance_review_evidence` (when migrated) |
| 9 | Blocked | Consolidate finance release signal → dispatch readiness |
| 10 | Risk | **HIGH** |

---

### 6. Dispatch flow

| # | Field | `/admin/packing-dispatch`, `/admin/dispatch-mgmt`, `/admin/dispatch-readiness`, `/admin/dispatch-completion`, `/admin/dispatch-finalization`, `/admin/execution/dispatch` |
|---|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Routes | As above |
| 2 | Screens | `AdminPackingDispatch.tsx`, `DispatchManagement.tsx`, `DispatchReadinessBoard.tsx`, `DispatchCompletionBoard.tsx`, `DispatchFinalizationBoard.tsx`, `DispatchExecutionBoard.tsx` |
| 3 | Reads | **YES** — legacy reads `orders`; governance boards use read models + bundle probe |
| 4 | Writes | **PARTIAL** — legacy **YES** (`dispatches`, `dispatch_cartons`, `orders` status); governance boards write evidence only if Supabase tables exist (`probeDispatchEvidenceTable`) |
| 5 | Mock | **PARTIAL** — in-memory/demo persistence when tables missing; preview inputs in `governanceBoardSamples` |
| 6 | Functional | **PARTIAL** — legacy dispatch works; governance boards may show preview/empty |
| 7 | E2E | **NO** — three dispatch paradigms (legacy, governance boards, execution board) not unified |
| 8 | Tables | `orders`, `dispatches`, `dispatch_cartons`, `packing_lists`; governed evidence tables via bundles |
| 9 | Blocked | Single dispatch completion authority; scan/barcode feed |
| 10 | Risk | **HIGH** |

| # | Field | `/admin/dispatch-tv`, `/admin/assembly-tv` |
|---|--------|-------------------------------------------|
| 1 | Routes | `/admin/dispatch-tv`, `/admin/assembly-tv` |
| 2 | Screens | `DispatchTV.tsx`, `AssemblyTV.tsx` → `ComingSoonOverlay` |
| 3–4 | Read/Write | **NO** |
| 5 | Mock | **YES** — placeholder overlay |
| 6 | Functional | **NO** |
| 7 | E2E | **NO** |
| 8 | — | — |
| 9 | Blocked | Not built |
| 10 | Risk | **LOW** (labeled coming soon) |

---

### 7. Production / factory flow

| # | Field | `/admin/production`, `/admin/assembly-tasks`, `/admin/ready-goods`, `/tv/*`, `/admin/rgs-tv` |
|---|--------|-----------------------------------------------------------------------------------------------|
| 1 | Routes | As above |
| 2 | Screens | `AdminProduction.tsx` (tabs → OrderManagement, AssemblyManagement, ReadyGoodsStore, AdminInventory, DispatchManagement); `AssemblyManagement.tsx`, `ReadyGoodsStore.tsx`, `FactoryTVModule.tsx`, `ReadyGoodsTV.tsx` |
| 3 | Reads | **YES** |
| 4 | Writes | **YES** — `order_items` production status, `daily_production_logs`, `orders` → `packed_ready` |
| 5 | Mock | **NO** on operational tabs; TV lines read live |
| 6 | Functional | **YES** on queue/assembly/ready-goods |
| 7 | E2E | **PARTIAL** — connects to legacy order status; not to stock finalization/reservation boards |
| 8 | Tables | `orders`, `order_items`, `production_jobs`, `daily_production_logs`, `store_requisitions` |
| 9 | Blocked | Production execution board vs legacy tabs duplication |
| 10 | Risk | **MEDIUM** |

| # | Field | `/admin/execution/production`, `/admin/execution/assembly` |
|---|--------|-----------------------------------------------------------|
| 1 | Routes | As above |
| 2 | Screens | `ProductionExecutionBoard.tsx`, `AssemblyExecutionBoard.tsx` → `DepartmentExecutionBoard.tsx` |
| 3 | Reads | **YES** — `useDepartmentExecutionBoard` → operational queues, scans, events |
| 4 | Writes | **PARTIAL** — role-gated queue/scan writes via `createSupabaseOperationalExecutionBundle` |
| 5 | Mock | **NO** |
| 6 | Functional | **PARTIAL** — depends on queue population |
| 7 | E2E | **PARTIAL** — parallel to legacy production tabs |
| 8 | Tables | `operational_queue_items`, `operational_events`, `operational_scans` (cast client) |
| 9 | Blocked | Queue seeding from real order state |
| 10 | Risk | **MEDIUM** |

---

### 8. Customer / order tracking

| # | Field | Authenticated + public tracking |
|---|--------|--------------------------------|
| 1 | Routes | `/orders/:id`, `/track` |
| 2 | Screens | `OrderTracking.tsx`, `PublicOrderTracking.tsx`, `CustomerOrderTimeline.tsx` (component) |
| 3 | Reads | **YES** |
| 4 | Writes | **PARTIAL** — tickets only on authenticated view |
| 5 | Mock | **NO** |
| 6 | Functional | **YES** |
| 7 | E2E | **PARTIAL** — timeline reflects `orders.status`; not governance event stream |
| 8 | Tables/Edge | `orders`, `support_tickets`; Edge `public-order-tracking` |
| 9 | Blocked | Customer timeline not fed from `operational_events` |
| 10 | Risk | **LOW** |

| # | Field | `/admin/customer-timeline-preview` |
|---|--------|-------------------------------------|
| 1 | Route | `/admin/customer-timeline-preview` |
| 2 | Screen | `CustomerTimelinePreview.tsx` |
| 3 | Reads | **PARTIAL** — `useCustomerTimelinePreview` from `operational_events` when available |
| 4 | Writes | **NO** |
| 5 | Mock | **NO** — labeled internal preview |
| 6 | Functional | **PARTIAL** — staff validation only |
| 7 | E2E | **NO** — not exposed to customers |
| 8 | Tables | `operational_events` |
| 9 | Blocked | Not wired to buyer app |
| 10 | Risk | **LOW** |

---

### 9. Demo / sample / mock / projection-only screens

| Module | Route | File | Reality |
|--------|-------|------|---------|
| Label Command Center | `/admin/label-command-center` | `LabelCommandCenter.tsx` | **Demo** — `demoPayloadForKind`, localStorage layout; no live print pipeline |
| Inventory Command Center | `/admin/inventory-command-center` | `InventoryCommandCenter.tsx` | **Projection only** — hardcoded feed flags, no DB |
| Inventory Risk Board | `/admin/inventory-risk-board` | `InventoryRiskBoard.tsx` | **Projection only** |
| Reservation Board (shell) | `/admin/reservation-board` | `ReservationBoard.tsx` | **PARTIAL** — panel writes; board timeline is governance projection |
| Carton Explorer | `/admin/carton-explorer` | `CartonExplorer.tsx` | **Design reference** — no live cartons |
| Scan Timeline | `/admin/scan-timeline` | `ScanTimeline.tsx` | **Documentation** — no scan feed |
| Entity Graph Explorer | `/admin/entity-graph-explorer` | `EntityGraphExplorer.tsx` | **PARTIAL** — bounded live feed, not full graph |
| Live Work Queues | `/admin/live-work-queues` | `LiveWorkQueues.tsx` | **Read-only** feeds |
| Execution Command Center | `/admin/execution-command-center` | `ExecutionCommandCenter.tsx` | **Read-only** intelligence |
| Execution Risk / Bottlenecks | `/admin/execution-risk`, `/admin/execution-bottlenecks` | Same hook | **Derived** from feeds + queues |
| Queue Execution Preview | `/admin/queue-execution-preview` | `QueueExecutionPreview.tsx` | **Preview writes** — SUPER_ADMIN / OPS_MANAGER |
| Barcode Execution Preview | `/admin/barcode-execution-preview` | `BarcodeExecutionPreview.tsx` | **Preview** — sample scan button |
| Stock Finalization Board | `/admin/stock-finalization` | `StockFinalizationBoard.tsx` | **PARTIAL** — live or demo via `VITE_STOCK_FINALIZATION_DEMO` |
| Golden Chain Wizard | `/admin/golden-chain-operator` | `GoldenChainOperatorWizard.tsx` | **PARTIAL** — orchestrates bundles; persistence mode dependent |
| Verification War Room | `/admin/verification` | `VerificationWarRoom.tsx` | **Retired** — redirect message to CMD War Room |
| Dispatch/Assembly TV | `/admin/dispatch-tv`, `/admin/assembly-tv` | `ComingSoonOverlay` | **Placeholder** |
| Governance boards (preview mode) | `dispatch-*`, `finance-governance` | Various | **Preview cards** if `VITE_EXECUTION_PREVIEW_FALLBACK=true` and no live rows |

---

## Summary tables

### A. Fully real modules (live Supabase read + write, primary workflow works)

| Module | Route |
|--------|-------|
| Customer cart & order submit | `/cart`, `/orders` |
| Admin product catalogue CRUD | `/admin/products`, `/admin/pricing`, `/admin/merchandising` |
| Legacy admin order ops | `/admin/orders`, `/admin/order-management`, `/admin/central-pool` |
| Legacy finance release | `/admin/finance`, `/admin/finance-board`, `/admin/accounts-release` |
| Legacy production & packing | `/admin/production` tabs, `/admin/assembly-tasks`, `/admin/ready-goods` |
| Legacy dispatch ops | `/admin/packing-dispatch`, `/admin/dispatch-mgmt` |
| Factory / RGS TV (read) | `/tv/*`, `/admin/rgs-tv` |
| CMD War Room | `/admin/cmd-war-room` |
| Sales dashboards | `/sales/dashboard`, `/admin/sales-hub` |
| Public order tracking | `/track` |
| Catalogue browse | `/catalogue`, `/home`, `/product/:id` |

### B. Partially real modules

| Module | Gap |
|--------|-----|
| WhatsApp Operator Inbox | Live packets + draft RPCs; no order creation; local draft UI |
| WA Sales Order Draft | Staging tables only through `APPROVED_FOR_SO` |
| Governance boards (dispatch/finance/stock) | Live when migrated; else unavailable/demo/preview |
| Golden Chain Operator Wizard | Depends on bundle `persistenceMode` |
| Department execution boards | Real queue infra; population/stitching incomplete |
| Entity graph / live queues / command center | Read-only or bounded feeds |
| Reservation governance panel | Writes reservations; board shell is projection |
| Customer order tracking | Status from `orders`, not operational event graph |

### C. Demo / mock / local-only modules

| Module | Route |
|--------|-------|
| Label Command Center | `/admin/label-command-center` |
| Inventory Command Center | `/admin/inventory-command-center` |
| Inventory Risk Board | `/admin/inventory-risk-board` |
| Carton Explorer | `/admin/carton-explorer` |
| Scan Timeline | `/admin/scan-timeline` |
| WA local draft order state | Inbox localStorage panel |
| WA local AI preview | Inbox toggle panel |
| Governance preview cards | Env `VITE_EXECUTION_PREVIEW_FALLBACK=true` |
| Stock finalization demo mode | Env `VITE_STOCK_FINALIZATION_DEMO=true` |
| Assembly / Dispatch TV | `/admin/assembly-tv`, `/admin/dispatch-tv` |
| Queue / Barcode execution preview | `/admin/queue-execution-preview`, `/admin/barcode-execution-preview` |

### D. Dangerous misleading UI

| Screen | Why |
|--------|-----|
| **FinanceGovernanceBoard** | Can show preview finance cards identical to live layout when fallback enabled or tables empty |
| **DispatchReadiness/Completion/Finalization boards** | Same preview fallback; `persistenceMode: demo` still renders actionable-looking UI |
| **WhatsApp Inbox — local draft panel** | Approve/reject in localStorage does not equal `sales_order_drafts` RPC workflow |
| **WhatsApp Inbox — Sales Order Draft approve** | `APPROVED_FOR_SO` implies downstream SO; migration explicitly forbids live order creation |
| **Label Command Center** | Production-looking label UI on demo payloads |
| **Inventory Command Center / Risk Board** | Operational dashboard chrome with synthetic projection feeds |
| **Parallel finance & dispatch screens** | Legacy screens advance orders while governance boards suggest separate authority |
| **AdminClients portal invite** | Toast reports success "(demo)" — may not send |

### E. Missing stitching points

1. `sales_order_drafts` (`APPROVED_FOR_SO`) → `orders` / `order_items` creation  
2. WA packet → persisted draft → commercial order (single intake)  
3. Finance governance evidence → legacy `orders.payment_status` / release flags  
4. Dispatch readiness → legacy `cleared_for_dispatch` / `dispatches`  
5. Stock finalization / reservations → `factory_inventory` truth  
6. Barcode scan ingest → scan timeline / dispatch completion evidence  
7. Operational events → customer-facing timeline (`/orders/:id`, `/track`)  
8. Execution queue items ← automatic seed from order state transitions  
9. Golden Chain wizard ← replace parallel legacy + governance UIs  
10. `C2C_EXECUTION_FLAGS` ← either wire to edges or remove from mental model  

### F. Recommended next 10 fixes (priority order)

1. **WA draft → live order RPC** — close the `#1` stitching gap with explicit idempotent order create on approve.  
2. **Remove or gate local draft localStorage UI** — prevent operator confusion with persisted drafts.  
3. **Apply / verify governance persistence tables** — dispatch + finance evidence stores (`probe*` must return supabase).  
4. **Pick canonical finance path** — deprecate or redirect duplicate `/admin/finance` vs `/admin/finance-governance`.  
5. **Pick canonical dispatch path** — same for packing-dispatch vs governance boards vs golden chain.  
6. **Disable preview fallback in production** — ensure `VITE_EXECUTION_PREVIEW_FALLBACK` is not true outside staging.  
7. **Wire scan feed to barcode execution** — connect `barcode-scan-ingest` edge to operational scans table.  
8. **Seed execution queues from order transitions** — department boards need real cards.  
9. **Customer timeline from operational_events** — replace raw status-only tracking where safe.  
10. **Retire or build TV placeholders** — Assembly/Dispatch TV currently Coming Soon inside Display Management.

---

## Counts

| Category | Count |
|----------|------:|
| Modules audited (route groups) | **28** |
| Fully real | **11** |
| Partially real | **8** |
| Demo/mock/local-only | **9** |
| High-risk misleading screens | **8** |
| Missing stitching points | **10** |

---

*Audit complete. No application code, migrations, or SQL were modified.*
