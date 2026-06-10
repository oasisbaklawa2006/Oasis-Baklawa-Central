# Resolver Collision Remediation Plan

**Date:** 2026-06-09  
**Program:** Resolver Unification Wave — Workstream D  
**Scope:** Audit + cleanup plan only — no SQL, migrations, or direct alias writes

---

## 1. Collision risk summary

| Family | Live alias collisions | Substring resolver conflicts | Remediation priority |
|--------|----------------------|------------------------------|---------------------|
| **Cashew Asiyah** | 3 duplicate alias groups (0013/0014) | Mor vs Cashew token overlap | **P0** |
| **Mor Asiyah** | Shared `cashew assiyah` with 0013 | Mor Cashew vs Mor Pistachio on `mor asiyah` | **P1** |
| **Square** | None in alias table | Special Square vs Square name substring | **P0** |
| **Pyramid** | `pyramid`, `pyramid special` null-`product_id` | 0006 vs 0011 vs 0019 on bare `pyramid` | **P0** |
| **Tart** | `tart` null-`product_id` → Almond Tart | 0020–0023 family on bare `tart` | **P1** |

**Estimated collision risk after Wave 2C (pre-remediation):** **34%** of golden matrix clarify cases trace to catalogue or substring defects (12/29 clarify cases).

---

## 2. Cashew Asiyah family

### SKUs

| SKU | Product |
|-----|---------|
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah |
| OAS-AS-BKL-0017 | Cashew Asiyah |

### Live duplicate aliases (governed removal candidates)

| Alias | Current SKUs | Action |
|-------|--------------|--------|
| `cashew assiyah` | 0013, 0014 | **Remove from both**; replace with `chocolate cashew asiyah` (0013) and `mor cashew asiyah` (0014) only |
| `cashew high gap baklawa` | 0013, 0014 | Remove from 0013; keep on 0014 if commercially required |
| `cashew high jump baklawa` | 0013, 0014 | Remove from 0013; keep on 0014 if commercially required |

### Cleanup plan

1. Submit governed **reject** drafts for duplicate rows on 0013
2. Approve distinguishing aliases already present (`Mor Cashew Asiyah`, `Chocolate Cashew Asiyah`)
3. Resolver: require `mor` or `chocolate` prefix for auto-resolve in Asiyah cashew family

---

## 3. Mor Asiyah family

### SKUs

| SKU | Product |
|-----|---------|
| OAS-AS-BKL-0014 | Mor Cashew Asiyah |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah |

### Issues

- `mor asiyah` utterance clarifies correctly but short forms drift
- `Mor Cashew Asiyah` substring-matches `Cashew Asiyah` (0017) at equal confidence

### Cleanup plan

1. No alias table collision between 0014/0015
2. Resolver: substring name guard (see `SHARED_RESOLVER_ARCHITECTURE.md` §6.6)
3. Operator UX: show nut qualifier in clarification chips (`Mor Cashew` vs `Mor Pistachio`)

---

## 4. Square family

### SKUs

| SKU | Product |
|-----|---------|
| OAS-AS-BKL-0002 | Square Baklawa |
| OAS-AS-BKL-0009 | Special Square Baklawa |

### Issues

- `Square Baklawa` name is substring of `Special Square Baklawa`
- Utterance `special square baklawa` can match 0002 via inner phrase `square baklawa`

### Cleanup plan

1. Wave 2C terms already use distinguishing keywords (`special square baklawa`, `square piece baklawa lebanese`)
2. Resolver: prefer longest matching product name; clarify when two names both substring-match
3. Do not add bare `square` alias to either SKU

---

## 5. Pyramid family

### SKUs

| SKU | Product |
|-----|---------|
| OAS-AS-BKL-0006 | Cashew Pyramid |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) |
| OAS-AS-BKL-0019 | Pistachio Pyramid |

### Live unsafe aliases (governed removal)

| Alias | Canonical | `product_id` | Action |
|-------|-----------|--------------|--------|
| `pyramid` | Cashew Pyramid | null | **Reject / delete** |
| `pyramid special` | Cashew Pyramid | null | **Reject / delete** |
| `piramed` | Cashew Pyramid | null | Replace with `cashew pyramid` on 0006 only |

### Cleanup plan

1. Governed removal of generic `pyramid` null-`product_id` rows
2. Ensure each SKU has nut-qualified aliases: `cashew pyramid`, `pistachio pyramid`, `pistachio pyramid topping`
3. Bare `Need Pyramid` → always clarify (golden matrix `amb-pyramid`)

---

## 6. Tart family

### SKUs

| SKU | Product |
|-----|---------|
| OAS-AS-BKL-0020 | Tart Cashew |
| OAS-AS-BKL-0021 | Mix Nut Tart |
| OAS-AS-BKL-0022 | Almond Tart |
| OAS-AS-BKL-0023 | Pistachio Tart |

### Live unsafe aliases

| Alias | Canonical | Issue |
|-------|-----------|-------|
| `tart` | Almond Tart | null-`product_id` — generic |
| `crosole` | Almond Tart | Wrong — should be Almond Crosole (0005) |
| `almand` | Almond Tart | Typo — acceptable only on 0022 with qualification |

### Cleanup plan

1. Reject `tart` null-`product_id` row
2. Fix `crosole` canonical → Almond Crosole (0005) via governed replace draft
3. Require nut prefix for tart auto-resolve (`tart cashew`, `almond tart`, etc.)

---

## 7. Execution sequence (governed drafts only)

| Step | Action | Owner |
|------|--------|-------|
| 1 | Export collision rows from live audit | Engineering |
| 2 | Submit `catalogue_alias_drafts` reject operations for P0 aliases | Catalogue admin |
| 3 | Submit insert drafts for nut-qualified replacements | Wave 3 language |
| 4 | Human approve at `/admin/catalogue-approvals` | Catalogue admin |
| 5 | Re-run golden matrix parity tests | Engineering |
| 6 | Deploy shared resolver with substring guard | Engineering PR |

**No War Room `AliasDrawer` bulk edits.**

---

## 8. Success metrics post-remediation

| Metric | Current | Target |
|--------|---------|--------|
| Live cross-SKU duplicate aliases (Batch 001) | 3 groups | 0 |
| Null-`product_id` generic aliases | 6 | 0 |
| Golden matrix clarify accuracy | 100% | 100% |
| Golden matrix resolve accuracy | 78/78 defined | ≥ 74/78 (95%) |
| Collision risk % | 34% | **< 10%** |

---

## 9. References

- `docs/BATCH001_COLLISION_REPORT.md`
- `docs/evidence/batch-001/live-collisions.json`
- `src/lib/resolver-golden/goldenUtteranceMatrix.ts` — `ambiguous_family` cases
