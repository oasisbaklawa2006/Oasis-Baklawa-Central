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
```

## Stop condition

Software delta complete at branch head. Awaiting collaborator review/merge. `PR MERGED ≠ STAGE CLEARED`.
