# Oasis Central Backend Reality Audit

**Date:** 2026-06-09  
**Method:** Static analysis of `supabase/migrations/`, `supabase/functions/`, and frontend `supabase` usage. No runtime DB calls, no migrations applied.

**Deployment caveat:** `docs/SUPABASE_MIGRATION_DRIFT_REPORT.md` documents local/remote migration history drift. Tables defined only in unpushed local migrations may be **absent on production** even if present in repo/`types.ts`. Remote apply status below is **UNKNOWN** unless noted in drift docs.

---

## Per-area backend audit

### 1. Product / catalogue tables

| Field | Value |
|-------|--------|
| **Tables/RPCs/functions** | `products`, `product_variants`, `product_bom`, `product_tags`, `product_tag_mapping`, `product_aliases`, `pricing_slabs`, `moq_rules`, `exchange_rates`, `catalogue_product_mappings` (migration `20260601180000`), `catalogue_tag_drafts`, `catalogue_alias_drafts` (in `types.ts` only — **no local migration SQL found**), RPCs `approve_catalogue_tag_draft`, `approve_catalogue_alias_draft`, `reject_catalogue_*` (**referenced by frontend, no migration SQL in repo**), Edge `generate-product-attributes` |
| **Used by frontend** | **YES** — catalogue, admin products/pricing/merchandising, connector sync, approval inbox |
| **RLS/policies** | **YES** (repo) — `products` policies in early migrations; `catalogue_product_mappings` staff select/write |
| **Insert/update path** | **PARTIAL** — direct PostgREST on core product tables; approval RPCs **may be missing**; connector writes mappings + products |
| **Read path** | **YES** |
| **Seed/demo dependency** | **PARTIAL** — `product_aliases` seed inserts in `20260421045605`; no demo products required |
| **E2E to UI** | **PARTIAL** — browse/CRUD real; catalogue approval RPC backend not in repo migrations |
| **Risk** | **HIGH** |
| **Missing stitching** | Approval draft tables/RPCs not versioned in repo; connector → storefront cache |

---

### 2. Customer / company tables

| Field | Value |
|-------|--------|
| **Tables/RPCs/functions** | `companies`, `users`, `profiles`, `b2b_applications`, `delivery_addresses`, `wallet_transactions`, `credit_requests`, `bi_monthly_ledgers`, `ledger_disputes`, `credit_rescue_events`, `shadow_clients`, `customer_import_batches`, `customer_import_raw`, … (staging import `20260607190000` — **explicitly does not promote to companies**), RPCs `get_user_role`, `is_internal_staff`, `guard_companies_is_frozen` (trigger), Edge `validate-user`, `msg91-otp`, `notify-event`, `send-email` |
| **Used by frontend** | **YES** — auth, register, admin clients, sales, finance, war room |
| **RLS/policies** | **YES** — `companies`, `b2b_applications`, `profiles`, ledger tables |
| **Insert/update path** | **YES** — registration, admin client mgmt, credit/finance flows |
| **Read path** | **YES** |
| **Seed/demo dependency** | **NO** |
| **E2E to UI** | **PARTIAL** — live customer path works; `customer_import_*` **not referenced in frontend** |
| **Risk** | **MEDIUM** |
| **Missing stitching** | Customer master import staging → `companies`/`users` promotion |

---

### 3. WhatsApp inbox tables

| Field | Value |
|-------|--------|
| **Tables/RPCs/functions** | `whatsapp_message_packets`, `whatsapp_messages`, `whatsapp_contacts`, `whatsapp_buffer`, `whatsapp_config`, `whatsapp_override_log`, `whatsapp_suggestions_log` (C2A reconciliation `20260518220000`), inbox reader RLS `20260604120000`, Edges `whatsapp-webhook`, `whatsapp-message-stitcher`, `whatsapp-operator-reply`, `whatsapp-classify-intent`, `whatsapp-route-packet`, `whatsapp-identify-sender`, `send-whatsapp`, `send-whatsapp-automation` |
| **Used by frontend** | **PARTIAL** — inbox reads packets; invokes reply/classify/route/identify/send; **webhook/stitcher/automation not called from UI** (ingress/cron) |
| **RLS/policies** | **YES** — inbox reader SELECT policies; audit log tables reconciled in C2A migration |
| **Insert/update path** | **PARTIAL** — writes via **Edge functions** (ingress), not browser PostgREST; C2A migration **pending apply** per drift report |
| **Read path** | **YES** — `whatsapp_message_packets` + embedded messages |
| **Seed/demo dependency** | **NO** |
| **E2E to UI** | **PARTIAL** — display/reply path exists; depends on webhook → stitcher → DB chain |
| **Risk** | **HIGH** |
| **Missing stitching** | Migration drift blocks C2A apply; ingress edges not surfaced in UI audit path |

---

### 4. Sales order tables

| Field | Value |
|-------|--------|
| **Tables/RPCs/functions** | `orders`, `order_items`, `order_status_history`, `order_payments`, `order_attachments`, `order_returns`, `store_requisitions`, `store_requisition_items`, `suggested_orders`, `support_tickets`, RPCs `log_cart_failure`, `restore_order_financials`, Edges `public-order-tracking`, `admin-create-draft`, `send-whatsapp` |
| **Used by frontend** | **YES** — cart, orders, admin order mgmt, dispatch, finance, war room, tracking |
| **RLS/policies** | **YES** — buyer draft insert/update; staff read/update; sales roster scope (`20260508155100`, **local-only per drift**) |
| **Insert/update path** | **YES** — buyer draft submit; staff status/payment/dispatch updates |
| **Read path** | **YES** |
| **Seed/demo dependency** | **NO** |
| **E2E to UI** | **YES** for legacy portal → production → dispatch path |
| **Risk** | **MEDIUM** |
| **Missing stitching** | Roster-scope migration may be unapplied on remote; parallel governance order signals |

---

### 5. Sales order draft tables (WA staging)

| Field | Value |
|-------|--------|
| **Tables/RPCs/functions** | `sales_order_drafts`, `sales_order_draft_lines`, `sales_order_draft_audit_log` (`20260605120000`), RPCs `create_sales_order_draft_atomic`, `update_sales_order_draft_operator_final`, `submit_sales_order_draft_for_review_atomic`, `approve_sales_order_draft_for_so_atomic`, `reject_sales_order_draft_atomic`, `transition_sales_order_draft_status`, `validate_sales_order_draft_readiness` |
| **Used by frontend** | **YES** — `salesOrderDraftRepository.ts` / Operator Inbox draft section |
| **RLS/policies** | **YES** — service_role + inbox_reader select/insert/update policies |
| **Insert/update path** | **YES** — **RPC-only** (no direct table writes from UI) |
| **Read path** | **YES** |
| **Seed/demo dependency** | **NO** |
| **E2E to UI** | **NO** — migration header: **does NOT create live orders**; approve is terminal staging |
| **Risk** | **HIGH** |
| **Missing stitching** | `APPROVED_FOR_SO` → `orders` insert RPC/trigger |

---

### 6. Finance / governance tables

| Field | Value |
|-------|--------|
| **Tables/RPCs/functions** | Legacy: `order_payments`, `inward_material_advice`, `inward_material_items`, `commission_payouts`, `freight_ledger`, `audit_logs`, `notification_events`. Governance: `finance_review_evidence` (`20260526130000`), immutability trigger. Edges `generate-bi-monthly-ledger`, `generate-rescue-ledger` |
| **Used by frontend** | **PARTIAL** — legacy finance screens **YES**; governance board via `supabaseFinanceEvidenceStore` **PARTIAL** (probe table) |
| **RLS/policies** | **YES** (repo) — finance evidence staff select + finance-role insert; legacy tables have staff/buyer policies |
| **Insert/update path** | **PARTIAL** — legacy direct writes **YES**; governed evidence **YES if table exists** |
| **Read path** | **YES** — legacy; governance read model adapters |
| **Seed/demo dependency** | **NO** |
| **E2E to UI** | **PARTIAL** — two parallel finance backends |
| **Risk** | **HIGH** |
| **Missing stitching** | `finance_review_evidence` may be unapplied; signal → legacy `orders.payment_status` |

---

### 7. Dispatch tables

| Field | Value |
|-------|--------|
| **Tables/RPCs/functions** | Legacy: `dispatches`, `dispatch_cartons`, `packing_lists`, `order_attachments`. Governance: `dispatch_readiness_evidence`, `dispatch_completion_evidence`, `dispatch_release_lineage` (Phase 4B–4E migrations), immutability triggers |
| **Used by frontend** | **PARTIAL** — legacy dispatch mgmt **YES**; governance stores via bundle probe **PARTIAL** |
| **RLS/policies** | **YES** (repo) — `dispatch_cartons` staff policies; governance evidence role-gated inserts |
| **Insert/update path** | **PARTIAL** — legacy **YES**; governance evidence **conditional** |
| **Read path** | **YES** |
| **Seed/demo dependency** | **NO** |
| **E2E to UI** | **PARTIAL** — legacy dispatch works; governance path parallel |
| **Risk** | **HIGH** |
| **Missing stitching** | Readiness/completion/finalization evidence → legacy `dispatches` / order status |

---

### 8. Production / factory tables

| Field | Value |
|-------|--------|
| **Tables/RPCs/functions** | `production_jobs`, `daily_production_logs`, `factory_inventory`, `factory_holidays`, `system_settings`; stock OS: `inventory_stock_balances`, `stock_consumption_lineage` (`20260526160000`), reservation tables (`20260526030000`) |
| **Used by frontend** | **YES** — assembly, ready goods, floor tablet, factory TV, target-vs-actual; reservations/stock via governance panels **PARTIAL** |
| **RLS/policies** | **YES** — `factory_inventory` staff/buyer read; stock/reservation migrations have staff policies |
| **Insert/update path** | **PARTIAL** — legacy production writes **YES**; governed stock/reservation **conditional on migration apply** |
| **Read path** | **YES** |
| **Seed/demo dependency** | **NO** |
| **E2E to UI** | **PARTIAL** — production queue works; stock finalization gated on Phase 4G |
| **Risk** | **MEDIUM** |
| **Missing stitching** | Reservations → stock consumption → `factory_inventory` |

---

### 9. Barcode / catalogue execution tables

| Field | Value |
|-------|--------|
| **Tables/RPCs/functions** | `operational_scan_records` (`20260526010000`), `operational_queue_items`, `operational_queue_assignments`, `operational_events` (`20260525230000`), `operational_search_index` (`20260526020000`), Edge `barcode-scan-ingest` (+ shared ingest lib re-exported in `src/lib/barcode-ingest`) |
| **Used by frontend** | **PARTIAL** — execution boards + barcode preview write to `operational_scan_records`; **edge ingest not invoked from UI**; search index repo exists, **no admin screen backfill** |
| **RLS/policies** | **YES** (repo) — staff read/insert on scan, queue, event, search tables |
| **Insert/update path** | **PARTIAL** — preview/admin bundle inserts; hardware ingest edge **not wired to UI** |
| **Read path** | **PARTIAL** — boards read if tables exist; Scan Timeline page has **no feed** |
| **Seed/demo dependency** | **NO** |
| **E2E to UI** | **NO** — scan ingest → dispatch completion not connected in UI |
| **Risk** | **HIGH** |
| **Missing stitching** | `barcode-scan-ingest` → `operational_scan_records` → dispatch evidence |

---

### 10. Edge functions / RPCs (app-wide inventory)

**Frontend-invoked Edge functions (14):**

| Function | Frontend use |
|----------|----------------|
| `whatsapp-operator-reply` | Operator Inbox |
| `whatsapp-classify-intent` | Operator Inbox |
| `whatsapp-route-packet` | Operator Inbox |
| `whatsapp-identify-sender` | WA governance resolution |
| `send-whatsapp` | Order mgmt, settings, utils |
| `send-email` | Users, notification outbox |
| `notify-event` | Register, notify utils |
| `public-order-tracking` | `/track` |
| `admin-create-draft` | War room tabs |
| `oasis-ai-chat` | War room alias drawer |
| `generate-product-attributes` | Admin products |
| `generate-bi-monthly-ledger` | Ledger disputes panel |
| `msg91-otp` | Login |

**Ingress / backend-only (not frontend-invoked):** `whatsapp-webhook`, `whatsapp-message-stitcher`, `whatsapp-otp`, `msg91-webhook`, `validate-user`, `send-whatsapp-automation`, `barcode-scan-ingest`, `banyan-central-parser`, `generate-rescue-ledger`

**Frontend-invoked RPCs:** `get_user_role`, `is_internal_staff`, `log_cart_failure`, `restore_order_financials`, `increment_announcement_counter`, `create_sales_order_draft_atomic`, `update_sales_order_draft_operator_final`, `submit_sales_order_draft_for_review_atomic`, `approve_sales_order_draft_for_so_atomic`, `reject_sales_order_draft_atomic`, `approve_catalogue_tag_draft`, `approve_catalogue_alias_draft`, `reject_catalogue_tag_draft`, `reject_catalogue_alias_draft`

**RPC in repo migrations but not used by app:** `transition_sales_order_draft_status` (superseded by atomic RPCs)

| Field | Value |
|-------|--------|
| **Used by frontend** | See tables above |
| **RLS/policies** | RPCs use `SECURITY DEFINER` / role checks in SQL |
| **Risk** | **HIGH** — catalogue approval RPCs lack repo migrations; drift blocks newer WA/governance migrations |

---

## Summary tables

### A. Backend areas ready

| Area | Notes |
|------|--------|
| Core product tables | `products` + variants/BOM/tags — read/write in production UI |
| Customer/company core | `companies`, `users`, `profiles`, `b2b_applications`, addresses |
| Sales orders (legacy) | Full CRUD + payments + status history |
| Production/factory (legacy) | `production_jobs`, `factory_inventory`, `daily_production_logs` |
| Legacy dispatch | `dispatches`, `dispatch_cartons`, `packing_lists` |
| Public tracking | Edge `public-order-tracking` + `orders.tracking_token` |
| Auth RPCs | `get_user_role`, `is_internal_staff` |

### B. Backend areas partial

| Area | Gap |
|------|-----|
| WA inbox | Depends on ingress edges + C2A migration apply |
| Sales order drafts | Persisted but no order promotion |
| Finance/dispatch governance | Tables in repo; apply/drift uncertain; parallel legacy writes |
| Stock/reservations (Phase 4A/4G) | Service layer exists; migration apply uncertain |
| Operational execution (Phase 3) | Tables + UI boards; queue population incomplete |
| Barcode | Table + preview writes; no hardware ingest UI path |
| Catalogue connector | Mappings table; sync UI partial |
| Catalogue approvals | Types + UI; RPC migrations missing from repo |

### C. Backend areas unused / orphaned (in repo)

| Artifact | Notes |
|----------|--------|
| `customer_import_*` tables | Sprint 9.5 staging — no frontend references |
| `transition_sales_order_draft_status` RPC | Superseded, unused in app |
| `generate-rescue-ledger` edge | No frontend invoke |
| `banyan-central-parser` edge | No frontend invoke |
| `operational_search_index` | Repository only; no backfill UI |
| `whatsapp_buffer` | Legacy; limited UI exposure |

### D. Frontend screens without real backend

| Screen | Missing backend |
|--------|-----------------|
| Scan Timeline | No `operational_scan_records` feed wiring |
| Inventory Command Center / Risk Board | Synthetic projection feeds only |
| Label Command Center | Demo payloads, no print pipeline table |
| Carton Explorer | Design reference only |
| Catalogue Approvals (if RPCs absent remotely) | `approve_catalogue_*` RPCs not in repo SQL |
| WA draft approve → order | No `orders` creation backend |

### E. Backend tables/functions not surfaced in UI

| Backend | Status |
|---------|--------|
| `customer_import_batches`, `customer_import_raw` | Staging only |
| `barcode-scan-ingest` edge | No operator UI |
| `whatsapp-message-stitcher`, `whatsapp-webhook` | Infra only |
| `operational_search_index` | No search admin/backfill screen |
| `generate-rescue-ledger` | No UI invoke |
| `inventory_reservation_allocations` | Used via service, limited board surfacing |
| `stock_consumption_lineage` | Written via stock service, no explorer UI |

### F. Top 10 stitching fixes needed

1. Reconcile migration drift so Phase 3–4 + WA Sprint 9 migrations can apply to remote  
2. Add `APPROVED_FOR_SO` → `orders` atomic promotion RPC  
3. Add/version `approve_catalogue_*` / `reject_catalogue_*` RPC SQL in repo (or confirm remote-only)  
4. Apply C2A WhatsApp audit migration (`20260518220000`) after drift fix  
5. Wire `finance_review_evidence` signals to legacy order release fields  
6. Wire dispatch governance evidence → `dispatches` / status transitions  
7. Connect `barcode-scan-ingest` edge to `operational_scan_records` production path  
8. Promote `customer_import_*` staging → `companies` or remove from scope  
9. Seed `operational_queue_items` from order state for execution boards  
10. Single dispatch/finance authority — deprecate duplicate legacy write paths  

---

## Counts

| Metric | Count |
|--------|------:|
| Backend areas audited | **10** |
| Edge functions in repo | **22** (+ shared ingest modules) |
| Frontend-invoked edges | **13** |
| Frontend-invoked RPC families | **14** |
| High-risk areas | **6** (catalogue approval, WA inbox, SO drafts, finance gov, dispatch gov, barcode) |

---

*Audit complete. No application code, migrations, or SQL were modified or applied.*
