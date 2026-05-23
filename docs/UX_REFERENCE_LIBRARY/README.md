# UX reference library

## 1. Purpose

This folder is the **home for human-curated UX knowledge**: decisions, annotated flows, and follow-ups that sit **next to** automated evidence. It does not replace Playwright output; it **indexes and interprets** it for design and engineering.

Use it to:

- Record **approved** patterns and **rejected** directions with short rationale.
- Park **mobile** vs **desktop** notes and screenshots you deliberately keep in-repo (lightweight only).
- Document **flows** (step-by-step journeys) and **errors** (recurring console/network/UI failures).
- Capture **redesign-notes** for backlog and prioritization.

## 2. Artifact locations (generated, not committed by default)

After `npm run test:ux-audit` (see below), heavy artifacts live under **`audit-artifacts/`** at the repo root:

| Path | Contents |
|------|----------|
| `audit-artifacts/screenshots/` | Full-page PNGs per route and viewport (`<project>__<route-slug>.png`). |
| `audit-artifacts/videos/` | One session recording per viewport (`.webm`), copied from Playwright output with stable names. |
| `audit-artifacts/raw/` | `raw-<project>.json` — per-page console, failed requests, overflow/tap-target/a11y heuristics. |
| `audit-artifacts/html-report/` | Playwright HTML report (open locally in a browser). |
| `audit-artifacts/playwright-output/` | Traces, intermediate test output. |

These paths are **gitignored** (see root `.gitignore`) so clones stay small.

## 3. Folder structure (curated docs)

| Directory | Use |
|-----------|-----|
| `approved/` | Patterns and screens signed off for reuse. |
| `rejected/` | Explored options not taken; keep rationale. |
| `mobile/` | Mobile-specific notes or **small** reference images only. |
| `desktop/` | Desktop-specific notes or **small** reference images only. |
| `flows/` | Journey write-ups (e.g. login → cart → checkout). |
| `errors/` | Known failure modes, repro steps, links to issues. |
| `redesign-notes/` | Intentional redesign proposals and debt tracking. |

Each subdirectory has its own `README.md` as a placeholder; add real markdown files as the library grows.

## 4. Rule: heavy screenshots and videos stay out of git

- **Do not** commit raw Playwright screenshot folders or multi-megabyte `.webm` files unless there is an explicit exception.
- If something must live in git, **choose** a minimal set, **compress** images (e.g. reasonable resolution and format), and document **why** in the nearest `README.md` or the file’s header comment.

## 5. Rule: versioned automated evidence

**`docs/UX_AUDIT_PLAYWRIGHT_REPORT.md`** is the **single versioned** output of the merge script: executive summary, heuristic score, severity buckets, screenshot index, video table (when files exist locally), and commands. Regenerate it after audits with `npm run test:ux-audit:report` so the repo reflects the latest crawl you ran on your machine or in CI (if you wire that later).

## 6. How to generate the audit and report

```bash
npx playwright install chromium   # once per machine / CI image
npm run test:ux-audit             # crawls APP_URL / default Cursor Central URL; ~tens of minutes
npm run test:ux-audit:report      # rebuilds docs/UX_AUDIT_PLAYWRIGHT_REPORT.md from audit-artifacts/raw/
```

Optional: set `APP_URL` (or `BASE_URL`) for a different deployment:

```bash
APP_URL=https://your-preview.vercel.app npm run test:ux-audit
```

## 7. How to review videos and screenshots in Cursor

1. Run the audit so `audit-artifacts/` is populated.
2. In the **Explorer**, open `audit-artifacts/screenshots/` and click a `.png` — Cursor previews images inline.
3. Open `audit-artifacts/videos/*.webm` — Cursor can preview many video formats in-editor; if playback is limited, open the file with your OS viewer or drag the path into Chrome/VLC.
4. Open **`audit-artifacts/html-report/index.html`** in a local browser (`file://` or `npx playwright show-report audit-artifacts/html-report`) for Playwright’s trace-friendly UI.
5. Cross-check the **markdown tables** in `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md` for filenames and viewports.

## 8. Future improvement: per-page videos

Today, one **full-journey** video is recorded per viewport for the whole crawl. A useful upgrade would be **optional per-route clips** (e.g. behind an env flag) for critical flows only, to keep size manageable while improving evidence for regressions.
