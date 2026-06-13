# Central × AI Studio Feature Matrix

**Date:** 2026-06-13  
**Legend:** ✅ Strong | 🟡 Partial | ❌ Missing | 🔒 Blocked (schema/deploy)

| # | Feature | Central status | AI Studio status | Better implementation | Missing gaps | Future owner |
|---|---------|----------------|------------------|----------------------|--------------|--------------|
| 1 | Product identity | ✅ AdminProducts name/sku/category | ✅ ProductEdit Identity tab | **AI Studio** (tabs + truth) | Central lacks Product Truth panel on edit | **AI Studio** |
| 2 | SKU | ✅ Manual + auto from net weight | ✅ SkuBuilder + `generate_oasis_sku` RPC | **AI Studio** | Central has read-only SKU on edit | **AI Studio** |
| 3 | Category/subcategory | ✅ Dropdown constants | ✅ + product_class/type | Tie | Align category vocab | **AI Studio** (master) |
| 4 | HSN/GST | ✅ Form + AI batch (no nutrition) | ✅ Compliance tab + AI panel | **AI Studio** (approval strip) | Compliance panel not on ProductEdit tab | **AI Studio** |
| 5 | Production department | ✅ Canonical dropdown (PR #197) | ✅ main/production_department | **Central** (Factory TV routing) | AI Studio must use same canonical values | **AI Studio** writes; **Central** consumes for ops |
| 6 | Pack size | ✅ pack_size, carton_type | ✅ primary pack fields | **AI Studio** | — | **AI Studio** |
| 7 | Grams per piece | ✅ Unit math section | ✅ UOM tab | Tie (recent Central fixes) | Persist parity | **AI Studio** |
| 8 | PCS/KG | 🟡 pcs_per_kg in form | ✅ conversion fields | **AI Studio** | Central types lag | **AI Studio** |
| 9 | Carton/master carton | ✅ packs_per_master_carton auto-carton | ✅ carton logic in MOQ rules | **AI Studio** (channel rules) | — | **AI Studio** |
| 10 | MOQ | ✅ Single moq field | ✅ Channel MOQ rules table | **AI Studio** | Central single-value only | **AI Studio** |
| 11 | MRP/B2B/wholesale pricing | ✅ Economics engine | ✅ Channel pricing rules | **AI Studio** | — | **AI Studio** |
| 12 | image_url | ✅ Hero URL + upload | ✅ Maps to hero_image_url | Tie | — | **AI Studio** (source) |
| 13 | Hero image | ✅ `product-images` bucket | ✅ `product-media` + uploader | **AI Studio** | Central single field only | **AI Studio** |
| 14 | Square image | ❌ Documented blocker | 🟡 `product_media.type` | **AI Studio** | No Central consumer for typed assets | **AI Studio** |
| 15 | Detail image | ❌ | 🟡 `product_media` | **AI Studio** | Not in B2B snapshot today | **AI Studio** |
| 16 | Packaging image | ❌ | 🟡 `product_media` | **AI Studio** | — | **AI Studio** |
| 17 | Lifestyle image | ❌ | 🟡 `product_media` | **AI Studio** | — | **AI Studio** |
| 18 | Gallery | ❌ | 🟡 Media library page | **AI Studio** | Needs snapshot export to Central | **AI Studio** |
| 19 | Aliases | ✅ Array + AI suggestions | ✅ AliasManager + drafts | **AI Studio** (governed drafts) | Central War Room bypass | **AI Studio** |
| 20 | WhatsApp keywords | 🟡 WA resolver reads aliases | 🟡 productResolver prototype | **Central** (production inbox) | Unify resolver | **Central** (runtime) fed by **AI Studio** |
| 21 | Search keywords | 🟡 tags + aliases | ✅ `search_products_with_aliases` | **AI Studio** | — | **AI Studio** |
| 22 | Regional terms | 🟡 language-wave drafts (Central docs) | ✅ 7-class language model | **AI Studio** | Not persisted to DB on approve | **AI Studio** |
| 23 | Resolver/collision intelligence | ✅ WA governance + prototype lab | ✅ productResolver tests | **Central** (live) + **AI Studio** (authoring) | Two codepaths | **AI Studio** authors; **Central** serves |
| 24 | Ingredients | ✅ Text field | ✅ ingredients table + product link | **AI Studio** | Central flat text only | **AI Studio** |
| 25 | Allergens | ✅ Form + AI batch | ✅ Compliance tab | Tie | — | **AI Studio** |
| 26 | Nutrition | 🟡 nutrition_facts text + placeholder | ✅ nutrition_panels + ingredients | **AI Studio** | No product-specific AI truth | **AI Studio** |
| 27 | FSSAI review | 🟡 QA warning on placeholder | 🟡 compliance suggestion-only | Tie | No workflow state column | **AI Studio** |
| 28 | EAN/barcode | 🟡 `barcode_sku` field | 🟡 field on product | **Central** (scan timeline, execution) | No shared generator | **AI Studio** data; **Central** ops |
| 29 | Label data | ✅ LabelCommandCenter JSON/ZPL | ✅ Labels + LabelQueue | **AI Studio** (structured) | Two label UIs | **AI Studio** → snapshot → **Central** preview |
| 30 | Marketing description | 🟡 Single description | ✅ short + long descriptions | **AI Studio** | — | **AI Studio** |
| 31 | B2B description | ✅ description field | ✅ B2B-specific fields in truth | **AI Studio** | — | **AI Studio** |
| 32 | B2C description | ❌ | 🟡 retail fields in ProductEdit | **AI Studio** | No B2C app yet | **AI Studio** |
| 33 | Visibility controls | ✅ visible_in_catalog | ✅ is_catalogue_ready | Tie | Must sync via snapshot | **AI Studio** approves; **Central** enforces |
| 34 | Active/inactive | ✅ is_active | ✅ is_active | Tie | — | **AI Studio** |
| 35 | Publish workflow | 🟡 Manual visibility flip | ✅ Builder publishability + collections | **AI Studio** | Central Batch001 blocked on visibility | **AI Studio** |
| 36 | Approval/audit trail | 🟡 C1a tag/alias drafts | ✅ 7-type inbox + audit table | **AI Studio** | RPC deployment gaps on Central | **AI Studio** |
| 37 | Sync to Central | ✅ Imports approved snapshot | 🟡 Preview only | **Central connector** (import side) | No automated export from Studio | **AI Studio** export → **Central** import |
| 38 | Sync to label maker | 🟡 LabelCommandCenter reads products | ✅ Labels/LabelQueue | **AI Studio** | No label snapshot contract | **AI Studio** |
| 39 | Sync to B2C | ❌ | 🟡 retail slice in forms | N/A | No B2C repo | **Future B2C** |
| 40 | Sync to WhatsApp resolver | 🟡 Live aliases table | 🟡 Draft → approve → aliases | **Central** (runtime) | Need `whatsapp_resolver_snapshot` | **AI Studio** publish → **Central** ingest |

---

## Score summary

| System | Strong (✅) | Partial (🟡) | Missing (❌) |
|--------|-------------|--------------|--------------|
| Central | 12 | 22 | 6 |
| AI Studio | 18 | 20 | 2 |

AI Studio leads on **authoring breadth** (media, channel rules, drafts, labels). Central leads on **operational consumption** (buyer catalogue, Factory TV, WA inbox, barcode execution).

---

## Features that must not be duplicated (post-consolidation)

1. Master product edit UI — **one** in AI Studio only  
2. Alias approval governance — **one** path (draft → inbox → `product_aliases`)  
3. Channel MOQ/pricing rules — **AI Studio** tables only  
4. Multi-image asset registry — **`product_media`** only  
5. Catalogue collection authoring — **AI Studio** Builder only  
6. WhatsApp runtime resolution — **Central** only (read-only slice)  
7. Order/dispatch/barcode scan — **Central** only  

## Fields Central may still edit temporarily (operational override)

| Field | Why Central keeps short-term override |
|-------|--------------------------------------|
| `is_active` | Emergency hide for stockouts |
| `visible_in_catalog` | Pilot flip after media ready (until snapshot publish automates) |
| `wholesale_price` | Finance may need intraday override (log + expire) |
| `production_department` | Factory routing correction (sync back to Studio) |
| `factory_inventory` overlays | Operational only — not product truth |

All overrides should log to `product_override_audit` (future) and reconcile with next approved snapshot.
