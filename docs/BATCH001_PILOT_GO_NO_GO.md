# Batch 001 Pilot GO / NO-GO

**Generated:** 2026-06-12  
**Recommendation:** **NO-GO** for buyer-facing preview

## Readiness scores

| Dimension | Score |
|-----------|------:|
| Catalogue readiness | 60% |
| Media readiness | 0% |
| Alias readiness (live) | 68% |
| Resolver readiness | 88% |
| **Pilot ready (all gates)** | **0 / 25** |

## Pilot gate (all required)

| Gate | Required | Batch pass |
|------|----------|------------|
| `visible_in_catalog = true` | yes | 0 / 25 |
| `is_active = true` | yes | unverified (not in snapshot) |
| Image exists | yes | 0 / 25 |
| Description exists | yes | unverified (not in snapshot) |
| Category valid | yes | 25 / 25 |
| Pack size valid | yes | 25 / 25 |
| Product URL valid | yes | 25 / 25 |
| Aliases available (live) | yes | 17 / 25 |
| Resolver PASS | yes | 22 / 25 |

## GO items (15 SKUs — partial readiness)

SKUs with category, pack, URL, live aliases, and resolver PASS (still blocked on media/visibility/description):

- **OAS-AS-BKL-0001** — Cashew Kitta
- **OAS-AS-BKL-0003** — Cashew Ring
- **OAS-AS-BKL-0007** — Cashew Finger
- **OAS-AS-BKL-0010** — Pistachio Ring
- **OAS-AS-BKL-0012** — Chocolate Pistachio Asiyah
- **OAS-AS-BKL-0013** — Chocolate Cashew Asiyah
- **OAS-AS-BKL-0016** — Pistachio Asiyah
- **OAS-AS-BKL-0017** — Cashew Asiyah
- **OAS-AS-BKL-0019** — Pistachio Pyramid
- **OAS-AS-BKL-0020** — Tart Cashew
- **OAS-AS-BKL-0021** — Mix Nut Tart
- **OAS-AS-BKL-0022** — Almond Tart
- **OAS-AS-BKL-0023** — Pistachio Tart
- **OAS-AS-BKL-0024** — Mor Pistachio Durum
- **OAS-AS-BKL-0025** — Coconut Durum

## BLOCKED items (25 SKUs)

- **OAS-AS-BKL-0001** — Cashew Kitta
- **OAS-AS-BKL-0002** — Square Baklawa
- **OAS-AS-BKL-0003** — Cashew Ring
- **OAS-AS-BKL-0004** — Cashew Rosebud
- **OAS-AS-BKL-0005** — Almond Crosole
- **OAS-AS-BKL-0006** — Cashew Pyramid
- **OAS-AS-BKL-0007** — Cashew Finger
- **OAS-AS-BKL-0008** — Date Baklawa
- **OAS-AS-BKL-0009** — Special Square Baklawa
- **OAS-AS-BKL-0010** — Pistachio Ring
- **OAS-AS-BKL-0011** — Pistachio Pyramid(Topping)
- **OAS-AS-BKL-0012** — Chocolate Pistachio Asiyah
- **OAS-AS-BKL-0013** — Chocolate Cashew Asiyah
- **OAS-AS-BKL-0014** — Mor Cashew Asiyah
- **OAS-AS-BKL-0015** — Mor Pistachio Asiyah
- **OAS-AS-BKL-0016** — Pistachio Asiyah
- **OAS-AS-BKL-0017** — Cashew Asiyah
- **OAS-AS-BKL-0018** — Diamond Pistachio
- **OAS-AS-BKL-0019** — Pistachio Pyramid
- **OAS-AS-BKL-0020** — Tart Cashew
- **OAS-AS-BKL-0021** — Mix Nut Tart
- **OAS-AS-BKL-0022** — Almond Tart
- **OAS-AS-BKL-0023** — Pistachio Tart
- **OAS-AS-BKL-0024** — Mor Pistachio Durum
- **OAS-AS-BKL-0025** — Coconut Durum

## Fastest path to pilot

1. **Approve Wave 2C aliases** — unlock 8 SKU(s) with zero live rows (32 terms)
2. **Upload images** for all 25 SKU(s) (or start with recommended 5)
3. **Write buyer descriptions** — staff verify `products.description` (not in snapshot)
4. **Confirm `is_active`** on pilot SKUs via authenticated admin read
5. **Flip `visible_in_catalog`** per SKU through governed merchandising (not bulk in this wave)
6. **Resolver hardening** for OAS-AS-BKL-0009, OAS-AS-BKL-0014, OAS-AS-BKL-0015 before relying on short WhatsApp keywords

## Recommended first 5 SKUs for launch

Selected from near-ready pool: live aliases, resolver PASS, no Wave 2C gap, low collision risk.

| Rank | SKU | Product | live aliases | resolver | blockers remaining |
|------|-----|---------|:------------:|:--------:|--------------------|
| 1 | OAS-AS-BKL-0024 | Mor Pistachio Durum | 21 | PASS | visibility, image, description, is_active verify |
| 2 | OAS-AS-BKL-0020 | Tart Cashew | 19 | PASS | visibility, image, description, is_active verify |
| 3 | OAS-AS-BKL-0001 | Cashew Kitta | 12 | PASS | visibility, image, description, is_active verify |
| 4 | OAS-AS-BKL-0025 | Coconut Durum | 12 | PASS | visibility, image, description, is_active verify |
| 5 | OAS-AS-BKL-0007 | Cashew Finger | 11 | PASS | visibility, image, description, is_active verify |

### Why these five

- **OAS-AS-BKL-0024** (Mor Pistachio Durum): 21 live aliases, resolver PASS, Turkish Baklawa / pack OK
- **OAS-AS-BKL-0020** (Tart Cashew): 19 live aliases, resolver PASS, Lebanese Baklawa / pack OK
- **OAS-AS-BKL-0001** (Cashew Kitta): 12 live aliases, resolver PASS, Lebanese Baklawa / pack OK
- **OAS-AS-BKL-0025** (Coconut Durum): 12 live aliases, resolver PASS, Turkish Baklawa / pack OK
- **OAS-AS-BKL-0007** (Cashew Finger): 11 live aliases, resolver PASS, Lebanese Baklawa / pack OK

---

*Read-only recommendation. No visibility activation, SQL, or draft auto-approval performed.*
