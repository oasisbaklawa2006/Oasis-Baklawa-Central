# Oasis Central — UX regression policy

**Purpose:** Turn the Playwright UX crawl into an **operational visual QA and regression prevention** habit without bloating git with binaries.

---

## When audits must run

| Trigger | Minimum scope |
|---------|----------------|
| Weekly (scheduled) | Full `npm run test:ux-audit` against production-like URL + `npm run test:ux-audit:report` |
| Before release tag | Full audit on target deploy URL |
| Large UI PR (admin shell, tables, inbox, finance) | Same viewport matrix; spot-check affected routes via manual list in PR |
| Hotfix touching layout / z-index / forms | At least **iphone-14-pro** + **desktop** projects for touched routes |

---

## PR requirements

1. **Describe visual change** — area, breakpoints, before/after intent.  
2. **Link evidence** — optional: 1–3 **compressed** screenshots in PR body (not committed unless explicitly approved).  
3. **Accessibility** — if interactive controls change, state focus/keyboard behavior in PR text.  
4. **No-merge if** — see below.

---

## Screenshot comparison policy

- **Default:** Do not commit raw Playwright PNG/WebM to the repo (see `.gitignore`).  
- **Optional CI later:** Pixel-diff or snapshot tests must use **small, named fixtures** and live outside default audit artifact folders.  
- **PR review:** Prefer Cursor preview of local `audit-artifacts/screenshots/` paths pasted in comments.

---

## Mobile audit requirement

Any PR that changes **navigation**, **global layout**, **tables**, **modals**, or **forms** must include either:

- Automated audit notes for **iphone-14-pro** in PR description, or  
- Explicit reason why mobile is out of scope (rare).

---

## No-merge conditions (UX gate)

**Hard stops for merge (until addressed or waived by UX owner):**

- New **horizontal page-level overflow** on iPhone 14 Pro for a primary route.  
- **Primary action** not reachable without scroll past unrelated content on mobile.  
- **Modal lock** (cannot dismiss / cannot scroll to primary button).  
- **Tap targets < 44px** on a primary action introduced by the PR.  
- **Regression** in `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md` showing new **HTTP 5xx** on document load for a touched route.

**Soft stops (should be ticketed before next release if not fixed in PR):**

- New unnamed icon-only buttons in high-traffic flows.  
- Empty states without next-step CTA.

---

## Accessibility checks

- Heuristic audit already flags missing `alt` and unnamed `button` (see raw JSON).  
- **Stretch:** add axe-core job later; until then, manual keyboard pass on touched flows.

---

## Operational-flow checks

- For PRs touching order/finance/dispatch/inbox: author links to the relevant section in `docs/UX_OPERATIONAL_WORKFLOW_REVIEW.md` and states what was manually verified.

---

## Failure-state checks

- If PR changes uploads, auth, or realtime surfaces: author confirms behavior against `docs/UX_FAILURE_STATE_LIBRARY.md` categories touched.

---

## Mandatory screenshots / videos

- **Weekly audit:** full crawl produces screenshots + per-viewport journey video (see `tests/ux-audit.spec.ts`).  
- **Release:** attach **HTML report** zip or link from CI artifact storage (not git).  
- **Optional per-page videos:** roadmap in `docs/UX_PER_PAGE_VIDEO_CAPTURE_PLAN.md`.

---

## Related documents

- Master triage: `docs/UX_TRIAGE_MASTER_BOARD.md`  
- Executive snapshot: `docs/UX_EXECUTIVE_STATUS_SNAPSHOT.md`  
- Reference library: `docs/UX_REFERENCE_LIBRARY/README.md`
