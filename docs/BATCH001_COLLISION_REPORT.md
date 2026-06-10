# Batch 001 Collision Report

**Date:** 2026-06-09  
**Scope:** Batch 001 (`OAS-AS-BKL-*`) alias collision analysis

---

## 1. Wave 2C pack scan

| Check | Count |
|-------|-------|
| Terms scanned | 32 |
| In-pack duplicates | 0 |
| In-pack cross-SKU collisions | 0 |
| Unsafe generic-only terms | 0 |

**Verdict:** Wave 2C introduces **no new collisions**.

---

## 2. Live catalogue collisions (pre-existing)

These normalized aliases map to **multiple `product_id`** values in live `product_aliases`:

| Alias (normalized) | SKUs |
|------------------|------|
| `cashew assiyah` | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |
| `cashew high gap baklawa` | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |
| `cashew high jump baklawa` | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |

**Root cause:** Chocolate Cashew Asiyah and Mor Cashew Asiyah share colloquial nicknames.

**Remediation (Wave 3 — not in this PR):**

1. Remove or narrow duplicate aliases on one SKU via governed reject + replace
2. Require distinguishing prefix (`mor`, `chocolate`) in auto-resolve path
3. Align PI + WA-05A substring policy for nested product names

---

## 3. Unsafe generic aliases in live data (null `product_id`)

| Alias | Canonical | Risk |
|-------|-----------|------|
| `pyramid` | Cashew Pyramid | Generic-only — must clarify |
| `pyramid special` | Cashew Pyramid | Generic-only |
| `tart` | Almond Tart | Generic-only |
| `crosole` | Almond Tart | Wrong canonical (should be Almond Crosole) |
| `almand` | Almond Tart | Typo / wrong canonical |
| `piramed` | Cashew Pyramid | Typo |

**Verdict:** Do not approve additional generic-only aliases. Wave 2C excludes these patterns.

---

## 4. Substring ambiguity (resolver-level)

| Utterance | Competing SKUs | Mechanism |
|-----------|----------------|-----------|
| `Special Square Baklawa` | 0009 vs 0002 | Product name substring match |
| `Mor Cashew Asiyah*` | 0014 vs 0017 | Shared token overlap at 94% |
| `Mor Pistachio Asiyah*` | 0015 vs 0016 | Shared token overlap at 94% |

Documented in `BATCH001_RESOLVER_COVERAGE_REPORT.md`.

---

## Evidence

- `docs/evidence/batch-001/live-collisions.json`
- `docs/evidence/batch-001/wave-2c-scan.json`
