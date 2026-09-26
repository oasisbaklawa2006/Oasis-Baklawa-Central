# INTERNAL ROLE JOURNEY MATRIX

**Scope:** Journey B — internal-staff login → identity/role resolution → landing surface → work queue → allowed/prohibited action → handoff → notification/escalation → audit → completion → logout/session recovery, for SUPER_ADMIN, ADMIN, FINANCE_HEAD, FINANCE_EXEC, SALES, OPERATIONS, PRODUCTION (RGS), STORE, PACKING (3PGS/PNA), DISPATCH, SUPPORT, TV/kiosk roles.
**Repos:** `oasisbaklawa2006/Oasis-Baklawa-Central`, `oasisbaklawa2006/oasis-supabase-core`. Both `main`.
**Note:** First-pass, evidence-anchored skeleton, not an exhaustive per-role RPC-by-RPC trace (11+ roles across two massive codebases). Depth varies by role as noted per section.

---

## SHARED PLUMBING (applies to every role)

| Stage | Evidence |
|---|---|
| Login entry | `src/pages/StaffLogin.tsx` (route `/staff/login`). Email+password (`signInWithPassword`) + magic-link branch. On success calls `redirectAfterAuth(..., requiredMembership: "staff")` (`src/lib/auth-flow.ts`) |
| Identity resolution | `auth-flow.ts::resolveUserByIdentifier` → `completeAuthLogin`: resolves `public.users` by identifier cross-checked against `auth.uid()`; fetches `profiles`; calls `fetchAuthRoleRecord()` (`auth-routing.ts`) → RPC `get_user_role(_user_id)` with `profiles.role`/`users.role` as fallback — **server RPC role wins over client-read columns** |
| Fast-path staff check | RPC `is_internal_staff(_user_id)` |
| Membership gate | `assertMembership(role, "staff")` fails closed (`STAFF_MEMBERSHIP_REQUIRED`) if role not in `STAFF_ROLES` (built from `STAFF_ROLE_DESTINATIONS` keys) — a buyer role can never land in `/admin/*` via this path. **PROVEN** |
| `get_user_role(uuid)` | Canonical body lives in squashed baseline `20260723161256_legacy_role_authority_baseline.sql` — **exact SQL body not independently read this pass** (existence + 30+ call sites confirmed, e.g. `20260903193000_dispatch_direct_write_rls_hardening.sql`, `20260907140000_macro_finance_runtime_authority.sql`, `20260830143700_gate_dispatch_proof_authority.sql`) |
| `is_internal_staff(uuid)` | Confirmed present in `20260803194123_phase2_inventory_authority_role_parity.sql`, re-created in `20260914123000_auth01_b2b_approval_mobile_identity_stability.sql`; both `SECURITY DEFINER`, `REVOKE ALL FROM public, anon` + `GRANT EXECUTE TO authenticated, service_role`; widely used as RLS gate (dozens of policies). **This is genuine server-side authority, not just a frontend check — PROVEN** |
| Role→route map | `src/lib/auth-routing.ts::STAFF_ROLE_DESTINATIONS` — hardcoded dict, comment states "NEVER falls back to /admin for unknown roles"; unresolved roles land on `/customer-app-redirect`. Router gate: `RoleProtectedRoute allowedRoles=...` + per-page `AdminModuleRoute moduleKey="..."` which additionally consults `getAllowedModulesForRole(role)` (`src/lib/appverse/roleAccess.ts` — internals **not opened**, call sites confirmed) |
| Logout / session expiry | **NOT traced this pass.** Only saw `signOutAndClearSession` imported in `StaffLogin.tsx` for auth-failure cleanup, not confirmed as the primary logout flow. **UNPROVEN / NOT FOUND** |
| Audit ledger | `audit_logs` inserts confirmed in multiple RPCs (e.g. dispatch-gate `CARTON_GATE_RELEASED`); `20260723151025_point20_operational_event_ledger.sql` exists (name implies operational event ledger — content **not opened**, existence + `audit_logs` writes confirm *some* audit trail exists for dispatch-gate/finance-exit actions at least). `src/pages/admin/AdminAudit.tsx` exists (route `/admin/audit`, generic staff gate — not confirmed to filter by role). **PARTIALLY PROVEN** |

---

## PER-ROLE FINDINGS

### SUPER_ADMIN / ADMIN / OWNER

- Destination: `/admin/cmd-war-room`, which redirects (`<Navigate>`) to `/admin/central-pool` → `CentralOrderPoolCommandCentre.tsx`, gated by `AdminModuleRoute moduleKey="orders"` + extra `canAccessCentralOrderPool(role)` check.
- Present in `ADMIN_ONLY_ROLES`, `ADMIN_STAFF_ROLES`, `SALES_DASHBOARD_ROLES`, `SECURITY_GATE_ALLOWED_ROLES`, and every TV route's allow-list — can reach essentially every surface (god-role design, by intent).
- Work queue / example RPC: **not traced** (`CentralOrderPoolCommandCentre.tsx` not opened). **UNPROVEN (routing only)**.
- **Classification:** routing **PROVEN**; RLS parity **PARTIALLY PROVEN** (role literals appear consistently across cited RLS policies).

### FINANCE_HEAD / FINANCE_EXEC (FINANCE_AUDITOR also mapped)

- Destination: `/admin/accounts-release` → `AdminAccountsRelease.tsx`, gated by `AdminModuleRoute moduleKey="accounts"`. **Fully wired, evidence-driven UI** — read in full.
- Queue = the `orders` list itself (no separate count badge) — **no count/list mismatch risk here**, unlike the Support-queue pattern found elsewhere. **PROVEN clean**.
- Allowed actions map 1:1 to real RPCs via `financeExitAuthorityClient.ts`/`finalPaymentPiAuthorityClient.ts` — buttons correctly disabled pending prerequisite facts (e.g. "Issue final invoice" disabled unless `settled===true`); no dead-onClick found.
- Backend authority: `assert_order_transition_role('gate_release'/'mark_packed_ready'/'record_full_payment'/'finance_review')` role-gates to `FINANCE_HEAD, FINANCE_EXEC, ADMIN, SUPER_ADMIN, OWNER` (`20260809060000_wave1b_server_authority_foundation.sql`); AAL2 enforced for clearance. **PROVEN** — matching RLS/RPC authority, not UI-only.
- Explicit prohibited-action boundary stated in UI banner: "does not create shipment records or cartons... mutate wallet balances... process complaints." Handoff to Security/Dispatch gate (`/security-gate`, `AdminSecurityGate.tsx`).
- **Did not verify** whether FINANCE_HEAD and FINANCE_EXEC are functionally distinct beyond title — no RLS policy found splitting authority between them. **UNPROVEN** whether the two roles differ in practice.

### SALES_EXECUTIVE (ADMIN_SALES / "SALES")

- Destination: `/sales/dashboard` → `SalesDashboard.tsx` (top-level, not under `/admin`), gated by `SALES_DASHBOARD_ROLES = [SUPER_ADMIN, ADMIN, SALES_EXECUTIVE]`.
- Queue = `companies` filtered by `account_manager_id=user.id AND status='approved'`. KPI cards derived via `useMemo` **from the same fetched state that renders the table** — no count/list divergence risk (same good pattern as Finance). Retry logic generation-counter-guarded against races.
- **DEFECT (inconsistency):** `/sales/3pgs-visibility` is restricted to `["SALES_EXECUTIVE"]` only — **excludes ADMIN/SUPER_ADMIN**, unlike every sibling route in the app. An ADMIN debugging this screen would be denied. Low severity, but a genuine inconsistency in an otherwise-uniform "ADMIN can reach everything" design. See JOURNEY_FAILURE_LEDGER FL-ROLE-02.
- **DEFECT (orphaned role):** RLS in `20260802160306_sales_relationship_foundation.sql` ("Approvers manage sales requests") and `20260802160315_sales_department_completion.sql` ("Managers manage relationships") gate manager-only actions to `get_user_role(auth.uid()) IN ('ADMIN','SUPER_ADMIN','SALES_MANAGER')`. **`SALES_MANAGER` has DB-recognized authority but is absent from `STAFF_ROLE_DESTINATIONS`/`ADMIN_STAFF_ROLES` in the frontend** — an account with this role would pass the RLS check but has no login destination and is rejected at `/staff/login` (`STAFF_MEMBERSHIP_REQUIRED`). **A real orphaned role: DB authority with no reachable UI.** See JOURNEY_FAILURE_LEDGER FL-ROLE-01.

### OPERATIONS (OPERATIONS_MANAGER)

- Destination: `/operations-controller` (top-level, not `/admin`), gated by `OPERATIONS_CONTROLLER_ROLES = ADMIN_STAFF_ROLES minus [DISPATCH_MANAGER, DISPATCH_INCHARGE, DISPATCH_HEAD, PACKING_SUPERVISOR]` (comment: "Dispatch/packing floor roles must not access the production handheld war room by URL").
- Queue counts derived from the **same in-memory `jobs` array** that renders the list — no divergence risk.
- **Self-documented historical defect (now fixed):** `auth-routing.ts` comment explicitly records that HOD_*/PRODUCTION_MANAGER roles used to land on `/admin/production` (a desktop console) despite the code's own comment calling for "handheld execution" — fixed to route to `/operations-controller`. A confirmed, self-documented instance of the exact "wrong dashboard for a role" defect class, now remediated.

### PRODUCTION (RGS — "Ready Goods Store"/production taxonomy)

- Confirmed naming: RGS ≠ Retail/Garment/Store; it is the Ready-Goods-Store/production-department vocabulary (`HOD_ARABIC`, `HOD_CHOCOLATE`, `PROD_ARABIC_SWEETS`, etc.), per `20260817090000_rgs_department_taxonomy.sql`, `20260818090000_rgs_six_tv_department_correction.sql`, and frontend pages `RgsDayClose.tsx`, `RgsReports.tsx`, `RgsStockPosition.tsx`, `RgsProductionDemandPlanner.tsx`.
- HOD_* → `/operations-controller` (handheld); PROD_* → dedicated kiosk TVs (`/tv/arabic-sweets`, `/tv/chocolate` also serving HOD/PROD_DRAGEES, `/tv/fusion` also serving Dates, `/tv/bakery`, `/tv/nuts`). `HOD_ASSEMBLY` is the one carve-out, landing on `/admin/assembly-tasks` instead.
- **DEFECT — self-documented orphaned data (already remediated via redirect):** `App.tsx` documents that `execution/production`, `execution/assembly`, `execution/ready-goods` used to read `operational_queue_items`, a table the code comment states has "zero writers anywhere in oasis-supabase-core's migration history for every queue_type — confirmed dead data by direct inspection." All three routes now `<Navigate>` away to governed real surfaces. A directly-cited, self-documented "orphaned tasks/dead data with no UI path" finding, already fixed at the routing layer. See JOURNEY_FAILURE_LEDGER FL-ROLE-03 (tracked for verification the underlying dead table is fully retired, not just routed around).
- `/tv/dragees` → `<Navigate to="/tv/chocolate">` — deliberate legacy-bookmark redirect, not a defect.

### STORE (STORE_INCHARGE, STORE_READY_GOODS, RGS_ADMIN → `/admin/ready-goods`; STORE_3RD_PARTY → `/admin/3pgs-procurement-queue`)

- `STORE_3RD_PARTY`'s destination is explicitly commented as a deliberate correction ("R4: land the dedicated 3PGS operator on the governed priority/procurement/custody queue") — consistent with "wrong dashboard" having recurred and been fixed more than once.
- `/admin/3pgs-procurement-queue` is double-gated (`AdminModuleRoute moduleKey="inventory"` + `canAccessThreePgsOperator(role)`), with an explicit comment that 3PGS operator surfaces are intentionally narrower than the generic inventory module — a correct defense-in-depth pattern, evidence the team is actively closing the "RLS too broad relative to UI" gap class.

### PACKING (3PGS / PNA — confirmed distinct, not aliases)

- "3PGS" = Third-Party Goods Store/packing-material-and-fulfilment domain (`20260820100000_3pgs_governed_fulfilment_authority.sql`, `ThreePgsCommandCentre.tsx`, `ThreePgsProcurementQueueComposition.tsx`, `ThreePgsTV.tsx`). "PNA" = Packing & Assembly, a **separate** governed authority (`20260819120000_pna_assembly_job_governed_authority.sql`).
- **Possible landing-route mismatch:** `PACKING_SUPERVISOR`'s destination per `auth-routing.ts` is `/admin/dispatch-mgmt` — **not** a dedicated packing screen (`AdminPackingDispatch.tsx` or any PNA-specific screen). Not traced whether nav still exposes a packing screen to this role (login-destination ≠ only-reachable-route). **PARTIALLY PROVEN / flagged for follow-up**, not confirmed BROKEN.

### DISPATCH (DISPATCH_HEAD, DISPATCH_MANAGER, DISPATCH_INCHARGE → `/admin/dispatch-mgmt`)

- RLS hardening evidence: `20260903193000_dispatch_direct_write_rls_hardening.sql` explicitly excludes `SALES_EXECUTIVE` from a dispatch-write policy while allowing broader `is_internal_staff()` — a positive, more-specific-than-blanket hardening example.
- Gate-release RPCs write to `dispatch_gate_decisions`/`audit_logs` with `actor_role := get_user_role(auth.uid())` captured server-side (not client-supplied). **PROVEN** for this action.
- **DEFECT — self-documented, accepted-scope, not yet remediated:** `20260817150000_rgs_authority_hardening.sql`'s own header comment states several SECURITY DEFINER production-mutation RPCs are "authorised only via `is_internal_staff()` — any internal staff role, not just the job's own department — preserving the blanket-write authority this branch was built with." This is exactly the mission's requested defect class (RPC authorization broader than the UI implies — any staff role, not just Dispatch/Production, can call these RPCs directly). See JOURNEY_FAILURE_LEDGER FL-ROLE-04.

### SUPPORT (SUPPORT_EXECUTIVE → `/admin/support`, `AdminSupport.tsx`)

- Routing only traced in this pass; **full behavioral trace is in `SUPPORT_JOURNEY_MATRIX.md`**, which found the role's queue-visibility RLS is BROKEN (literal `role IN ('admin','super_admin')` instead of `is_internal_staff()` — see FL-SUP-01 in the failure ledger). Cross-reference, do not duplicate here.

### TV / kiosk roles (TV_DISPLAY, TV_ASSEMBLY, TV_READY, TV_3PGS)

- `TV_READY` → `/tv/rgs` (chrome-free kiosk). `TV_DISPLAY`/`TV_ASSEMBLY` still land on `/admin/cmd-war-room` because, per code comment, "both self-label as 'internal preview, not yet evidence-validated' — do not default-land any role there until that validation is done." **The codebase itself classifies these two as not-yet-proven** — directly supports a **PHYSICAL-UAT REQUIRED** classification for `TV_DISPLAY`/`TV_ASSEMBLY` dashboards.
- `is_internal_staff()` deliberately **excludes** TV identities (`20260826043000_factory_production_role_alias_parity.sql`: "does NOT classify tv_display/tv_ready/tv_assembly as internal staff: Lane 1 B1 device authority requires those TV identities to remain orthogonal to is_internal_staff()") — TV kiosk accounts are a separate authority track; do not assume the blanket staff RPC gates their reads.

---

## THE TWO PREVIOUSLY-KNOWN #462 DEFECT CLASSES — DIRECT ANSWER

**1. Select-dropdown-behind-Sheet on mobile:** Found and **already remediated with a regression test**. `src/pages/admin/AdminClients.tsx` (route `/admin/clients`, alias `/admin/approvals` — this is the exact screen #462 described) still nests `<Select>`/`<SelectContent>` inside `<Sheet>`/`<SheetContent>`, but a dedicated regression test now exists: `src/components/ui/__tests__/selectSheetStacking.test.tsx`. A repo-wide search for the `SheetContent...SelectContent` co-occurrence found **only this one file** — no other role's dashboard currently nests Select-in-Sheet. **Classification: BROKEN (historical) → FIXED, PROVEN by test.** Not exhaustively re-scanned across all ~90 `src/pages/admin/*.tsx` files — see JOURNEY_REPAIR_PLAN.md P3 tranche.

**2. Pending-count KPI vs actual list mismatch:** Also found and **already remediated** in the same file — `AdminClients.tsx` now sources KPI tiles from a decoupled `fetchClientGovernanceCounts()` helper, refreshed via `Promise.all([fetchApps(tab), refreshStableCounts()])` after every mutation (naming — `stableCounts`, `refreshAfterPipelineMutation` — strongly implies a deliberate fix). Cross-checked `SalesDashboard.tsx` and `OperationsController.tsx`: both derive badge counts from the **same** array that renders the list — no divergence risk. `AdminAccountsRelease.tsx` has no separate count badges at all. **No live recurrence found in the roles inspected this pass** — but **this exact defect class recurs independently in the Support ticket queue** (see SUPPORT_JOURNEY_MATRIX.md — three uncoordinated predicates over `support_tickets.status`), so the class is not eliminated system-wide, only fixed in the one screen it was originally found in.

---

## EXPLICIT GAPS / NOT COVERED THIS PASS

- `get_user_role`/`is_internal_staff` exact SQL bodies in the squashed baseline; `AdminAudit.tsx`; `DispatchManagement.tsx`; `ThirdPartyStore`/`ThirdPartyPackingMaterialCatalogue.tsx`; `src/lib/appverse/roleAccess.ts`; logout/session-expiry code; notification-outbox internals.
- FINANCE_HEAD vs FINANCE_EXEC functional differential — unverified.
- Nav-entry vs router-route reachability — only spot-checked, not exhaustive.
- Recommended follow-up passes: (a) DispatchManagement/PackingSupervisor screen mismatch, (b) SALES_MANAGER orphaned-role gap resolution, (c) logout/session-expiry flow, (d) exhaustive Select-in-Sheet/KPI-vs-list scan across all `src/pages/admin/*.tsx`.
