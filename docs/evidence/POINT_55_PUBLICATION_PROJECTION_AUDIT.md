# Point 55 — Central published-product operational projection audit

**Workstation:** Central Point 55 (immutable original scope)  
**Dependency:** Core Point 54 read contract (`published_products_v1()`) — evidence-backed complete  
**Census head:** `main` at implementation time  
**Verdict:** Genuine Central delta implemented. No shadow publication table. No Buyer Point 56 scope absorbed.

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

## Exact-head gate ledger (`d1fb5422f53aa7138b74ff5cd40893f35c0cbcc9`)

Reconciled against `origin/main` at `08ccb1cf` — branch is **1 commit ahead, 0 behind** (no merge conflict).

| Gate | Result | Evidence |
|---|---|---|
| Local typecheck | PASS | `npm run typecheck` |
| Focused Point 55 tests | PASS (8) | `npm run test -- src/lib/published-products` |
| Production build | PASS | `npm run build` |
| Repo ownership boundaries | PASS | `npm run check:boundaries` |
| Release controller policy | PASS | `npm run test:release-controller` |
| Release Quality Gate (CI) | PASS | [run 33981375893](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33981375893) |
| Repo ownership boundaries (CI) | PASS | [run 33981375921](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/33981375921) |
| CodeQL (`github-advanced-security` app) | PASS | [run 101347159064](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/runs/101347159064) |
| Codacy | PASS | [PR #484](https://app.codacy.com/gh/oasisbaklawa2006/Oasis-Baklawa-Central/pull-requests/484) |
| Snyk | PASS | [PR check](https://app.snyk.io/org/oasisbaklawa2006/pr-checks/5dc701ae-fd42-44e5-a516-7de428ce79dc) |
| Vercel preview | PASS | [deployment](https://vercel.com/oasisbaklawa2006-6222s-projects/oasis-baklawa-central/6hBRpQsHCByksXvyv2r7gWPvVVU5) |
| CodeRabbit | PASS (draft skip) | Promoted to Ready for Review to trigger full review |

### Infra-only non-blocker

The separate `github-advanced-security` **github-actions** workflow ("Code scanning AI findings") failed with `CAPIError: 400 The requested model is not supported` (`sweagent-capi:gpt-5.3-codex`). This is a GitHub Advanced Security AI-agent platform failure, **not** a Point 55 code defect. The programme-required **CodeQL** check from the `github-advanced-security` app passed.

## Programme clearance handoff

| Item | Status |
|---|---|
| Point 55 software delta (Central) | **COMPLETE** at `d1fb5422` |
| PR merge | Pending independent collaborator approval |
| Point 55 programme strike (#459) | **NOT CLEARED** — `PR MERGED ≠ STAGE CLEARED` |
| Runtime / physical UAT (#462) | **NOT STARTED** — return to Mission Control for operator evidence |

## Stop condition

Software delta complete at branch head. Promoted to Ready for Review for independent collaborator approval. `PR MERGED ≠ STAGE CLEARED`.
