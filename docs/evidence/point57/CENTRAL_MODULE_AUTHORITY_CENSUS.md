# Point 57 — Central Module Authority Census

**ASM:** POINT57 — Central canonical module audit closure  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Base:** `main` @ `64a107df` (2026-09-06)  
**Machine-readable authority:** `src/lib/appverse/centralAdminModuleAuthorityMatrix.ts`  
**Enforcement tests:** `src/lib/appverse/__tests__/centralAdminModuleAuthorityMatrix.test.ts`

---

## 1. Mounted route census (96 component routes + 14 redirects)

| Surface | Count | Guard layer | Module gate |
|---------|------:|-------------|-------------|
| Central `/admin/*` | 79 component + 13 redirect | `ADMIN_STAFF_ROLES` → `AdminRouteGuard` (`routeAccess.ts`) | Per-route `AppVerseModuleKey` |
| Factory TV `/tv/*` | 7 component + 1 redirect | Per-route `RoleProtectedRoute` | Role list (no module map) |
| Operations handheld | 1 | `ADMIN_STAFF_ROLES` | None |
| Security gate | 1 | `SECURITY_GATE_ALLOWED_ROLES` | None |
| Sales console | 2 | `SALES_DASHBOARD_ROLES` / `SALES_EXECUTIVE` | None |
| Auth / buyer legacy | 7 | Mixed | None |

Full per-route owner, read/write authority, disposition, and programme tag: see typed matrix.

---

## 2. Role / module gate

**Canonical RBAC map:** `src/lib/appverse/roleAccess.ts` (`ROLE_MODULE_ACCESS`)

**Direct-route guard:** `AdminRouteGuard` → `isAuthorizedForAdminPath()` in `routeAccess.ts`

**Router-level guard:** `AdminModuleRoute` (narrower wrapper on selected routes)

**Nav visibility:** `AdminLayout` filters `navSections` by `hasModuleAccess(getAllowedModulesForRole(role), moduleKey)`

**Legacy drift removed:** `adminModuleAccess.ts` now re-exports `roleAccess.ts` (was a stale duplicate).

---

## 3. Read vs write authority (summary)

| Domain | Canonical routes | Read | Write | Core dependency |
|--------|------------------|------|-------|-----------------|
| Orders | `/admin/order-management`, legacy `/admin/orders` | Supabase | RPC + table writes | Core `orders` / governed RPCs |
| Finance | `/admin/finance`, `/admin/accounts-release`, governance boards | Supabase | RPC (governance) / table (legacy) | Core finance tables + RPCs |
| WhatsApp | `/admin/operator-inbox` | Supabase + realtime | Edge functions | Core WA tables |
| Dispatch workflow | `/admin/dispatch-mgmt`, readiness/completion/finalization | Supabase | `b2b_dispatch_*` RPC chain | Core dispatch RPCs (#456 lane) |
| Inventory / RGS | `/admin/ready-goods*`, ICC, 3PGS | Supabase | RPC | Core inventory / RGS |
| Trace context | `/admin/carton-explorer`, `/admin/scan-timeline`, labels | Mixed / preview | Limited | Trace app is authority; Central shows context only |
| CMD / preview | `execution-command-center`, `queue-execution-preview`, etc. | Local / dead `operational_queue_items` | None | Point 58 demo removal |

---

## 4. Duplicate / legacy / preview / shadow findings

| Finding | Routes | Programme owner |
|---------|--------|-----------------|
| Legacy redirects (dead execution boards) | `/admin/execution/production` → `/operations-controller`, etc. | Factory ops (merged) |
| Compatibility aliases | `/admin/whatsapp`, `/admin/dispatch`, `/admin/customers`, … | Point 57 (documented) |
| Preview / demo surfaces | `execution-command-center`, `*-preview`, `product-intelligence-prototype` | **Point 58** |
| Unnavigated specialist routes | `/admin/sales-hub`, `/admin/finance-board`, TV admin paths | Point 57 census only |
| Buyer legacy in Central | `/buyer/*` | Buyer App (Expo) — out of Central scope |
| `adminModuleAccess` shadow map | Was duplicate of `roleAccess` | **Point 57 fixed** (re-export) |
| Dashboard fallback gaps | `/admin/3pcs-store`, `/admin/sales-hub` had no `routeAccess` prefix | **Point 57 fixed** |

---

## 5. Deferred collisions (not fixed in Point 57)

| Route | Collision | Owner |
|-------|-----------|-------|
| `/admin/dispatch-mgmt` | `AdminRouteGuard` → `packing`; `AdminModuleRoute` → `dispatch` | **Dispatch P0 #456** |
| `/admin/ready-goods-day-close`, `/admin/ready-goods-reports` | Nav `inventory_audit` filter vs route guard `inventory` | Documented divergence |
| `/admin/order-management?view=*` | Nav view moduleKeys vs route guard `orders` | Intentional view gating |

---

## 6. Programme routing (what belongs where)

| Item | Point |
|------|-------|
| Module census, matrix, reconciliation tests, unmapped route guard fix, nav duplicate fix, `adminModuleAccess` dedup | **57** |
| Demo/preview surface removal (`execution-command-center`, `*-preview`, PI prototype) | **58** |
| Customer360 / CRM depth (`/admin/clients`, sales surfaces) | **59** |
| Order pool / central pool consolidation | **71** |
| Full RBAC cross-app parity | **18** |
| Dispatch-mgmt dual authority resolution | **#456** |

---

## 7. Gate state

| Gate | State |
|------|-------|
| Module authority matrix committed | **YES** |
| Registry/routes/nav/authority tests | **YES** |
| Point 57 minimal route corrections | **YES** (`3pcs-store`, `sales-hub`, nav `dispatch-mgmt` dedup) |
| Typecheck / unit tests / build | Pending CI on PR |
| Point 57 programme CLEARED | **NOT_CLEARED** — requires Mission Control runtime reconciliation |

`PR MERGED != Point 57 cleared`
