# Oasis Central — Executive UX status snapshot

**As-of:** Generated with the UX audit closure sprint (see `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md` timestamp after last `npm run test:ux-audit:report`).  
**Audience:** Product, design, engineering leads — **non-binding** engineering estimates; this is a **maturity and risk** snapshot.

---

## Current maturity

| Area | Maturity (1–5) | Notes |
|------|----------------|-------|
| Automated crawl + screenshots | **4** | Four viewports, full route list, raw JSON, merge report |
| Stale-metrics safety | **5** | Navigation failures no longer attach prior-page DOM metrics |
| Human triage process | **2** | Boards seeded; owners and statuses need population |
| Visual consistency enforcement | **2** | Standard documented; adoption is manual |
| Accessibility | **2** | Heuristics only; axe/keyboard pass not wired |

---

## Biggest UX risks

1. **Wide finance / operations tables** on mobile — horizontal cognitive load even when technically “contained.”  
2. **Concurrent sticky regions** (nav + table toolbar + FAB) — collision risk on short viewports.  
3. **Icon-only controls** without labels — flagged by audit heuristics; real-world screen reader risk.  
4. **Failure-state ambiguity** — users cannot tell **empty** vs **error** without careful copy (see failure library).

---

## Biggest operational UX blockers

- **Finance verification** under time pressure with dense tabular data on **iPhone SE** class devices.  
- **Operator / WhatsApp** throughput when metadata competes with composer on small screens.  
- **Dispatch packing** flows that depend on **precision taps** while wearing gloves / using tablets in portrait.

---

## Strongest UX areas

- **Marketing / catalogue** surfaces: strong imagery and relatively simple vertical scroll.  
- **Auth shell** patterns: consistent entry via `/login` with predictable redirects (per audit crawl behavior).  
- **Tooling maturity:** reproducible audit pipeline is now a **shared language** for UX regressions.

---

## Mobile readiness

- **Good:** Most routes render without navigation failure on emulated devices.  
- **Watch:** Tap-target clustering on legal/static pages (`/terms`, `/privacy`, `/shipping`) per recent heuristic deductions.  
- **Next:** Fill `docs/UX_MOBILE_FIRST_AUDIT_MATRIX.md` with `OK` / `Risk` from human spot checks.

---

## Accessibility maturity

- **Heuristic:** missing `alt`, unnamed `button` counts in raw JSON.  
- **Gap:** No automated axe in CI; no structured screen reader script.

---

## Audit maturity

- **Repeatable commands:** `npm run test:ux-audit`, `npm run test:ux-audit:report`.  
- **Artifacts:** gitignored binaries + versioned markdown report.  
- **Gap:** Per-page short videos and optional pixel-diff not implemented (see video plan).

---

## Operational workflow maturity

- **Documented** workflows in `docs/UX_OPERATIONAL_WORKFLOW_REVIEW.md` — content is **skeleton** until staffed.  
- **Gap:** No role-based “sign-off checklist” wired to releases yet.

---

## Visual consistency maturity

- **Standard** defined in `docs/UX_VISUAL_CONSISTENCY_STANDARD.md`.  
- **Gap:** No lint or Storybook enforcement; relies on PR discipline.

---

## Next safest UX sprint (recommended)

1. Populate **triage board** with top 10 items from latest `UX_AUDIT_PLAYWRIGHT_REPORT.md` + finance/inbox manual pass.  
2. Implement **per-page video** spec for **login + finance-board** only (short CI opt-in).  
3. Add **axe-core** smoke on `/login` + `/admin/finance-board` (accessibility-only scope).

---

## What must not regress

- **No horizontal page-level scroll** on iPhone 14 Pro for primary admin dashboards introduced as “fixed.”  
- **No reduction** of tap target size on primary actions in mobile flows.  
- **Navigation failure correctness** — never reintroduce stale DOM metrics for failed `goto` (`tests/ux-audit.spec.ts`).  
- **Git hygiene** — do not commit raw `audit-artifacts/` screenshots/videos by default.

---

## Links

- Triage: `docs/UX_TRIAGE_MASTER_BOARD.md`  
- Regression policy: `docs/UX_REGRESSION_POLICY.md`  
- Reference library: `docs/UX_REFERENCE_LIBRARY/README.md`
