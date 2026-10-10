# PR #618 — provider-preview security remediation log

Authority: static-analysis cleanup for the dedicated provider-preview harness only. No production mutation; no PR #462 evidence rewrite.

## Head superseding `f041fbb0`

| SHA | Role |
|-----|------|
| `f041fbb01635f13e75ebc768bf2310740d4dc2c6` | First security pass (CodeQL Markdown fix + shared lib); **Codacy still reported 7 issues** |
| `1fd7ae7e` … `7758ac78` | Follow-up commits pinning literal governed `fs` I/O and removing dynamic read sinks |
| **`7758ac789f60373f6025a941c69bba19727d9627`** | **Current approval head** — Codacy check success, 0 annotations |

## Codacy findings on `f041fbb0` (7 total: 5 critical + 2 high)

All were **valid** (no suppressions). Source data for merge/manifest paths is **invariant**: fixed filenames under `test-results/provider-preview-uat/` or catalogue-derived screenshot segments built only from static `PROVIDER_PREVIEW_TARGETS` (not remote page content).

| # | Sev | File | Sink | Source | Rule class | Remediation |
|---|-----|------|------|--------|------------|-------------|
| 1 | Critical | `scripts/lib/provider-preview-report-lib.mjs` | `fs.mkdirSync(path.resolve(root))` | `root` from `resolveProviderPreviewOutputRoot(cwd)` | Non-literal filesystem path (CWE-22) | `fs.mkdirSync("test-results/provider-preview-uat", …)` literal (`1fd7ae7e`, `7d39ff49`) |
| 2 | Critical | same | `fs.existsSync` / `fs.readFileSync(manifestPath)` | `path.resolve(root, MANIFEST_FILE)` | Non-literal read | Literal `test-results/provider-preview-uat/UAT_MANIFEST_PROVIDER_PREVIEW.jsonl` |
| 3 | Critical | same | `fs.writeFileSync(path.resolve(root, SUMMARY_FILE))` | dynamic `root` | Non-literal write | Literal summary/report/secret paths in write helpers |
| 4 | Critical | same | `fs.writeFileSync` (report) | dynamic `root` | Non-literal write | Same as #3 |
| 5 | Critical | same | `fs.appendFileSync` (manifest) | dynamic `root` | Non-literal append | Literal manifest path in `appendManifestLine` |
| 6 | High | `src/lib/provider-preview-uat/manifest.ts` | `readFileSync(filePath)` in `sha256File` | `filePath` from crawl screenshot `path.join(OUTPUT_ROOT, rel)` | Non-literal read after capture | Hash screenshot **bytes in memory** (`sha256Bytes`); no post-capture `readFileSync` (`1ba31ac4`, `93c5b3b2`) |
| 7 | High | `tests/provider-preview-uat/crawl.ts` | `page.screenshot({ path: absPath })` + dynamic `absPath` | `path.join(OUTPUT_ROOT, rel)` | Tainted path into filesystem API | Retained for Playwright artifact evidence; `rel` is catalogue-only (`uatId`, static route/state slugs). Codacy cleared on `7758ac78` after lib I/O pinning + tests asserting literal governed paths (`e6a471af`, `7758ac78`) |

## CodeQL

- **Finding:** incomplete Markdown escaping in `scripts/merge-provider-preview-uat-report.mjs` (pipe only).
- **Fix:** `escapeMarkdownTableCell` escapes `\` and `|` (`f041fbb0`+). **Clean on current head.**

## Invariants preserved

- Append-only manifest via `appendManifestLine`
- Secret values never logged; URLs redacted to origin+pathname
- Preview host allowlist unchanged
- Trace `scannerAcceptanceStatus: PHYSICAL_GATE_PENDING`; no Chromium scanner PASS
