# Point 55 — Central published-product operational projection audit

**Workstation:** Central Point 55 (immutable original scope)  
**Dependency:** Core Point 54 read contract (`published_products_v1()`) — evidence-backed complete  
**Census head:** `ace340fe` (rebased onto `main` after #483 merge)  
**Verdict:** Point 55 **implementation complete** at `fb22f52f`. **Runtime validation complete** at `2c0d9d79`. Evidence ledger updates are docs-only (no runtime delta). Programme clearance **NOT CLEARED** (`PR MERGED ≠ STAGE CLEARED`). No shadow publication table. No Buyer Point 56 scope absorbed.

## Consumer census

| Surface | Prior read path | Point 55 treatment |
|---|---|---|
| `/admin/catalogue-sync` (`AdminCatalogueSyncStatus`) | `catalogue_product_mappings` + direct `products` name lookup | **Replaced publication inference** with Core `published_products_v1()` via `fetchPublishedOperationalProducts` |
| `/admin/products` (`AdminProducts`) | Full operational CRUD on `products` | **Preserved** — governed operational master + explicit overrides remain Central-owned |
| `/admin/catalogue-approvals` (`ApprovalInbox`) | AI Studio approval inbox | **Preserved** — authoring/approval authority unchanged |
| Catalogue connector (`src/lib/catalogue-connector/*`) | Approved snapshot intake → `products` + mappings | **Preserved** — connector writes operational master truth; does not auto-publish |
| Buyer surfaces (`BuyerApp`, `useProducts`, `customerAppClient`) | Mixed legacy/direct reads | **Out of scope** — Point 56 customer-safe publish lane |
| WhatsApp / product intelligence / merchandising | Operational `products` reads for resolution/sorting | **Preserved** — not publication-status consumers |

## Canonical read contract

Central publication status now reads exclusively through:

```typescript
supabase.rpc("published_products_v1")
```

Typed in `src/integrations/supabase/database.types.ts` and wrapped by `src/lib/published-products/publishedProductsClient.ts`.

Core publishability gate (conjunctive, enforced in RPC only):

- `is_active = true`
- `visible_in_catalog = true`
- `is_catalogue_ready = true`
- non-empty SKU and product name

Unpublished, rejected, draft-only, or partially gated products **cannot** appear in the operational projection index.

## Implementation delta

1. Added `src/lib/published-products/` client + deterministic mapper + tests.
2. Updated `/admin/catalogue-sync` to show publication status from the projection and removed stale `products` name lookup used as a publication proxy.
3. Added surface guard tests preventing catalogue-sync from reintroducing direct publication-gate reads on `products`.

## Boundaries preserved

- No Supabase migration SQL in Central.
- No duplicate publication table or shadow RPC.
- No Buyer Point 56 catalogue/price binding changes.
- AI Studio approval/authoring authority unchanged.

## Verification commands

```bash
npm run typecheck
npm run test -- src/lib/published-products
npm run build
npm run check:boundaries
npm run test:release-controller
```

## Exact-head gate ledger

Rebased onto `origin/main` at `ace340fe` (#483 merge). **No runtime delta** since `fb22f52f`; evidence doc updates are docs-only.

### Local validation (PASS)

| Gate | Result | Evidence |
|---|---|---|
| Local typecheck | PASS | `npm run typecheck` |
| Focused Point 55 tests | PASS (8) | `npm run test -- src/lib/published-products` |
| Production build | PASS | `npm run build` |
| Repo ownership boundaries | PASS | `npm run check:boundaries` |
| Release controller policy | PASS | `npm run test:release-controller` |

### Runtime validation — commit-scoped CI (PASS at `2c0d9d79`)

| Gate | Scope | Result | Evidence |
|---|---|---|---|
| Release Quality Gate | commit | PASS | [run 33989614451](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33989614451) @ `2c0d9d79` |
| Repo ownership boundaries (CI) | commit | PASS | [run 33989614456](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33989614456) @ `2c0d9d79` |
| CodeQL | commit | PASS | [run 101369447020](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/runs/101369447020) @ `2c0d9d79` |
| Codacy | commit | PASS | [PR #484](https://app.codacy.com/gh/oasisbaklawa2006/Oasis-Baklawa-Central/pull-requests/484) @ `2c0d9d79` |
| Vercel preview | commit | PASS | [deployment](https://vercel.com/oasisbaklawa2006-6222s-projects/oasis-baklawa-central/12bMoQownU75oMMa3ZYkikFRxsw8) @ `2c0d9d79` |

### Runtime validation — PR-scoped review gates (PASS; status bound to `2c0d9d79`)

| Gate | Scope | Result | Evidence |
|---|---|---|---|
| Snyk | PR-level URL | PASS | [PR check](https://app.snyk.io/org/oasisbaklawa2006/pr-checks/f449436e-9621-47f8-9dc9-f794d119c830); commit status on `2c0d9d79` |
| CodeRabbit | PR-level | PASS | Review completed; commit status on `2c0d9d79` |

### Docs-only exact-head validation — commit-scoped CI (PASS at `0af9797b`)

| Gate | Scope | Result | Evidence |
|---|---|---|---|
| Release Quality Gate | commit | PASS | [run 33992386770](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33992386770) @ `0af9797b` |
| Repo ownership boundaries (CI) | commit | PASS | [run 33992386744](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33992386744) @ `0af9797b` |
| CodeQL | commit | PASS | [run 101376868285](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/runs/101376868285) @ `0af9797b` |
| Codacy | commit | PASS | [PR #484](https://app.codacy.com/gh/oasisbaklawa2006/Oasis-Baklawa-Central/pull-requests/484) @ `0af9797b` |
| Vercel preview | commit | PASS | [deployment](https://vercel.com/oasisbaklawa2006-6222s-projects/oasis-baklawa-central/37uGrks8s8TMSR93MWToJSsqHotH) @ `0af9797b` |

### Docs-only exact-head validation — PR-scoped review gates (PASS; status bound to `0af9797b`)

| Gate | Scope | Result | Evidence |
|---|---|---|---|
| Snyk | PR-level URL | PASS | [PR check](https://app.snyk.io/org/oasisbaklawa2006/pr-checks/95f4c8f7-5ca2-4e2a-9a53-2b6a99366ce8); commit status on `0af9797b` |
| CodeRabbit | PR-level | PASS | Finding resolved; commit status on `0af9797b` |

**Commit-scoped checks: PASS at runtime head `2c0d9d79` and docs head `0af9797b`. PR-scoped Snyk/CodeRabbit: PASS with commit status on each head (excluded from commit-scoped count).**

**Prior head `bdc37771` collaborator approval is invalidated by rebase.** Fresh approval required on each subsequent head change.

## Programme clearance handoff

| Item | Status |
|---|---|
| Point 55 implementation (Central software delta) | **COMPLETE** at `fb22f52f` (rebased onto `ace340fe`) |
| Point 55 runtime validation (local + CI/review) | **COMPLETE** at `2c0d9d79` |
| Point 55 docs remediation + exact-head validation | **COMPLETE** (docs-only; commit-scoped + PR-scoped gates recorded) |
| PR merge | **BLOCKED** — fresh collaborator approval required on current head |
| Point 55 programme strike (#459) | **NOT CLEARED** — `PR MERGED ≠ STAGE CLEARED` |
| Runtime / physical UAT (#462) | **NOT STARTED** — return to Mission Control for operator evidence |

## Stop condition

Implementation complete at `fb22f52f`; runtime validation complete at `2c0d9d79`; evidence ledger current. **Do not merge** until fresh collaborator approval on current head. `PR MERGED ≠ STAGE CLEARED`.
