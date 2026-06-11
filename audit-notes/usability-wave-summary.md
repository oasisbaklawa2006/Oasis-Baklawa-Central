# Customer Usability Stabilization Wave — 2026-06-11

Read-only audit + small UI/route fixes. No SQL, migrations, or production writes.

## Broken routes (client-side)

| Route | Before | After |
|-------|--------|-------|
| `/admin/customers` | In-app 404 | Redirect → `/admin/clients` |
| `/admin/assembly` | In-app 404 | Redirect → `/admin/assembly-tasks` |
| `/admin/finance/payments` | In-app 404 | Redirect → `/admin/finance` |
| `/admin/finance/invoices` | In-app 404 | Redirect → `/admin/finance` |
| `/admin/crm` | In-app 404 | Redirect → `/admin/clients` |
| `/admin/roles` | In-app 404 | Redirect → `/admin/users` |

All 107 declared `App.tsx` routes return SPA shell (HTTP 200). Ghost routes above were the only client-side 404s found in Playwright smoke.

## Operator usability score: **7.5 / 10**

| Area | Status |
|------|--------|
| WhatsApp Inbox (`/admin/operator-inbox`, `/admin/whatsapp`) | Loads; uses `whatsapp_message_packets` + read-only panels |
| Product Resolver panel | Already wired (`OperatorInboxProductResolutionPanel`) — read-only, not persisted |
| Client / quantity / draft panels | Present; governance actions disabled per Stage-1 guard |
| Product Intelligence lab | Route works; nav link added under Command |
| Stage-1 guard tests | 73/73 product-intelligence + resolver + inbox guard tests pass |

Deductions: inbox requires staff auth (not smoke-tested logged-in); product resolution depends on upstream client identity + live `products`/`product_aliases` reads.

## Customer catalogue usability score: **4 / 10**

From `BATCH001_LIVE_HEALTH_SNAPSHOT` (Central read-only audit 2026-06-09):

- **25/25** Batch 001 SKUs: `visible_in_catalog = false` (hidden from buyer browse)
- **25/25** missing `image_url` (placeholder package icon only)
- **8/25** zero approved `product_aliases` rows (Wave 2C gap SKUs)
- Batch health average ≈ **57%** (HSN/GST + UOM present; media + search visibility fail for all)

Public product deep links (`/product/{uuid}`) are structurally valid for all 25 Batch 001 IDs in manifest; buyers hit auth gate before catalogue.

**UI fix applied:** `useProducts` now filters `is_active` + `visible_in_catalog` so internal/hidden SKUs do not leak into buyer catalogue components when RLS returns them.

## Fixes made

1. Legacy admin route redirects (6 ghost paths → real modules)
2. Admin nav: **Product intelligence lab** under Command (cmd_war_room module)
3. Buyer `useProducts`: filter inactive / not-visible-in-catalog products
4. Added `scripts/usability-wave-audit.mjs` + `tests/usability-wave-smoke.spec.ts` for repeat audits

## Remaining blockers (not in scope — need data/backend)

- Batch 001 not buyer-visible until `visible_in_catalog` promotion (data)
- All Batch 001 product images missing (merchandising / import)
- 8 Wave 2C SKUs need alias coverage for WhatsApp resolver
- Anon Supabase key cannot read `products` (RLS) — live catalogue audit needs authenticated session
- Product Intelligence lab catalog load requires staff session + `product_aliases` SELECT
