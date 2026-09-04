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
- **Bounded AI explorer** — optional. It receives the UAT goal, current URL, recent action history and a privacy-minimised snapshot of UI chrome (headings/buttons/links/labels/placeholders). It may choose one human-like action at a time.

The AI action vocabulary is restricted to:

- `click`
- `fill` (search/filter fields only)
- `scroll`
- `back`
- `wait`
- `navigate` (only case-bounded routes)
- `screenshot`
- `finish`

Mutation-like clicks are blocked in the runner. The AI cannot run JavaScript, shell, SQL, developer tools, arbitrary network navigation or production-data mutation.

## Privacy / credential rules

- Login credentials come only from environment/GitHub secrets.
- Playwright trace, screenshot and video are disabled during credential entry.
- The AI never receives the password or session token.
- Default AI model input excludes tables, free-form paragraphs and business-data rows.
- `AI_UAT_SEND_IMAGES=true` is accepted only when `AI_UAT_SYNTHETIC_TARGET=true`.
- `AI_UAT_CAPTURE_IMAGES=true` is accepted only when `AI_UAT_SYNTHETIC_TARGET=true`.
- Raw live-business screenshots must not be uploaded from the public repository workflow.

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

Set a safe preview URL (`localhost`, `127.0.0.1`, or `*.vercel.app` under the existing E2E host guard) and the role credentials, then run:

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
AI_UAT_MODEL=gpt-5.6-luna
```

## GitHub Actions

Workflow: `.github/workflows/appverse-ai-uat.yml`

It is intentionally `workflow_dispatch` only for Tranche 1. AI judgement is **not** a merge gate. The workflow does preserve deterministic UAT failures as a failing job after writing/uploading the evidence report.

Inputs control:

- target preview/staging URL
- AI planner on/off
- whether synthetic screenshots may be sent to the model
- whether synthetic screenshots may be retained as artifacts

## Evidence

Per-case JSON is written under:

`test-results/ai-uat-evidence/`

The consolidated report is:

`test-results/APPVERSE_AI_UAT_REPORT.md`

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
- optional synthetic screenshots
- severity

## Programme sequencing

This lane does not change RBAC implementation. In particular, it must not duplicate or weaken the authoritative Dispatch least-privilege work in Central PR #458. It is designed to expose current failures before #458 and then provide repeatable certification after the canonical RBAC fix is merged/deployed.

Final real-device truth remains separate: browser automation cannot certify scanner hardware behaviour, inexpensive Smart-TV firmware quirks, physical camera capture, Wi-Fi/power recovery or TV overscan.
