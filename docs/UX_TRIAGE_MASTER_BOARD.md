# Oasis Central — UX triage master board

**Purpose:** Single backlog for human UX triage, fed by `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md`, `audit-artifacts/raw/*.json`, and `docs/UX_REFERENCE_LIBRARY/`.  
**Screenshot refs:** Prefer paths under `audit-artifacts/screenshots/<project>__<slug>.png` from the latest audit run (gitignored binaries; attach selectively to PRs when needed).

---

## How to use this board

1. Pull latest Playwright audit (`npm run test:ux-audit` + `npm run test:ux-audit:report`).
2. Copy a row into the right severity section; assign **ID** `UX-<SEVERITY>-###` (monotonic in repo edits).
3. Set **Owner** (role or person) and **Status**: `Open` | `In progress` | `Verified` | `Won't fix`.

### Row template (copy per issue)

| ID | Page | Screenshot reference | Severity | Viewport | Reproduction | Recommended fix | Owner | Status |
|----|------|----------------------|----------|----------|--------------|-----------------|-------|--------|
| UX-EXAMPLE-001 | `/example` | `audit-artifacts/screenshots/iphone-14-pro__example.png` | Critical | iPhone 14 Pro | … | … | TBD | Open |

---

## Critical

**Themes:** broken layouts, hidden actions, modal lock, unusable mobile controls, blocked workflows, unreadable tables, scrolling failures, keyboard traps.

| ID | Page | Screenshot reference | Severity | Viewport | Reproduction | Recommended fix | Owner | Status |
|----|------|----------------------|----------|----------|--------------|-----------------|-------|--------|
| _(none logged — populate from audit + manual QA)_ | | | | | | | | |

---

## High

**Themes:** spacing inconsistencies, mobile overflow, button hierarchy issues, poor visibility states, inconsistent cards, visual clutter, bad typography.

| ID | Page | Screenshot reference | Severity | Viewport | Reproduction | Recommended fix | Owner | Status |
|----|------|----------------------|----------|----------|--------------|-----------------|-------|--------|
| _(none logged — populate from audit + manual QA)_ | | | | | | | | |

---

## Medium

**Themes:** alignment, icon consistency, empty-state polish, hover/focus states, scrollbar polish, density inconsistencies.

| ID | Page | Screenshot reference | Severity | Viewport | Reproduction | Recommended fix | Owner | Status |
|----|------|----------------------|----------|----------|--------------|-----------------|-------|--------|
| _(none logged — populate from audit + manual QA)_ | | | | | | | | |

---

## Low

**Themes:** micro-animations, shadows, radius consistency, transition polish.

| ID | Page | Screenshot reference | Severity | Viewport | Reproduction | Recommended fix | Owner | Status |
|----|------|----------------------|----------|----------|--------------|-----------------|-------|--------|
| _(none logged — populate from audit + manual QA)_ | | | | | | | | |

---

## Links

- Automated evidence: `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md`
- Curated references: `docs/UX_REFERENCE_LIBRARY/README.md`
- Regression policy: `docs/UX_REGRESSION_POLICY.md`
