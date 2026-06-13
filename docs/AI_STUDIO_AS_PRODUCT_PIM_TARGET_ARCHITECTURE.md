# AI Studio as Product PIM — Target Architecture

**Date:** 2026-06-13  
**Status:** Target state (not yet implemented)

---

## Executive summary

**AI Studio** becomes the **authoritative Product Information Management (PIM)** system for Oasis.  
**Oasis-Baklawa-Central** becomes an **operational consumer** of approved product slices — B2B catalogue, orders, dispatch, WhatsApp resolution, and limited emergency overrides.

Both apps share one Supabase project (`tcxvcatsqqertcnycuop`) during transition; authority is logical, not physical isolation.

---

## System boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI STUDIO (PIM)                          │
│  Authoring │ Drafts │ Approvals │ Media │ Intelligence │ Export │
└────────────────────────────┬────────────────────────────────────┘
                             │ approved snapshots (versioned JSON)
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Central (B2B)   │ │ Label slice     │ │ Future B2C      │
│ ops catalogue   │ │ Labels/Queue    │ │ retail app      │
│ WA resolver     │ │ ZPL assets      │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## AI Studio responsibilities (authoritative)

| Domain | Capability | Primary artifacts |
|--------|------------|-------------------|
| **Product repository** | CRUD via governed writes | `products`, `product_media`, `product_aliases`, rules tables |
| **Draft workflow** | Contributor-safe edits | `catalogue_*_drafts` → ApprovalInbox |
| **AI generation** | Suggestion-only compliance, aliases, descriptions | Edge functions + review UI |
| **Product intelligence** | Language terms, discoverability, resolver test harness | `features/productIntelligence`, `productResolver` |
| **Media master** | Typed assets, readiness scoring | `product_media`, `catalogue_media_submissions` |
| **Approvals** | 7-type inbox + audit | RPCs + `catalogue_approval_audit` |
| **Snapshots** | Versioned publish packages | `catalogue_versions` + export payloads |
| **Publishing controls** | `is_catalogue_ready`, collection publishability | Catalogue Builder gates |
| **Import** | Category 1 CSV → drafts | `Category1ImportStaging` |

### AI Studio must NOT own

- Sales orders, dispatch, finance, stock reservations  
- Live WhatsApp message handling  
- Barcode scan ingestion at warehouse  
- Buyer cart/checkout  

---

## Central responsibilities (operational consumer)

| Domain | Capability | Data source |
|--------|------------|-------------|
| **B2B buyer app** | Catalogue, product detail, cart | `central_product_snapshot` → `products` slice |
| **Order/dispatch/stock** | Full ERP flows | `products.id` FK (stable) |
| **Factory TV** | Department routing queues | `production_department` from approved slice |
| **WhatsApp resolver** | Live alias matching | `whatsapp_resolver_snapshot` → `product_aliases` |
| **Barcode execution** | Scan timeline, carton labels | `barcode_sku` from approved slice |
| **Limited override** | Emergency hide/price fix | Local override table or flagged columns + audit |

### Central must NOT own (post-consolidation)

- New channel pricing/MOQ rule UI  
- Multi-image upload master  
- Contributor product drafts  
- Catalogue collection authoring (Builder)  
- Master alias approval (except ingest from snapshot)  

---

## Label maker boundary

**Today:** Split between Central `LabelCommandCenter` (ZPL preview) and AI Studio `Labels` / `LabelQueue` / `nutrition_panels`.

**Target:**

- **AI Studio** owns label **data truth** (nutrition panels, ingredients, regulatory fields, artwork assets in `label-assets` bucket).
- **Central** (or a thin print station) consumes **`label_product_snapshot`** for ZPL/print execution at dispatch.
- No duplicate nutrition editing in Central.

---

## Future B2C boundary

Consumes **`b2c_product_snapshot`**: retail descriptions, lifestyle imagery, consumer nutrition display, MRP, pack shots — subset of PIM with B2C-specific merchandising flags.

---

## WhatsApp boundary

Consumes **`whatsapp_resolver_snapshot`**:

- `product_id`, `sku`, `canonical_name`
- `aliases[]` (normalized, channel-scoped)
- `language_terms[]` (regional variants when schema lands)
- `collision_hints` (blocked generics)

**Central** runs resolution at message time; **AI Studio** authors and approves terms.

---

## Shared infrastructure

| Resource | Owner | Notes |
|----------|-------|-------|
| Supabase `tcxvcatsqqertcnycuop` | Platform | Single DB during migration |
| `products` table | **AI Studio writes**; Central reads approved columns | Stable `id` as join key |
| `product_aliases` | AI Studio approve path | Central read + snapshot refresh |
| `product_media` | AI Studio only | Central gets primary URL in B2B snapshot |
| RLS / RPC roles | Platform team | `super_admin`, `catalogue_contributor`, `catalogue_reviewer` |
| Edge `generate-product-attributes` | Shared | Suggestion-only contract |
| Edge `oasis-ai-chat` | Shared | Alias/description assistance |

---

## Permission model (target)

| Role | AI Studio | Central |
|------|-----------|---------|
| `catalogue_contributor` | Draft submit | No product master |
| `catalogue_reviewer` | Approve drafts, publish snapshots | View sync status |
| `super_admin` | Full PIM | Override + sync admin |
| `ADMIN` / ops roles | Read-only product reference | Full operations |
| Buyer | — | Catalogue read |

Eliminate dual permission systems: **Central RPC roles become source of truth**; deprecate legacy `user_roles` matrix in AI Studio over time.

---

## UI consolidation map

| Current Central screen | Target |
|------------------------|--------|
| `/admin/products` full edit | **Read-only** + "Edit in AI Studio" link + override drawer |
| `/admin/catalogue-sync` | **Inbound snapshot receiver** (automated webhook later) |
| `/admin/catalogue-approvals` | **Merge into AI Studio** ApprovalInbox (single inbox) |
| `/admin/merchandising` | Stay Central (buyer presentation order) OR move to B2B snapshot merchandising block |
| `/admin/product-intelligence-prototype` | Move lab into AI Studio; Central keeps production WA panel |
| `/admin/label-command-center` | Print/preview only; data from label snapshot |

---

## Data authority rules

1. **Write once** in AI Studio (or draft → approve).  
2. **Publish** creates immutable versioned snapshot.  
3. **Consume** downstream via snapshot import (never dual-edit same field).  
4. **Override** in Central is explicit, audited, and expiring.  
5. **Stable IDs** (`products.id`, `sku`) never change on publish — only attributes update.

---

## Success criteria

- [ ] One approval inbox for all product mutations  
- [ ] One media model (`product_media`) feeding all channels  
- [ ] Central buyer catalogue reads only approved B2B snapshot fields  
- [ ] WA resolver aliases refreshed from `whatsapp_resolver_snapshot`  
- [ ] Batch001 pilot can complete in AI Studio without Central master edits  
- [ ] Zero silent duplication of `products.aliases[]` vs `product_aliases`
