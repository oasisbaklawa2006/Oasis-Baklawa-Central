# PHASE 17 — Legacy write lockdown audit

**Purpose:** Identify every **route** (and edge entry) that can mutate governed state so operations can enforce lockdown **without new feature work** (access policy, training, bookmarks, role restrictions).  
**Scope:** `orders.status`, `inventory_stock_balances`, `inventory_reservations`, dispatch operational state (`dispatches` / cartons), finance state (`payment_status` / legacy finance fields vs `finance_review_evidence`).  
**Code baseline:** `189177dfd70407ac02b042cd11a7a5f24f846e44`  
**Classification:**

| Class | Meaning for go-live |
|-------|---------------------|
| **A** | **Disable immediately** for pilot — remove nav/bookmarks; block role access; do not use for pilot orders |
| **B** | **Redirect** — operational prep allowed only; closing actions must use governance boards |
| **C** | **Safe** — governed path or read-only / non-governed-domain writes |

**Note:** Several routes already **block** `orders.status → dispatched` in code; they remain **B** for other status/finance mutations until engineering decommission (post go-live).

---

## 1. Governed golden chain (reference — all **C**)

| Route | Mutations | Class |
|-------|-----------|:-----:|
| `/admin/dispatch-readiness` | `dispatch_readiness_evidence` insert | **C** |
| `/admin/finance-governance` | `finance_review_evidence` insert | **C** |
| `/admin/dispatch-completion` | `dispatch_completion_evidence` insert | **C** |
| `/admin/dispatch-finalization` | `dispatch_release_lineage` + **only** governed `orders.status → dispatched` | **C** |
| `/admin/reservation-board` | `inventory_reservations` / movements via `createGovernedReservation` → repository | **C** |
| `/admin/stock-finalization` | `inventory_stock_balances`, `stock_consumption_lineage`, `inventory_movements` via `stockFinalizationService` | **C** |

**Lib-only writers (no direct route — C):**

- `src/lib/dispatch-finalization/dispatchStatusMutation.ts`
- `src/lib/inventory-reservations/supabaseInventoryReservationStore.ts`
- `src/lib/stock-finalization/supabaseStockFinalizationStore.ts`
- `src/lib/finance-governance/supabaseFinanceEvidenceStore.ts`
- `src/lib/dispatch-readiness/supabaseDispatchEvidenceStore.ts`
- `src/lib/dispatch-completion/supabaseDispatchCompletionEvidenceStore.ts`

---

## 2. `orders.status` — by route

| Route | Component | Status mutations | Dispatched blocked? | Class |
|-------|-----------|------------------|---------------------|:-----:|
| `/admin/dispatch-finalization` | `DispatchFinalizationBoard` | → `dispatched` (governed) | N/A (sole path) | **C** |
| `/admin/order-management` | `OrderManagement` | Full pipeline | **Yes** (toast) | **B** |
| `/admin/orders` | `AdminOrders` | Pipeline advance | **Yes** (toast) | **B** |
| `/admin/finance-board` | `FinanceReleaseBoard` | `in_production`, payment fields | N/A | **A** |
| `/admin/finance` | `AdminFinance` | `manufacturing`, `payment_status`, receipts | N/A | **A** |
| `/admin/accounts-release` | `AdminAccountsRelease` | `manufacturing`, `cleared_for_dispatch`, `paid`, etc. | **Yes** on gate pass close | **B** |
| `/admin/packing-dispatch`, `/admin/dispatch` | `AdminPackingDispatch` | Full close blocked; partial `dispatches` leg | **Yes** (non-partial) | **B** |
| `/admin/dispatch-mgmt` | `DispatchManagement` | → `awaiting_final_payment` | N/A | **B** |
| `/admin/ready-goods` | `ReadyGoodsStore` | → `packed_ready` | N/A | **B** |
| `/admin/production` | `AdminProduction` (tabs) | Via embedded PHH / RGS | N/A | **B** |
| `/admin/operations` | `AdminOperations` | Smart split / status adjacent | N/A | **B** |
| `/operations-controller` | `OperationsController` | PHH job flows | N/A | **B** |
| `/admin/cmd-war-room` | `CMDWarRoom` | `draft` / `submitted` only | No dispatch close | **B** |
| `/security-gate` | `AdminSecurityGate` | Carton release (not order dispatched) | **Yes** (4F decommission) | **C** * |
| `/admin/3pcs-store` | `ThirdPartyStore` | Store demand (verify per order) | — | **B** |
| `/cart`, buyer flows | `useCart`, `Orders` | Draft / starter pack flags | N/A | **C** |
| Edge: `whatsapp-webhook` | function | cancel / dispute / stale cancel | Can cancel orders | **A** † |
| Edge: `banyan-central-parser` | function | Order updates | — | **A** † |

\* Security gate safe for **carton** ops; operators must not treat as order closure.  
† Edge functions: **policy** disable status side-effects for pilot order IDs or freeze webhook status writes during pilot week.

---

## 3. `inventory_stock_balances` — by route

| Route | Writer | Class |
|-------|--------|:-----:|
| `/admin/stock-finalization` | `supabaseStockFinalizationStore` | **C** |
| `/admin/reservation-board` | Staging seed helpers only (explicit buttons) | **B** — pilot: use only documented seed for pilot SKU |
| All other admin routes | **No direct UI update** located | **C** (read) |

**Legacy parallel stock (not `inventory_stock_balances`):**

| Route | Table | Class |
|-------|-------|:-----:|
| `/admin/operations` | `factory_inventory` update | **A** for governed pilot SKUs |
| `/admin/production`, `/operations-controller` | `factory_inventory` via PHH | **A** |
| `/admin/inventory` | Factory stock admin | **B** |
| Floor components | `FloorTablet`, `StockCheckEngine` | **A** / **B** |

**Go-live rule:** For pilot SKUs/locations, treat **`inventory_stock_balances` + lineage** as sole truth; do not adjust `factory_inventory` for those SKUs during pilot.

---

## 4. `inventory_reservations` — by route

| Route | Writer | Class |
|-------|--------|:-----:|
| `/admin/reservation-board` | `ReservationGovernancePanel` → repository | **C** |
| Other routes | No direct UI insert/update found | **C** |

**Manual SQL:** **A** — forbidden during pilot (`PRODUCTION_PILOT_CHECKLIST.md`).

---

## 5. Dispatch state (`dispatches`, `dispatch_cartons`, packing)

| Route | Behavior | Affects `orders.status`? | Class |
|-------|----------|--------------------------|:-----:|
| `/admin/packing-dispatch` | Partial `dispatches.insert` | No (partial only) | **B** |
| `/admin/accounts-release` | Gate pass → `dispatches` row `status: dispatched` | **No** on order (blocked) | **B** |
| `/security-gate` | Carton scan / release | No | **C** |
| `/admin/dispatch-mgmt` | Pack / DPL workflow | `awaiting_final_payment` on order | **B** |
| `/admin/dispatch-readiness` … `4E` | Evidence + governed close | 4E only | **C** |

**Go-live rule:** Physical dispatch records may exist in legacy tables; **order closure** only via **4E**.

---

## 6. Finance state

| Route | Evidence table | Legacy `orders.payment_*` / status | Class |
|-------|----------------|-----------------------------------|:-----:|
| `/admin/finance-governance` | `finance_review_evidence` | No direct ungoverned close | **C** |
| `/admin/finance-board` | None | Direct updates | **A** |
| `/admin/finance` | None | Direct updates | **A** |
| `/admin/accounts-release` | Audit logs only | `payment_status`, `cleared_for_dispatch`, wallet | **B** |

---

## 7. Read-only / no mutation routes (execution intelligence)

**C** for governed domains — do not use for closing orders:

- `/admin/execution-command-center`, `/admin/execution-risk`, `/admin/execution-bottlenecks`
- `/admin/execution/production|assembly|dispatch|ready-goods|retail|third-party|complaints`
- `/admin/live-work-queues`, `/admin/entity-graph-explorer`, `/admin/operational-search`
- `/admin/inventory-command-center`, `/admin/inventory-risk-board`, `/admin/scan-timeline`
- `/admin/customer-timeline-preview`, `/admin/queue-execution-preview`, `/admin/barcode-execution-preview`

---

## 8. Enforcement playbook (no code change)

| Action | Owner | Applies to |
|--------|-------|------------|
| Remove bookmarks to **A** routes for pilot roles | Ops | finance-board, finance, webhook-driven cancel |
| Communicate **sole dispatched path**: `/admin/dispatch-finalization` | Ops | All dispatch/finance staff |
| Pilot orders only in `PILOT_ORDER_TEST_MATRIX` — no bulk processing on legacy boards | Ops | B routes |
| Daily grep audit (optional): `dispatch_release_lineage` without pilot correlation | Eng | Compliance |
| Freeze **factory_inventory** edits for pilot SKUs | Warehouse | A routes |
| WhatsApp: no cancel/status automation on pilot SOs | Ops | Edge **A** |

---

## 9. Post-go-live engineering backlog (out of Phase 17 scope)

These require code but are **not** blockers for 5-order pilot if policy enforced:

| Item | Class today | Target |
|------|-------------|--------|
| `FinanceReleaseBoard` | A | Remove writes or read-only |
| `AdminFinance` | A | Route through 4C |
| `factory_inventory` writers | A | Lineage or freeze |
| WhatsApp webhook status | A | Policy + later guard |
| CI grep `dispatched` writes | — | Prevent regression |

---

## 10. Summary counts

| Class | Route entries (approx.) |
|-------|-------------------------|
| **C** | 6 governance + read-only intelligence + security gate † |
| **B** | ~15 legacy operational routes |
| **A** | 3 admin finance surfaces + 2 edge functions + factory floor |

---

*End of legacy write lockdown audit.*
