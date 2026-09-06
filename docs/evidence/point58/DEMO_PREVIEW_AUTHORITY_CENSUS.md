# Point 58 — Demo / Preview Authority Census & Quarantine

**ASM:** POINT58 — remove / quarantine demo and preview authority from Central  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Base ancestry:** Point57 #499 head `6ffaa43babeed060ec9ccdcc567f8bff45347b94`  
**Merge order (dependent):** #497 Dispatch P0 → #499 Point57 → Point58  
**Machine-readable quarantine:** `src/lib/appverse/demoAuthorityQuarantine.ts`  
**Enforcement tests:** `src/lib/appverse/__tests__/demoAuthorityQuarantine.test.ts`, `src/__tests__/App.demoAuthorityQuarantine.test.tsx`

---

## 1. Starting SHA / ancestry

| Item | Value |
|------|-------|
| Point57 head (build base) | `6ffaa43babeed060ec9ccdcc567f8bff45347b94` |
| Point57 PR | #499 |
| Predecessor merge order | #497 → #499 → Point58 |
| Authority matrix source | `src/lib/appverse/centralAdminModuleAuthorityMatrix.ts` (Point57 census) |

---

## 2. Mounted demo / preview / prototype census (from Point57 matrix)

| Route | Label | Disposition (pre-58) | Read authority | Nav entry | Fallback / dead data risk | Point58 action |
|-------|-------|----------------------|----------------|-----------|---------------------------|----------------|
| `/admin/execution-command-center` | Execution CMD | PREVIEW | LOCAL (`operational_queue_items`) | Yes | Dead queue table; silent feed fallback removed | **QUARANTINE** → `/admin/live-work-queues` |
| `/admin/execution-risk` | Execution risk board | PREVIEW | LOCAL | No | Local projection only | **QUARANTINE** → `/admin/exceptions` |
| `/admin/execution-bottlenecks` | Execution bottlenecks | PREVIEW | LOCAL | No | Local projection only | **QUARANTINE** → `/admin/live-work-queues` |
| `/admin/queue-execution-preview` | Queue execution preview | PREVIEW | LOCAL | No | Preview writes blocked; local read | **QUARANTINE** → `/admin/live-work-queues` |
| `/admin/barcode-execution-preview` | Barcode execution preview | PREVIEW | LOCAL | No | No dispatch/stock mutation | **QUARANTINE** → `/admin/golden-chain-operator` |
| `/admin/product-intelligence-prototype` | Product intelligence lab | DEMO | LOCAL | Yes | AI Studio link-out only | **QUARANTINE** (prod redirect → `/admin/products`; dev-only banner) |
| `/admin/execution/retail` | Retail execution board | PREVIEW | LOCAL | Yes | `operational_queue_items` dead data | **QUARANTINE** → `/admin/store-coordination` |
| `/admin/execution/complaints` | Complaints execution board | PREVIEW | LOCAL | Yes | `operational_queue_items` dead data | **QUARANTINE** → `/admin/support` |
| `/admin/inventory-command-center` | Inventory command center | PREVIEW | MIXED | Yes | Partial local/mock projections | **QUARANTINE** → `/admin/ready-goods` |
| `/admin/inventory-risk-board` | Inventory risk board | PREVIEW | MIXED | Yes | Preview risk cards | **QUARANTINE** → `/admin/inventory` |
| `/admin/verification` | Verification bookmark | COMPATIBILITY_ALIAS | NONE | No | Redirected to dead CMD surface | **QUARANTINE** → `/admin/live-work-queues` |

### Deferred to other programme lanes (not Point58-owned)

| Route | Owner | Disposition | Notes |
|-------|-------|-------------|-------|
| `/admin/customer-timeline-preview` | POINT59 | PREVIEW | Customer360 lane |
| `/admin/execution/third-party` | R4_3PGS | PREVIEW | Governed 3PGS queue retained |
| `/admin/carton-explorer` | TRACE | PREVIEW | Trace context only |
| `/admin/scan-timeline` | TRACE | PREVIEW | Trace context only |
| `/admin/assembly-tv` | FACTORY_OPS | PREVIEW | Internal TV preview banner |
| `/admin/dispatch-tv` | DISPATCH_P0_456 | PREVIEW | Dispatch P0 lane |

---

## 3. Silent fallback risks addressed

| Surface | Risk | Fix |
|---------|------|-----|
| `useExecutionCommandCenter` | On load error, built projection from empty queue + live feeds (masked unavailable authority) | Fail closed: `projection = null`, surface error |
| Root admin express gate | Landed on execution-command-center | Redirect to `/admin` |
| `roleHome` / `wave1` / workspaces | Default cards/landing on quarantined routes | Canonical live targets |
| Operational search deep links | Linked to preview routes | Canonical order/queue/scan/support paths |

---

## 4. Gate state

| Gate | State |
|------|-------|
| Demo census from Point57 matrix | **YES** |
| Quarantine registry + production redirects | **YES** |
| Nav exclusion regression tests | **YES** |
| Fail-closed on CMD load errors | **YES** |
| Dependent on #497 + #499 merge | **YES — draft / blocked** |
| Point 58 programme CLEARED | **NOT_CLEARED** — runtime reconciliation pending |

`PR MERGED != Point 58 cleared`
