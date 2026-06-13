# Product Architecture Consolidation Audit

**Date:** 2026-06-13  
**Account:** `oasisbaklawa2006`  
**Method:** Read-only static analysis of both codebases + live schema inspection (read-only SQL on `tcxvcatsqqertcnycuop`). No code, migrations, or production writes.

## Repositories under account

| Repo | Role | Supabase project | Vercel |
|------|------|------------------|--------|
| `Oasis-Baklawa-Central` | B2B operations app (orders, dispatch, finance, buyer catalogue) | `tcxvcatsqqertcnycuop` (oasis-baklawa) | `cursor-central-vercel` |
| `oasis-ai-studio` | Internal PIM / catalogue builder / approvals | Same shared project | `oasis-ai-studio` |
| `oasis-b2b-simple` | Legacy B2B prototype | `ujvutydlqzlpamhlgjqg` (inactive) | Unknown |

**No separate label-maker or B2C repo exists.** Label workflows live inside Central (`LabelCommandCenter`) and AI Studio (`Labels`, `LabelQueue`).

---

## A. Central — Product Master & catalogue consumption

### Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/products` | `AdminProducts.tsx` | Master CRUD, BOM, variants, tags, AI helpers |
| `/admin/merchandising` | `AdminMerchandising.tsx` | Tag-based sort order |
| `/admin/catalogue-sync` | `AdminCatalogueSyncStatus.tsx` | Manual approved-snapshot JSON import |
| `/admin/catalogue-approvals` | `ApprovalInbox.tsx` | Tag/alias draft approve (C1a) |
| `/admin/pricing` | `AdminPricing.tsx` | Price matrix |
| `/admin/label-command-center` | `LabelCommandCenter.tsx` | Label JSON/ZPL preview |
| `/admin/product-intelligence-prototype` | `ProductIntelligencePrototype.tsx` | Resolver lab (module-gated) |
| `/admin/cmd-war-room` | `CMDWarRoom.tsx` | Alias drawer (operator shortcut) |
| `/catalogue`, `/product/:id` | Buyer-facing catalogue | Reads `products` |

### Key components

- `src/pages/admin/AdminProducts.tsx` — slide-out product panel (~1900 lines)
- `src/lib/adminProductFormMapping.ts` — numeric/form mapping
- `src/lib/productProductionDepartments.ts` — canonical `production_department`
- `src/lib/productAliasSuggestions.ts` — generic alias blocklist
- `src/lib/catalogue-connector/` — snapshot → `products` + `catalogue_product_mappings`
- `src/lib/catalogue-approval/` — tag/alias draft RPCs
- `src/lib/product-intelligence/` — read-only resolver prototype
- `src/lib/wa-governance/fetchProductResolution.ts` — WhatsApp inbox resolution
- `src/components/warroom/AliasDrawer.tsx` — direct alias write (bypasses draft queue)

### Tables used (product domain)

| Table | Usage |
|-------|--------|
| `products` | Master record (single `image_url`, `aliases[]`, pricing, compliance, unit math) |
| `product_aliases` | Normalized alias lookup |
| `product_bom` | BOM components |
| `product_variants` | Size/weight variants |
| `product_tags`, `product_tag_mapping` | Merchandising tags + manual sort |
| `catalogue_product_mappings` | External ID ↔ central product |
| `catalogue_tag_drafts`, `catalogue_alias_drafts` | Approval inbox (C1a) |
| `factory_inventory` | Stock overlay on buyer catalogue |

**Not on `products`:** multi-image gallery, typed hero/square/detail assets, `product_media` (AI Studio has this).

### RPCs

- `approve_catalogue_tag_draft`, `reject_catalogue_tag_draft`
- `approve_catalogue_alias_draft`, `reject_catalogue_alias_draft`
- `get_user_role`, `is_internal_staff`

Catalogue connector uses direct PostgREST upsert — no sync RPC.

### Storage

- `product-images` — hero upload from Admin Products

### Forms & fields (AdminProducts)

**Sections:** Identity & department lock, BOM, commercials/logistics, private label, food compliance, variants, intelligence/search.

**Notable fields:** `name`, `sku`, `category`, `sub_category`, `production_department`, `department`, `description`, `image_url`, `wholesale_price`, `mrp`, `uom`, `settlement_unit`, `grams_per_piece`, `weight_per_box_kg`, `primary_pack_weight_kg`, `packs_per_master_carton`, `hsn_code`, `gst_percentage`, `dietary_tags`, `nutrition_facts`, `allergen_warnings`, `ingredients`, `aliases[]`, `visible_in_catalog`, `is_active`, `barcode_sku`.

**Gaps:** `pcs_per_kg` / `pcs_per_primary_pack` in form mapping; live DB has columns with default `0` but types.ts may lag.

### Validation rules

- Required: name, wholesale_price, production_department (canonical snake_case)
- Active products: HSN, GST; KG settlement food families: grams_per_piece, weight_per_box_kg
- Alias suggestions: generic-term blocklist (`productAliasSuggestions.ts`)
- Nutrition: placeholder template requires QA/FSSAI review flag (no auto-truth from AI batch)

### Approval flows

1. **Catalogue connector** — approved JSON snapshot → `products` (manual pilot at `/admin/catalogue-sync`)
2. **Approval inbox** — `catalogue_*_drafts` → RPC → `product_tags` / `product_aliases`
3. **War Room** — direct write to `products.aliases` + `product_aliases` (ungoverned shortcut)

### Sync/export

- `ApprovedCatalogueProductSnapshot` type → `syncApprovedCatalogueProduct()` (one-way import into Central)
- Batch001 language-wave draft payloads (evidence JSON, not auto-approved)

### AI generators

| Generator | Mechanism | Notes |
|-----------|-----------|-------|
| Mock description | Client template | `handleAiDescription` |
| Compliance batch | Edge `generate-product-attributes` | Nutrition **excluded** from auto-apply |
| Placeholder nutrition | Local template | QA warning |
| AI aliases | Edge `oasis-ai-chat` SSE | Suggestions only; user applies before save |

### Image/media

- **Single** `products.image_url` + `product-images` bucket
- UI documents blocker for square/detail/packaging/lifestyle (no schema)

### Alias / WhatsApp

- `products.aliases[]` + `product_aliases` table (dual store)
- `banyan-parser.ts` (legacy) + `wa-governance` resolver (inbox)
- `product-intelligence` prototype (separate from WA path)

### Permissions

- `ADMIN_STAFF_ROLES` for `/admin/*`
- `products` module: `SUPER_ADMIN`, `ADMIN` only in nav
- `CATALOGUE_CONTRIBUTOR` lands on `/admin/products` but limited module map
- Catalogue approvals URL not module-gated (documented gap)

### Known bugs / risks

- Dual alias write paths (War Room vs approval inbox)
- Two resolver implementations (prototype vs WA governance)
- Batch001: 0/25 pilot-ready (images, visibility, aliases)
- Catalogue sync manual JSON only
- Single hero image; multi-asset catalogue blocked
- `production_department` constraint vs legacy labels (fixed in PR #197 branch)
- Edit panel reliability fixes in PR #198 branch

### Missing features (vs target PIM)

- Multi-image asset types with approval
- Contributor draft workflow on product master
- Product Truth readiness dashboard on edit screen
- Channel-specific MOQ/pricing rules UI
- Structured nutrition panels
- Live webhook sync from builder
- EAN generation workflow (only `barcode_sku` field)

---

## B. AI Studio — Catalogue / Product Builder

### Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/products`, `/products/:id` | Products, ProductEdit | List + comprehensive edit |
| `/media` | Media | `product_media` library |
| `/tags` | Tags | Tag vocabulary |
| `/catalogues`, `/catalogues/:id` | Legacy catalogues | Link products |
| `/admin/catalogue-builder` | CatalogueBuilder | Collections, PDF, WhatsApp export |
| `/approvals` | ApprovalInbox | 7 draft types |
| `/labels`, `/label-queue` | Labels, LabelQueue | Label studio + batch |
| `/ingredients` | Ingredients | Nutrition ingredients |
| `/admin/import/category-1` | Category1ImportStaging | CSV → drafts |
| `/ai-studio` | AIStudio | Roadmap placeholder only |
| `/c/:slug` | PublicCatalogue | Published catalogue view |

### Key components

- `ProductEdit.tsx` — tabbed master form (~90+ fields)
- `features/productTruth/` — 8-dimension readiness
- `features/catalogueSnapshot/` — versioned snapshots (preview)
- `features/catalogueDrafts/` — unified draft submission
- `features/productResolver/` — WhatsApp resolver prototype
- `features/productIntelligence/` — language/discoverability
- `features/compliance/ComplianceAiPanel.tsx` — AI compliance (not on ProductEdit compliance tab)
- `shared/auth/centralPermissions.ts` — `super_admin` / contributor gates

### Tables used

**In repo migrations:** `products`, `product_media`, `product_aliases`, `product_tags`, `tags`, `catalogues`, `catalogue_products`, `catalogue_collections`, `catalogue_collection_items`, `catalogue_versions`, `product_moq_rules`, `product_pricing_rules`, `ingredients`, `nutrition_panels`, `labels`, `hampers`, `import_logs`, `feature_flags`.

**Script-only on Central (PR06B):** `catalogue_product_drafts`, `catalogue_media_submissions`, `catalogue_alias_drafts`, `catalogue_bom_drafts`, `catalogue_moq_drafts`, `catalogue_pricing_drafts`, `catalogue_tag_drafts`, `catalogue_approval_audit`.

### RPCs

- `search_products_with_aliases`, `generate_oasis_sku`, `get_public_catalogue_channel_data`
- `get_my_role_keys`, `has_catalogue_permission`, `is_catalogue_reviewer`
- `approve_catalogue_*_draft` / `reject_*` (7 types — some stubs on Central)

### Storage

- `product-media`, `generated-media`, `label-assets`

### Forms & tabs (ProductEdit)

Identity, UOM/MOQ, Media, Private Label, Customisation, Dimensions, Frozen, BOM, Business Rules (channel MOQ/pricing), Compliance, Ops Notes, Product Truth.

Maps `hero_image_url` ↔ `products.image_url` on save.

### Validation

- `validate_product_department` trigger
- Product Truth readiness engines (UOM, packaging, channel rules, media)
- Compliance strip on direct save (`stripUnapprovedComplianceFields`)
- Contributor → draft only (no master write)

### Approval flows

Contributor submits → `catalogue_*_drafts` → ApprovalInbox → approve RPC → master tables.

**Gap:** Some approve RPCs stubbed; alias approve mapping incomplete on Central.

### Sync/export

- `catalogueSnapshot` generates in-app snapshots + `catalogue_versions`
- Central sync preview (`centralSyncPreviewService`) — **preview only**, no live write
- Catalogue Builder PDF + WhatsApp text export

### AI generators

- Edge `generate-product-attributes` via `ComplianceAiPanel` (suggestion-only)
- `AliasManager` uses deterministic `SEED_RULES`, not live AI on all paths
- AI Studio route `/ai-studio` is static roadmap — no backend

### Image/media

- `product_media` table with `type`, `angle`, `status`, `file_url`
- `catalogue_media_submissions` for contributor staging
- Media readiness engine (`features/mediaReadiness/`)
- Supports hero + typed assets in UI; Central consumer still reads single `image_url`

### Permissions

- Dual: legacy `RoleGate` (`permissions.ts`) + Central RPC (`centralPermissions.ts`)
- **Only `super_admin`** can write master directly
- Contributors draft-only

### Known bugs / risks

- **Blank screen on deploy** — `COMPLIANCE_APPROVER` ReferenceError in `permissions.ts` (fix identified, not merged)
- Types.ts stale vs deployed Central schema
- `product_bom` vs `product_bom_items` naming drift
- Compliance AI panel not mounted on ProductEdit compliance tab
- Central sync preview-only
- localStorage fallbacks on catalogue collections (dev)

### Missing features

- Production deployment stability
- Live Central snapshot push
- Full EAN/barcode execution integration
- Product-specific nutrition AI (only placeholder/heuristic)
- Unified permission model (legacy + Central RPC)

---

## Cross-system duplication map

| Concern | Central | AI Studio | Risk |
|---------|---------|-----------|------|
| Product master edit | `AdminProducts` full CRUD | `ProductEdit` full tabs | **HIGH** — two masters |
| Aliases | Array + table + War Room | AliasManager + drafts | **HIGH** |
| Approvals | Tag/alias drafts only | 7 draft types | **MEDIUM** — partial overlap |
| Catalogue publish | Buyer `visible_in_catalog` | Builder collections + public slug | **MEDIUM** |
| Resolver | WA governance + prototype | Product resolver prototype | **MEDIUM** |
| Labels | Label command center (ZPL preview) | Labels + LabelQueue + nutrition_panels | **MEDIUM** |
| Media | Single `image_url` | `product_media` multi-type | **HIGH** — schema asymmetry |
| Sync | Imports snapshots | Exports previews | **HIGH** — no closed loop |

---

## Testing performed (read-only)

- GitHub repo enumeration via public API
- Static route/table/RPC grep across both repos
- Live schema column check: `products` media + unit math columns; `catalogue_media_submissions` exists; no `gallery_images` on `products`
- Prior CI evidence: Central typecheck/build pass on recent PR branches
- AI Studio: production blank screen confirmed via browser console (`COMPLIANCE_APPROVER`); local build passes after fix

**No production writes. No migrations applied.**
