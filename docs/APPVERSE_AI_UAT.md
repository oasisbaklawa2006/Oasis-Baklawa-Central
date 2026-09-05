# APPVERSE AI UAT

## Purpose

APPVERSE AI UAT is a bounded exploratory layer on top of the existing Playwright and live-smoke infrastructure. It does **not** replace deterministic RBAC/business assertions or final physical hardware UAT.

Tranche 1 automates physical-UAT equivalents **UAT-001 through UAT-010**:

1. Logout terminates access.
2. Invalid direct URL protection.
3. Session isolation.
4. Dispatch Manager governed landing.
5. Dispatch cannot access Finance.
6. Dispatch cannot see broad Admin/Governance/Store/Gate tools.
7. Dispatch cannot access Legacy/CMD War Room.
8. Governed B2B Dispatch renders rows or an explicit empty state, not a blank panel.
9. Assembly cross-role isolation.
10. Hidden UI does not equal permission: forbidden direct routes must fail closed.

The machine-readable source of truth is `src/lib/ai-uat/catalogue.ts`.

## Execution model

Each test has two layers:

- **Deterministic Playwright oracle** — authoritative for route denial, role isolation and required visible/forbidden controls.
- **Bounded AI explorer** — optional. It receives the UAT goal, a URL reduced to origin+pathname, recent sanitized action history and a privacy-minimised snapshot of UI chrome (headings/buttons/links/labels/placeholders). It may choose one human-like action at a time.

The AI action vocabulary is restricted to:

- `click`
- `fill` (search/filter fields only)
- `scroll`
- `back`
- `wait`
- `navigate` (only case-bounded routes)
- `screenshot` (observation-only; no screenshot artifact is persisted in Tranche 1)
- `finish`

Clicks resolve exact visible semantic controls before policy is applied. Mutation-like controls, submit buttons, external links and links outside the case route boundary are blocked. Back/navigation are origin-bounded. The AI cannot run JavaScript, shell, SQL, developer tools, arbitrary network navigation or production-data mutation.

## Privacy / credential rules

- Login credentials come only from environment/GitHub secrets.
- Playwright trace, automatic screenshot and video are disabled during credential entry.
- Diagnostics begin before login so authentication failures still generate evidence.
- The AI never receives the password or session token.
- URLs sent to the model or persisted in evidence are reduced to origin+pathname; URL userinfo, queries and fragments are removed.
- Default AI model input excludes tables, free-form paragraphs and business-data rows.
- `AI_UAT_SEND_IMAGES=true` is accepted only when `AI_UAT_SYNTHETIC_TARGET=true`; the image is sent from memory and is not retained as an artifact.
- Tranche 1 does not persist screenshot files. This removes dynamic artifact paths and prevents raw live-business screenshots from entering public-repository workflow artifacts.
- Credentialed Playwright runs use normal TLS certificate validation.
- Hosted role/API secrets are scoped only to the Playwright execution step, not the full job.
- Checkout does not persist the GitHub token into local Git configuration.

## Required secrets

For the authenticated Tranche-1 cases:

- `TEST_DISPATCH_EMAIL`
- `TEST_DISPATCH_PASSWORD`
- `TEST_ASSEMBLY_EMAIL`
- `TEST_ASSEMBLY_PASSWORD`

For optional AI exploration:

- `OPENAI_API_KEY`

A missing role credential produces a `BLOCKED` evidence record for the affected case rather than silently substituting another identity.

## Local execution

Local execution may use `localhost`, `127.0.0.1`, or a safe Vercel preview accepted by the shared E2E host guard. Set the role credentials, then run:

```bash
npm run test:ai-uat
npm run test:ai-uat:report
```

Enable the AI explorer with:

```bash
AI_UAT_ENABLE_AI=true OPENAI_API_KEY=... npm run test:ai-uat
```

Optional model override:

```bash
AI_UAT_MODEL=gpt-5.6-luna npm run test:ai-uat
```

## GitHub Actions

Workflow: `.github/workflows/appverse-ai-uat.yml`

It is intentionally `workflow_dispatch` only for Tranche 1. AI judgement is **not** a merge gate. The workflow does preserve deterministic UAT failures as a failing job after writing/uploading the evidence report.

The hosted Actions path is stricter than local execution. Before any Dispatch/Assembly QA secret is bound to a job, a separate no-credential `validate-target` job requires:

- HTTPS
- no URL userinfo
- no query string or fragment
- the real Oasis-team Vercel preview hostname shape: `<deployment-slug>-oasisbaklawa2006-6222s-projects.vercel.app` (letters, digits and hyphens only before the fixed team suffix)

The validator uses the same shared hostname authority as the trusted release controller, preventing divergence between deployment discovery and AI-UAT admission. Only the normalized, validated target is passed to the credentialed tranche job.

Inputs control:

- target preview/staging URL
- AI planner on/off
- whether an in-memory synthetic screenshot may be sent to the model
- synthetic-target confirmation

## Evidence

Every scenario appends one sanitized JSON object to the single fixed evidence stream:

`test-results/ai-uat-evidence.jsonl`

The consolidated report is written to the fixed path:

`test-results/APPVERSE_AI_UAT_REPORT.md`

The fixed-path design deliberately avoids per-test dynamically constructed filesystem destinations.

Evidence includes:

- UAT ID
- PASS / FAIL / BLOCKED
- role
- viewport
- start/final URL
- bounded AI action history
- deterministic expected result
- actual result
- sanitized console errors
- sanitized failed requests
- severity

## Programme sequencing

This lane does not change RBAC implementation. In particular, it must not duplicate or weaken the authoritative Dispatch least-privilege work in Central PR #458. It is designed to expose current failures before #458 and then provide repeatable certification after the canonical RBAC fix is merged/deployed.

Final real-device truth remains separate: browser automation cannot certify scanner hardware behaviour, inexpensive Smart-TV firmware quirks, physical camera capture, Wi-Fi/power recovery or TV overscan.