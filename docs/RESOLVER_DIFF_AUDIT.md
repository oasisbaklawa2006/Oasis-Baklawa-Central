# Resolver Diff Audit

**Date:** 2026-06-09  
**Program:** Resolver Unification Wave — Workstream A  
**Scope:** Read-only comparison of all product-resolution paths in Oasis Central

---

## 1. Resolver inventory

| # | Path | Entry point | Retrieval | Scoring | Output |
|---|------|-------------|-----------|---------|--------|
| 1 | **Product Intelligence** | `resolveProductIntelligence()` | Full-catalog in-memory scan | Alias-first weighted sum | `clarification_required` + candidates |
| 2 | **WA-05A** | `fetchProductResolution()` | ILIKE fan-out (bounded) | Signal-weighted sum + identity ceilings | `band` + candidates |
| 3 | **SearchOverlay** | `searchProducts()` | `name/sku/category` ILIKE | None (DB order) | Browse list |
| 4 | **AdminProducts BOM** | `searchProductsForBom()` | `name/sku` ILIKE | None | Typeahead list |
| 5 | **banyan-parser** | `resolveProduct()` | Exact alias + shorthand map | Binary 1.0 / fuzzy (disabled) | Canonical name |
| 6 | **Shadow warroom** | `resolveProductId()` | Limit 2000, exact/contains | None | `product_id` or null |

**Authoritative targets for unification:** #1 + #2. #3–#6 are browse/legacy fallbacks.

---

## 2. Side-by-side diff matrix

### 2.1 Signal extraction

| Signal | Product Intelligence | WA-05A |
|--------|-------------------|--------|
| Normalize whitespace | Yes | Yes |
| Polite prefix strip (`need`, `send`, …) | Repeated loop (`genericTerms`) | Partial (phrase regex only) |
| Weight extraction | `(\d+) (kg\|gm\|g)` | Same pattern + piece count + pack qty |
| Weight tolerance | 10% or 20g min | 8% or 15g min |
| Product phrase candidates | N/A (full scan) | Top 6 from regex |
| Catalog keywords | N/A | Top 4 identity keywords |
| Quoted names | No | Yes |

**Files:** `utteranceSignals.ts` vs `productResolutionSignals.ts`

### 2.2 Alias retrieval

| Aspect | Product Intelligence | WA-05A | SearchOverlay |
|--------|---------------------|--------|---------------|
| Mechanism | Build alias index from full catalog | ILIKE `product_aliases.alias_text` per candidate | ILIKE `products.name/sku/category` |
| `product_id=null` rows | `canonical_name → product.name` | ILIKE `canonical_name` on products | Not used |
| `products.aliases[]` | Merged in loader | Read in scoring only | Not used |
| Completeness guard | `catalog_complete` flag | None | None |
| Identity filter | All aliases scored | `isIdentityAlias()` filter on hits | None |
| Max fan-out | All products | 6 name + 4 keyword queries × 5 rows | 10 rows |

**Critical divergence:** WA-05A only scores products surfaced by ILIKE. PI scores every product in loaded catalog. Silent misses possible in WA when phrase extraction fails.

### 2.3 Scoring weights

| Signal | PI (raw → %) | WA-05A (raw → %) |
|--------|-------------|------------------|
| Exact product name | 0.88 | 0.80 |
| Approved alias | 0.72–0.94 (length-scaled) | 0.45 |
| Name token overlap | +0.12–0.35 | Partial name → weak identity |
| SKU match | +0.25 | Via ILIKE retrieval |
| Weight alignment | +0.10 | +0.35 |
| Piece count | — | +0.30 |
| Pack format | — | +0.25 |
| Catalog keyword | — | +0.18 |

### 2.4 Confidence thresholds

| Band | Product Intelligence | WA-05A |
|------|---------------------|--------|
| Auto-resolve | ≥ 85% + `clarification_required=false` | `auto_highlight` ≥ 95% |
| Suggested | Implicit 70–84% | `suggested` 70–94% |
| Clarify | `< 70%` or policy flag | `needs_clarification` < 70% |
| Metadata-only cap | Generic cap at 55% | Identity `none` → ceiling 69% |
| Weak identity cap | — | ceiling 94% |

### 2.5 Clarification rules

| Rule | PI | WA-05A |
|------|----|----|
| Generic-only utterance | Cap all at 55%, force clarify | No equivalent |
| Strong multi-word alias override | Yes (`isStrongApprovedAliasMatch`) | No |
| Top-2 within 8 pts, both ≥ 70% | Clarify unless long-alias escape | No |
| Single-token multi-hit ≥ 70% | Clarify | Partial via identity ceiling |
| Below auto-resolve bar | Always clarify if < 85% | Band mapping |

### 2.6 Family term semantics

| Term class | PI (`GENERIC_FAMILY_TERMS`) | WA (`IDENTITY_ALIAS_TERMS`) |
|------------|----------------------------|----------------------------|
| `baklava` / `baklawa` | Generic — clarify | Identity keyword (+0.18) |
| `pyramid` | Generic — clarify | Not listed |
| `asiyah` | Generic — clarify | Not listed |
| `pistachio` / `kaju` | Not generic | Identity keyword |

**Opposite semantics** for baklava family terms between resolvers.

---

## 3. Alias search fallback chain (WA-05A)

```
messageText
  → extractProductResolutionTextSignals()
  → for each productNameCandidate (≤6):
      queryProductsByName (ILIKE)
      queryProductsBySku (ILIKE)
      queryProductAliases (ILIKE alias_text)
        → if product_id: note alias
        → else: queryProductsByName(canonical_name)
  → for each catalogKeyword (≤4):
      queryProductsByKeyword (category/sub_category/pack ILIKE + whole-word filter)
  → queryProductsByIds(alias hits)
  → dedupe → scoreProductResolutionCandidates()
```

**Fallback gaps:**

- Product never ILIKE-matched → never scored
- Alias with `product_id=null` and wrong `canonical_name` → wrong product or miss
- Packaging tokens (`tin`, `box`) filtered from identity but not from PI

---

## 4. Product search fallback (browse paths)

| Surface | Query | Limit | Resolution? |
|---------|-------|-------|---------------|
| `SearchOverlay` | `name/sku/category` ILIKE | 10 | No — navigation |
| `AdminProducts` BOM | `name/sku` ILIKE | — | No — typeahead |

These must **not** be merged into utterance resolver — they lack clarification policy and confidence scoring.

---

## 5. Known parity failures (golden matrix)

| Utterance | PI | WA-05A (expected) | Root cause |
|-----------|----|--------------------|------------|
| `Need Baklava` | Clarify | May suggest product | Generic policy gap in WA |
| `Mor Cashew Asiyah` | Resolve | Suggested band | Threshold split (85 vs 95) |
| `cashew assiyah` | Clarify | May resolve one SKU | Live collision + no clarify rule |
| `Special Square Baklawa` | Wrong SKU possible | ILIKE may hit Square | Substring name match |
| `pyramid` | Clarify (cap 55) | May score Cashew Pyramid | Generic live alias |

Full matrix: `src/lib/resolver-golden/goldenUtteranceMatrix.ts` (111 cases).

---

## 6. Unification priority

| Priority | Gap | Impact |
|----------|-----|--------|
| P0 | Dual resolvers on same tables | Operator vs lab drift |
| P0 | Family term semantic split | Wrong auto-highlight |
| P1 | Retrieval model (full scan vs ILIKE) | Silent misses |
| P1 | Threshold mapping (85/95) | Inconsistent operator trust |
| P2 | Weight/piece signal unification | Score drift |
| P3 | Browse search separation | Scope creep if merged |

---

## 7. References

- `src/lib/product-intelligence/resolveProductIntelligence.ts`
- `src/lib/wa-governance/fetchProductResolution.ts`
- `src/lib/wa-governance/productResolutionScoring.ts`
- `src/components/SearchOverlay.tsx`
- `docs/PRODUCT_RESOLUTION_ALIGNMENT_AUDIT.md`
