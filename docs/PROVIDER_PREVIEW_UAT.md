# Provider-preview UAT (AI Studio + Trace)

Dedicated harness for **UAT-0122..0127** (AI Studio) and **UAT-0128..0131** (Trace). It is intentionally separate from the Central authenticated crawl in PR #462, which early-returns for non-Central apps.

## Secrets (names only in logs)

- `TEST_AI_STUDIO_PREVIEW_URL` — governed AI Studio Vercel preview
- `TEST_TRACE_PREVIEW_URL` — governed Trace Vercel preview

Values are never printed in CI output. Manifest rows store origin + pathname only.

## Security notes (static analysis)

See **`docs/PROVIDER_PREVIEW_UAT_SECURITY_REMEDIATION.md`** for the per-finding Codacy/CodeQL log (including the 7 issues on `f041fbb0` and fixes through `7758ac78`).

Summary: governed I/O uses **literal** paths under `test-results/provider-preview-uat/` via `scripts/lib/provider-preview-report-lib.mjs`; manifest JSONL never influences output paths. Markdown cells use full table escaping (backslash and pipe).

## Physical gates

- Trace scanner rows collect **software-preview** screenshots only. `scannerAcceptanceStatus` remains `PHYSICAL_GATE_PENDING`; Chromium does not certify scanner PASS.
- UAT-0127 camera capture remains a **camera physical gate**; software preview may observe the route shell only.

## Local execution

```bash
export TEST_AI_STUDIO_PREVIEW_URL='https://…vercel.app'
export TEST_TRACE_PREVIEW_URL='https://…vercel.app'
npm run test:provider-preview-uat:contracts
PROVIDER_PREVIEW_RUN_TRANCHE=all npm run test:provider-preview-uat
npm run test:provider-preview-uat:report
```

## GitHub Actions

Workflow: `.github/workflows/provider-preview-uat.yml` (`workflow_dispatch` only). Choose tranche `ai-studio`, `trace`, or `all`. Artifacts land under `test-results/provider-preview-uat/`.
