# UAT Crawl Progress Summary

**Last updated:** 2026-09-05  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Mode:** Read-only evidence — **no remediation** in this programme.

## Coverage

| Metric | Count |
|---|---:|
| Census total | 131 |
| Screenshots captured (unique UAT IDs) | **20** |
| Remaining untested | **111** (UAT-0021..UAT-0131) |
| Manifest rows | 20 (`UAT_MANIFEST.jsonl`) |

## Tranches

| Tranche | UAT range | Index | Screenshots |
|---|---|---|---|
| 01 | UAT-0001..0010 | [UAT_INDEX.md](./UAT_INDEX.md) | `uat-evidence/screenshots/tranche-01/` |
| 02 | UAT-0011..0020 | [UAT_INDEX_TRANCHE_02.md](./UAT_INDEX_TRANCHE_02.md) | `uat-evidence/screenshots/tranche-02/` |

## Blockers recorded (do not halt unrelated lanes)

| Blocker | Affected UAT IDs | Action |
|---|---|---|
| **P0 #483** not deployed | UAT-0018, UAT-0020 | Preserve pre-fix FAIL-481-* evidence; re-test same IDs post-deploy only |
| **CREDENTIAL_REQUIRED** | Most `/admin/*` surfaces | Provision `TEST_*` emails; continue public + cross-repo deploy crawls |
| **Separate deploy URL** | UAT-0122+ (AI Studio), UAT-0126+ (Trace) | Set `UAT_CRAWL_BASE_URL` per repo preview |

## Next tranche

**UAT-0021..0030** — Central admin routes (products, orders, finance, factory, dispatch approaching UAT-0093).
