# PHASE 16 — Full Oasis Central system audit

**Date:** 2026-05-30  
**Code baseline:** `main` @ `189177dfd70407ac02b042cd11a7a5f24f846e44`  
**Governance chain:** 4A → 4B → 4C → 4D → 4E → 4F → 4G (staging validated; production DB schema **not** applied)  
**Scope:** Entire repo — routes, admin modules, services, governance, inventory, B2B, retail, dashboards, reporting, mobile UX.

**Method:** Static codebase review, existing audit docs, route inventory (~95 paths), `src/lib` module scan (424 files), grep for legacy `orders.status` / `factory_inventory` mutations, Phase 15 production probes.

---

## Executive summary

Oasis Central is a **large, dual-stack** system: a mature **B2B buyer storefront** and **legacy admin operations** surface, with a **new Execution OS governance layer** that is **code-complete and staging-proven** but **not production-deployed**. Replacing day-to-day operations requires **production schema migration**, **legacy write decommissioning**, and **closing read-model / retail / reporting gaps** — not more golden-chain feature work.

| Dimension | Estimate |
|-----------|----------|
| **Overall Oasis Central completion** | **~62%** toward “replace current operations” |
| **Governed Execution OS (code)** | **~88%** |
| **Governed Execution OS (production rollout)** | **~15%** (blocked on DB + pilot) |
| **B2B digital commerce** | **~78%** |
| **Legacy admin operations** | **~58%** |
| **Retail / store floor** | **~42%** |
| **Management reporting / KPIs** | **~48%** |
| **Mobile operational UX** | **~55%** |

---

## 1. COMPLETE modules (production-ready or near-ready)

Modules that can carry real traffic today with acceptable risk (some need production DB for governance boards).

| Module | Routes / entry | Evidence | Rollout score |
|--------|----------------|----------|:-------------:|
| **Authentication & role routing** | `/login`, `auth-routing.ts`, `ProtectedRoute` | 30+ roles mapped to landing paths | **92** |
| **B2B storefront** | `/home`, `/catalogue`, `/cart`, `/product/:id` | `StorefrontGate`, catalogue hooks | **85** |
| **B2B buyer account** | `/account`, addresses, users, logistics | `AppShell` + bottom nav | **80** |
| **B2B orders & tracking** | `/orders`, `/orders/:id`, `/track` | Order list + public tracking | **78** |
| **Buyer onboarding** | `/register`, `/onboarding`, `/approval-pending` | Full funnel | **75** |
| **Admin catalog governance** | `/admin/products`, `/admin/pricing`, `/admin/merchandising` | CRUD surfaces | **80** |
| **Client / B2B approvals** | `/admin/clients`, `/admin/approvals` | Same component | **78** |
| **Governed dispatch readiness (4B)** | `/admin/dispatch-readiness` | Service + evidence store + tests | **85** |
| **Governed dispatch completion (4D)** | `/admin/dispatch-completion` | Evidence-only, tested | **88** |
| **Governed dispatch finalization (4E)** | `/admin/dispatch-finalization` | Sole `→ dispatched` path | **88** |
| **Governed finance evidence (4C)** | `/admin/finance-governance` | `financeGovernanceService` + tests | **85** |
| **Governed reservation (4A/4F)** | `/admin/reservation-board` | `createGovernedReservation`, repository | **82** |
| **Governed stock finalization (4G)** | `/admin/stock-finalization` | Lineage + movements + PR #132 override | **82** |
| **Legacy dispatch decommission guards** | Packing, accounts, order mgmt | `legacyDispatchGuard`, static tests | **80** |
| **Factory TV walls** | `/tv/*` | `FactoryTVModule` | **85** |
| **Sales executive portal** | `/sales/dashboard` | Blocked from `/admin` | **75** |
| **Public legal / shipping** | `/terms`, `/privacy`, `/shipping` | Static pages | **90** |
| **WhatsApp operator inbox** | `/admin/operator-inbox` | Shipped; guardrail audits exist | **72** |

*Scores assume **staging DB** for governance rows; production scores for 4A–4G boards drop to **~20** until migrations applied.*

---

## 2. PARTIAL modules (implemented, not rollout-ready)

| Module | Routes | Gap | Rollout score |
|--------|--------|-----|:-------------:|
| **CMD War Room** | `/admin/cmd-war-room` | Bounded ~200-order window; scan/reservation pressure often **pending** | **58** |
| **Execution Command Center** | `/admin/execution-command-center` | Read-only intelligence; no write orchestration | **60** |
| **Department execution boards** | `/admin/execution/*` | Mobile view exists; queue **persistence not wired to actions** | **55** |
| **Live work queues** | `/admin/live-work-queues` | Read-only feeds | **50** |
| **Operational global search** | `/admin/operational-search` | Contract over in-memory hits; DB index depends on migration | **48** |
| **Entity graph explorer** | `/admin/entity-graph-explorer` | Order-derived projection only | **52** |
| **Inventory Command Center** | `/admin/inventory-command-center` | Projection / risk; not governed ledger for legacy stock | **55** |
| **Reservation board shell** | `/admin/reservation-board` | IOS design reference vs governed panel; post-4G reservation row drift | **65** |
| **Scan timeline** | `/admin/scan-timeline` | Needs authoritative scan store on prod | **50** |
| **Inventory risk board** | `/admin/inventory-risk-board` | Derived signals | **55** |
| **Order pipeline (legacy)** | `/admin/order-management` | Rich UX; **ungoverned pre-dispatch** status ladder | **60** |
| **Central order pool** | `/admin/central-pool` | Removed from nav; still reachable | **55** |
| **Packing & dispatch (legacy)** | `/admin/packing-dispatch` | Partial legs only; banner to 4E | **62** |
| **Dispatch management** | `/admin/dispatch-mgmt` | Pack/DPL; no governed close | **58** |
| **Security gate** | `/security-gate` | Carton release; order status via 4E only | **65** |
| **Finance release board (legacy)** | `/admin/finance-board` | **Direct Supabase order updates** | **45** |
| **Admin finance** | `/admin/finance` | Legacy payment/status paths | **50** |
| **Accounts release** | `/admin/accounts-release` | Gate data; dispatched blocked | **58** |
| **Factory inventory admin** | `/admin/inventory` | Legacy `factory_inventory` | **55** |
| **Production / assembly** | `/admin/production`, `/admin/assembly-tasks` | Tabs + PHH; **ungoverned inventory writes** | **52** |
| **Ready goods store** | `/admin/ready-goods` | RGS flows; direct status mutations | **55** |
| **Third-party store** | `/admin/3pcs-store` | Store ops | **50** |
| **Store coordination** | `/admin/store-coordination` | Mobile-first; **read-only** + local drafts | **42** |
| **Label command center** | `/admin/label-command-center` | JSON payloads only; no print adapter | **40** |
| **Customer timeline preview** | `/admin/customer-timeline-preview` | Staff preview; not customer-bound | **45** |
| **Operations controller** | `/operations-controller` | Handheld; mixed legacy writes | **55** |
| **Target vs actual / verification** | `/admin/target-vs-actual`, `/admin/verification` | Niche; not in main nav | **50** |
| **Reporting / sales hub** | `/admin/sales-hub` | Performance views; incomplete KPI suite | **48** |
| **Notifications / announcements** | `/admin/notifications`, `/admin/announcements` | Partial outbox | **50** |
| **Audit trail** | `/admin/audit` | Exists; not unified with governance lineage | **55** |
| **Media vault** | libs + scattered UI | Metadata; storage policy incomplete | **35** |
| **Barcode execution preview** | `/admin/barcode-execution-preview` | Preview / role-gated | **55** |

---

## 3. MISSING modules (not implemented or placeholder-only)

| Capability | Referenced in | Status |
|------------|---------------|--------|
| **Production Execution OS schema** | Phase 15 probes | Tables absent on `tcxvcatsqqertcnycuop` |
| **Shelf-level / per-outlet inventory truth** | `LAUNCH_BLOCKERS_MASTER`, Store coordination | Not built |
| **Label print execution adapter** | Label Command Center | JSON only |
| **Unified operational notification outbox** | Multiple surfaces | Fragmented |
| **AI order intake with guardrails** | Roadmap docs | Not in tree |
| **Customer-facing governed timeline** | `customer-timeline` libs | Projection only; no public bind |
| **Global operational search index (runtime)** | 3I migration + adapter | DB index unpopulated on prod |
| **Work queue claim / assign persistence in UI** | 3A3D schema | Schema on staging; UI read-only |
| **Reservation → fulfilled_qty sync after 4G** | Phase 15 pilot report | Service gap |
| **Physical stock availability auto-feed** | `reservationService` comments | Callers supply snapshots |
| **CMDHeartbeat dedicated page** | `CMDHeartbeat.tsx` | Orphan — route shows dashboard |
| **Public landing** | `PublicLanding.tsx` | Unrouted |
| **Movement ledger for `factory_inventory`** | Legacy ops | Adjustments only; no lineage |
| **Automated KPI / alert suite** | Management gap | No single module |
| **End-to-end retail reservation API** | Store coordination | Local drafts disabled |

---

## 4. DANGEROUS modules (ungoverned business state mutation)

Surfaces that can change `orders.status`, inventory, or finance state **without** Phase 4 evidence/lineage.

| Surface | File(s) | Risk | Severity |
|---------|---------|------|----------|
| **Finance release board** | `FinanceReleaseBoard.tsx` | Direct `orders.update` | **Critical** |
| **Admin finance** | `AdminFinance.tsx` | Payment/status updates | **Critical** |
| **Accounts release** | `AdminAccountsRelease.tsx` | Pre-dispatch + gate paths (dispatched blocked) | **High** |
| **Order management** | `OrderManagement.tsx` | Status ladder (dispatched blocked) | **High** |
| **Admin orders** | `AdminOrders.tsx` | Pipeline advances | **High** |
| **Ready goods / stock check** | `ReadyGoodsStore.tsx`, `StockCheckEngine.tsx` | `packed_ready`, `manufacturing` | **High** |
| **Admin operations** | `AdminOperations.tsx` | Smart split → `factory_inventory` | **High** |
| **Production floor** | `FloorTablet.tsx`, `phh/*` | `factory_inventory` qty | **High** |
| **Dispatch management** | `DispatchManagement.tsx` | `awaiting_final_payment` | **Medium** |
| **CMD war room cards** | `CMDWarRoom.tsx`, `WarRoomOrderCard.tsx` | Status updates | **High** |
| **Third-party demand** | `ThirdPartyDemandSection.tsx` | Order mutations | **Medium** |
| **WhatsApp webhook** | `supabase/functions/whatsapp-webhook` | Cancel/dispute status | **High** |
| **Banyan parser** | `banyan-central-parser` | Order updates | **Medium** |
| **Legacy cart / orders** | `Orders.tsx`, `useCart.ts` | Buyer-side limited | **Low–Medium** |

**Governed exceptions (safe):** `dispatch-finalization/dispatchStatusMutation.ts`, `inventory-reservations/*`, `stock-finalization/*`, `finance-governance` service (when used).

---

## 5. DUPLICATE modules (legacy overlap)

| Legacy surface | Governed / new surface | Resolution direction |
|----------------|------------------------|----------------------|
| `/admin/finance-board` | `/admin/finance-governance` | Decommission legacy board writes |
| `/admin/finance` | Finance governance service | Route finance actions through 4C |
| `/admin/packing-dispatch`, `/admin/dispatch` | 4B–4E boards | Read-only + deep links |
| `/admin/dispatch-mgmt` | Dispatch execution board + 4B–4E | Pack only; close via 4E |
| `factory_inventory` | `inventory_stock_balances` + movements | Migrate writes or dual-write policy |
| `inventory-operating-system/reservationLifecycle` | `inventory-reservations/reservationLifecycle` | Remove design reference from operator path |
| `ReservationBoard` page chrome | `ReservationGovernancePanel` | Keep single write panel |
| `/admin/order-management` | Golden chain boards | Pipeline for pre-dispatch only |
| `/admin/accounts-release` | 4C finance governance | Evidence before release |
| `order_status_history` | `dispatch_release_lineage` | Different purposes; document both |

---

## 6. Operator UX gaps

| Area | Gap |
|------|-----|
| **Navigation** | ~20 admin routes lack sidebar entries (finance-board, central-pool, execution-risk, 3pcs-store, TVs, etc.) |
| **Golden chain** | No single “start here” wizard linking 4B→4G for an order |
| **Reservation board** | Post-4G row still shows `fulfilled_qty: 0` — confusing vs lineage |
| **Stock finalization** | SUPER_ADMIN must enter override reason (fixed) — still easy to miss |
| **Store coordination** | “Integration pending” — dead-end for bookings |
| **Search** | No unified fast search on prod without 3I index |
| **Work queues** | No claim/assign buttons despite schema |
| **CMD** | Metrics show **pending** for scan/reservation pressure |
| **Central pool** | Hidden from nav but bookmarked |
| **Role confusion** | `SALES_EXECUTIVE` blocked from admin — good; finance/exec overlap unclear |
| **Filters** | Inconsistent across boards (some lack order # / SO search) |
| **Legacy banners** | Not all legacy pages show `LegacyDispatchGovernanceBanner` |
| **Mobile admin** | Governance boards dense on phone; finance/inbox WARNING in UX matrix |

---

## 7. Management gaps

| Gap | Detail |
|-----|--------|
| **Executive KPIs** | CMD + sales hub partial; no single P&L / throughput dashboard |
| **Governance compliance report** | No “orders closed outside 4E” audit dashboard |
| **Inventory truth report** | Two stock systems — no reconciliation report |
| **Pilot metrics** | `PILOT_ORDER_TEST_MATRIX` exists; no live production dashboard |
| **Alerts** | WhatsApp + notifications fragmented; no SLA alert engine |
| **Factory performance** | Target vs actual exists; not wired to execution boards |
| **Finance hold dashboard** | Evidence in DB; no exec rollup on prod |
| **Reservation expiry** | Logic in service; no management alert board |

---

## 8. Data quality risks

| Risk | Cause | Mitigation |
|------|-------|------------|
| **Dual inventory systems** | `factory_inventory` vs governed balances | P0 reconciliation policy |
| **Orphan reservations** | Balance `reserved_qty` not always updated on reserve | P0 sync job or service fix |
| **Post-4G reservation drift** | 4G does not update `inventory_reservations` | Trust lineage; P1 sync |
| **Ungoverned status history** | `order_status_history` without `dispatch_release_lineage` | Block legacy writers |
| **Bounded CMD feeds** | ~200 orders window | Label UI “partial window” |
| **Duplicate migration DDL paths** | Finance columns via multiple migrations | Idempotent apply (Phase 15.3) |
| **WhatsApp → order status** | Edge function bypass | P0 policy + audit |
| **Missing scan idempotency on prod** | Schema not deployed | Phase 15 migration |
| **Weak audit on factory_inventory** | Direct qty updates | Movement ledger or ban writes |

---

## 9. Mobile readiness

| Segment | Status | Notes |
|---------|--------|-------|
| **B2B buyer (`AppShell`)** | **Good** | Bottom nav; crawl PASS on overflow |
| **Buyer portal** | **Fair** | Top nav only |
| **Execution boards** | **Fair** | `ExecutionBoardMobileView` exists |
| **Store coordination** | **Good intent** | Read-only; mobile layout |
| **Security gate / ops controller** | **Fair** | Handheld targets |
| **Governance boards 4B–4G** | **Poor–Fair** | Dense tables; verify on iPhone SE |
| **Finance / inbox** | **WARNING** | `UX_MOBILE_FIRST_AUDIT_MATRIX` |
| **Admin sidebar** | **Poor** | Desktop-first drawer |
| **Quick order** | **WARNING** | Keyboard overlap risk |

**Verdict:** Mobile-ready for **buyers**; **floor and governance** need dedicated mobile QA pass before company rollout.

---

## 10. Rollout readiness score by module

| Module | Score | Notes |
|--------|------:|-------|
| B2B commerce | **78** | Primary digital channel |
| Auth & RBAC | **92** | |
| Execution OS governance (code) | **88** | Staging golden chain |
| Execution OS governance (prod DB) | **18** | Schema missing |
| Dispatch legacy surfaces | **58** | Guards in place |
| Finance (legacy + governed) | **52** | Dual paths |
| Inventory governed (4A/4G) | **80** | Code; prod blocked |
| Inventory legacy (`factory_inventory`) | **50** | |
| CMD / intelligence | **55** | Read-only |
| Retail / store coordination | **42** | |
| Production / assembly floor | **52** | |
| WhatsApp ops | **72** | |
| Reporting / KPIs | **48** | |
| Customer timeline (public) | **35** | |
| Mobile admin / floor | **55** | |
| Data platform / migrations | **40** | 19 pending on prod |

---

## 11. Route inventory summary

| Category | Count |
|----------|------:|
| Total route paths (incl. aliases) | ~95 |
| Admin `/admin/*` pages | ~68 |
| B2B buyer routes | ~18 |
| Staff standalone (`/operations-controller`, `/security-gate`, `/sales/*`, `/tv/*`) | ~9 |
| Orphan page files (no route) | 3 |
| `src/lib` top-level domains | 40+ |
| Admin pages with direct `orders.update` (grep) | ~15 files |

Full route table: see Phase 16 exploration notes in `src/App.tsx` + `AdminLayout.tsx`.

---

## 12. References

- `docs/EXECUTION_OS_STACK_STAGING_READINESS.md`
- `docs/LEGACY_DISPATCH_MUTATION_AUDIT.md`
- `docs/OPERATIONAL_MODULE_COMPLETION_MATRIX.md`
- `docs/LAUNCH_BLOCKERS_MASTER.md`
- `docs/UX_MOBILE_FIRST_AUDIT_MATRIX.md`
- `docs/PHASE_15_1_PRODUCTION_READ_ONLY_PROBE_REPORT.md`
- `docs/PHASE_15_3_15_5_REPORT.md`

---

*End of Phase 16 system audit.*
