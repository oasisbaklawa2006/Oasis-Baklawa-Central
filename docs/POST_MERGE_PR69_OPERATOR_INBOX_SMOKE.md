# Post-merge smoke — Operator Inbox (PR #69)

**Merge:** PR #69 merged into `main` (saved views, local notes, CSV export, read-only UX hardening).

**Local CI (this sprint):** On current `main`, `npm run typecheck` and `npm run build` completed successfully. Browser checks below are **manual** and should be run in staging or production preview with a real admin session.

## Manual checklist

Use `/admin/operator-inbox` (or the route your app registers for the operator inbox).

- [ ] **Page load:** `/admin/operator-inbox` loads without a blank screen or unhandled error overlay.
- [ ] **List:** Packets render in the list (virtualized rows visible, scroll works).
- [ ] **Detail:** Selecting a packet opens detail / thread view as expected.
- [ ] **Search focus:** Press `/` — filter search receives focus (when not typing in another field per shortcut rules).
- [ ] **Esc behavior:** With search text, **Esc** clears search; with search empty and insights open, **Esc** collapses insights; no conflict while typing in inputs/textareas (except filter search where intended).
- [ ] **j / k:** Move selection up/down when focus is not on interactive controls (buttons, links, note textarea, etc.).
- [ ] **Saved views:** Save a named view, apply it, delete it — filters and display toggles restore as expected.
- [ ] **Local notes:** Enter a note for a packet, refresh the page — note still present (localStorage).
- [ ] **CSV export:** Export CSV — file downloads; row count matches **currently visible** filtered list (not a hidden full dataset).
- [ ] **Failed-message panel:** Panel shows read-only failed operator outbound context only; no edits from the panel.
- [ ] **Mobile:** Narrow viewport — layout stacks sensibly; sticky chrome and panels usable.
- [ ] **Network:** No recurring **PostgREST 400** or **406** errors in devtools for inbox queries.
- [ ] **Select shape:** No “missing column” / schema mismatch errors from Supabase selects used by the inbox.
- [ ] **Existing write tools unchanged:** Reply / classify / route actions still call the same three Edge functions as before (no new `functions.invoke` from PR #69 scope).

## Notes

- Saved views, notes, and CSV are **client-only** features; smoke failures there usually indicate localStorage, focus, or bundling issues—not database drift.
- If migrations or Edge functions are intentionally frozen, treat any new DB or invoke failures as **out of scope** for this checklist and escalate separately.
