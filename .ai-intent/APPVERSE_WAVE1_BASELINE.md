# App-Verse Wave 1 Baseline (Frozen)

Status: **FROZEN** — do not redesign or "recover" Wave 1 without evidence.

## Baseline identity

| Field | Value |
|---|---|
| Repository | `oasisbaklawa2006/Oasis-Baklawa-Central` |
| Branch | `main` |
| Commit | `6b18bc68e15ef469d9c240704dbfde0a15dbba10` |
| Merge PR | #324 (`feat(appverse): complete Wave 1 Home with launchpad integration`) |
| Frozen at (UTC) | 2026-08-03T09:14Z |
| Prior baseline commits | `8b8f89b2` (docs #320), `cdd13bb3` (implementation #322), `397c71fe` (shell #319) |

## Validation record (frozen)

Captured on commit `6b18bc68` at 2026-08-03T09:14Z:

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** (exit 0) |
| `npm test` | **PASS** — 231 files, 1323 tests |
| `npm run build` | **PASS** (Vite production build) |
| Release Quality Gate | **PASS** on PR #324 (run `30798406116`) |
| Repo Ownership Boundaries | **PASS** on PR #324 (run `30798406120`) |
| CodeQL | **PASS** on PR #324 |
| Vercel preview | **PASS** on PR #324 |

## What Wave 1 includes

Wave 1 is one tranche of the larger App-Verse programme. It delivers:

1. **Shell** — workspace rail, mobile nav (max 5 destinations), scoped theme, `All tools` compatibility drawer.
2. **Role-aware Home** — `roleHome.ts` cards filtered by module authority.
3. **Wave 1 launchpad** — three operational areas: Orders & Finance, Operations & Production, WhatsApp & Support.
4. **Admin Home composition** — `/admin` renders `AppverseAdminHome` (Home + launchpad + executive link + app registry + TV surfaces).
5. **Planning docs** — route disposition matrix, device surface matrix, priority UX spec, workspace completion blueprint.

Wave 1 does **not** include Stores/Inventory simplification, Dispatch/Trace chain unification, or **Governance management surfaces** (users, audit, settings drill-down). The Wave 1 shell includes a `governance` **workspace container** in navigation only; Wave 2 delivers the management-surface simplification inside that container.

## Protected implementation manifest

Changes to these files require baseline evidence (see Change policy below):

### Runtime

- `src/components/AdminLayout.tsx` — shell mount, `/admin` → `AppverseAdminHome`
- `src/pages/admin/AppverseAdminHome.tsx` — Home composition
- `src/components/appverse/AppverseRoleHome.tsx`
- `src/components/appverse/AppverseWave1Launchpad.tsx`
- `src/components/appverse/AppverseWorkspaceRail.tsx`
- `src/components/appverse/AppverseMobileNav.tsx`
- `src/lib/appverse/roleAccess.ts`
- `src/lib/appverse/roleHome.ts`
- `src/lib/appverse/workspaces.ts`
- `src/lib/appverse/wave1.ts`
- `src/lib/appverse/wave1Baseline.ts` — frozen invariant constants
- `src/lib/appverse/routeAccess.ts`
- `src/lib/appverse/appRegistry.ts`
- `src/lib/appverse/tvSurfaces.ts`
- `src/styles/appverse-theme.css`

### Tests (must stay green)

- `src/lib/appverse/wave1.test.ts`
- `src/lib/appverse/wave1Baseline.test.ts`
- `src/lib/appverse/roleHome.test.ts`
- `src/lib/appverse/roleAccess.test.ts`
- `src/lib/appverse/workspaces.test.ts`
- `src/lib/appverse/appRegistry.test.ts`

### Contracts (presentation authority)

- `.ai-intent/APPVERSE_WAVE1_UX_CONTRACT.md`
- `.ai-intent/APPVERSE_SHELL_INTEGRATION.md`
- `docs/frontend/APPVERSE_ROUTE_DISPOSITION_MATRIX.md`
- `docs/frontend/APPVERSE_DEVICE_SURFACE_MATRIX.md`
- `docs/frontend/APPVERSE_PRIORITY_WORKSPACE_UX_SPEC.md`
- `docs/frontend/APPVERSE_WORKSPACE_COMPLETION_BLUEPRINT.md`
- `docs/frontend/APPVERSE_BACKEND_FRONTEND_SYNC_CONTRACT.md`
- `.ai-intent/BACKEND_FRONTEND_MODULE_HANDOFF_TEMPLATE.md`

## Frozen behavioural invariants

**Encoded in `wave1Baseline.ts` and enforced by `wave1Baseline.test.ts`:**

- Exactly **3** Wave 1 launchpad areas with keys `orders-finance`, `operations-production`, `whatsapp-support`.
- Launchpad landing paths: `/admin/order-management`, `/admin/execution-command-center`, `/admin/operator-inbox`.
- Exactly **7** App-Verse workspace containers (including `governance` as a navigation container); Home anchored at `/admin`.

**Enforced by existing tests elsewhere (not duplicated in `wave1Baseline.test.ts`):**

- Module authority filtering must never expand permissions beyond `roleAccess.ts` — see `roleAccess.test.ts`, `roleHome.test.ts`, `workspaces.test.ts`.
- Compatibility route aliases remain registered in `App.tsx` — disposition matrix is authoritative; route removal requires disposition update and UAT.

## Change policy (mandatory)

**No agent or contributor may redesign, refactor, or "recover" Wave 1 unless they can cite one of:**

1. A **failing test** in the protected test manifest above (or a new regression test added with the fix).
2. A **missing route** registered in `App.tsx` that breaks direct-link or disposition-matrix contract.
3. A **broken contract** — explicit contradiction between implementation and `.ai-intent/APPVERSE_WAVE1_UX_CONTRACT.md` or route disposition matrix, with backend thread acknowledgement where authority is involved.
4. A **verified production defect** — reproducible on the current `main` deployment with console/network evidence.

If none of the above apply, the change is **out of scope** for Wave 1 and belongs in Wave 2+ as an additive extension.

## Wave extension rules (all future waves)

1. **Additive** — new files, new launchpad areas, new routes behind feature flags or new modules; do not remove Wave 1 surfaces without UAT sign-off.
2. **Reviewable** — each wave lands via PR with Release Quality Gate green; disposition matrix updated when routes change.
3. **Independently reversible** — wave-specific code lives in namespaced modules (e.g. `wave1.ts`, future `wave2.ts`); reverting a wave PR must not break shell or prior waves.
4. **Backend-first** — no Wave N UI freeze until the module handoff template is completed for that cluster.

## Wave 2 gate (not yet open)

Wave 2 implementation may begin only when **Stores/Inventory** backend contracts are reconciled and signed off.

Tracker: `docs/frontend/APPVERSE_WAVE2_STORES_INVENTORY_CONTRACT_RECONCILIATION.md`

Wave 2 clusters (after Stores/Inventory contracts stable):

- Stores / Inventory management surfaces
- Dispatch / Trace management surfaces (Wave 1 `trace-dispatch` container exists)
- Governance management surfaces (Wave 1 `governance` container exists)

Do not open Wave 2 coding until the Stores/Inventory reconciliation tracker shows **Ready** for inventory command center and store coordination.

## Baseline update procedure

When Wave 1 must legitimately change under the Change policy:

1. Open a PR citing the triggering evidence (test failure, defect, etc.).
2. Update `wave1Baseline.ts` commit hash and invariants if behaviour changes.
3. Re-run full validation and record results in this document.
4. Obtain review approval; merge only with Release Quality Gate green.
