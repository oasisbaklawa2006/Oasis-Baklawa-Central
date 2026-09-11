# Point 58 — Demo / Preview Authority Census & Quarantine

**ASM:** POINT58 — remove / quarantine demo and preview authority from Central  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Base ancestry:** Central `main` @ `0f0f36ff04c8680eae09a401dece0b8af48b2a3f`  
**Machine-readable quarantine:** `src/lib/appverse/demoAuthorityQuarantine.ts`  
**Enforcement tests:** `src/lib/appverse/__tests__/demoAuthorityQuarantine.test.ts`, `src/__tests__/App.demoAuthorityQuarantine.test.tsx`

---

## 1. Starting SHA / ancestry

| Item | Value |
|------|-------|
| Main base (current) | `0f0f36ff04c8680eae09a401dece0b8af48b2a3f` |
| Preserved authorities | Point57 matrix, Point59/61 CRM, Management CMD (#554), Central Order Pool, Dispatch #497/#569, Security Gate |
| Point58 scope | 11-route demo/preview quarantine only — no absorption of other programme lanes |

---

## 2. Quarantined routes (11)

| Route | Canonical live redirect |
|-------|-------------------------|
| `/admin/execution-command-center` | `/admin/live-work-queues` |
| `/admin/execution-risk` | `/admin/exceptions` |
| `/admin/execution-bottlenecks` | `/admin/live-work-queues` |
| `/admin/queue-execution-preview` | `/admin/live-work-queues` |
| `/admin/barcode-execution-preview` | `/admin/golden-chain-operator` |
| `/admin/product-intelligence-prototype` | `/admin/products` (prod); dev-only banner |
| `/admin/execution/retail` | `/admin/store-coordination` |
| `/admin/execution/complaints` | `/admin/support` |
| `/admin/inventory-command-center` | `/admin/ready-goods` |
| `/admin/inventory-risk-board` | `/admin/inventory` |
| `/admin/verification` | `/admin/live-work-queues` |

---

## 3. Gate state

| Gate | State |
|------|-------|
| Rebased onto current main | **YES** |
| Merge conflict markers removed | **YES** |
| Quarantine registry reconciled | **YES** |
| Independent merge approval | **PENDING — STOP before merge** |
| Point 58 programme CLEARED | **NOT_CLEARED** |

`PR MERGED != Point 58 cleared` — software evidence only; no runtime/physical PASS inferred.
