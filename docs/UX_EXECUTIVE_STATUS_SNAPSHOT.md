# Oasis Central — Executive UX status snapshot (MOVE 10)

**As-of:** Aligns with `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md` + triage board **2026-05-24**, **plus PR #89 merged** and **follow-up dispatch/approvals/legal a11y** work on branch `cursor/ux-followup-dispatch-approvals-a11y-9030` (same calendar window).

---

## Top 10 UX blockers (prioritized)

1. **Finance board mobile density** — **improved** on `/admin/finance-board` + `/admin/finance` (modals, queue strip); still verify dispatch-adjacent flows on smallest phones.  
2. **Operator / WhatsApp composer vs metadata** — **partially mitigated** (live region, sticky stack, retry target); composer density still **verify**.  
3. **Dispatch on portrait phone** — **partially mitigated** in code (packing-dispatch + dispatch-mgmt: cards, sticky footers, modal containment, empty/load/retry); **still verify** on floor hardware / smallest phones.  
4. **Quick order grid** — **improved** (cards &lt; md, skeleton, tap targets); sticky totals still optional.  
5. **Approvals queue on narrow width** — **partially mitigated** (`AdminClients` / `/admin/approvals`: mobile cards, sticky decision area, clearer reject path); **still verify** with real approver workflow.  
6. **Cart sticky checkout vs keyboard** — **partially mitigated** (safe-area bottom padding, larger line qty controls, wrap names); full checkout keyboard pass still **verify**.
7. **Reports charts on mobile** — exec misread.  
8. **Legal pages tap targets** (`/terms`, `/privacy`, `/shipping`) — **addressed in code** (`min-h-11`, stacked/wrapped footer, `focus-visible`); automation should be re-run to clear JSON flags.  
9. **Unnamed buttons** (`/intro`, `/register`) — **addressed in code** (`aria-label`s, larger targets); re-crawl TBD.  
10. **Modal / sticky interaction debt (unverified)** — policy until disproven by video review.

---

## Operational UX maturity

| Dimension | Score (1–5) | Notes |
|-----------|-------------|-------|
| Workflow documentation | **4** | `UX_OPERATIONAL_WORKFLOW_REVIEW.md` now concrete |
| Failure-state clarity | **3.75** | Dispatch + approvals surfaces now include skeleton / empty / error + retry where touched; library unchanged |
| Role-specific optimization | **3** | Dispatch + approvals layouts improved in code; inbox / reports still primary verify debt |

---

## Mobile operational readiness

| Area | Status |
|------|--------|
| Automated crawl | **Strong** |
| Heuristic signal | **Sparse** (few auto flags — legal + intro/register) |
| Human verification | **Still required** for end-to-end inbox send and **video sign-off** on dispatch/approvals after layout changes — fewer MEDIUM automation items pending re-crawl |

**Summary:** **Core finance + quick-order + dispatch + approvals + legal/intro/register surfaces improved in code;** operational declaration of PASS still needs **floor + approver** video sign-off and refreshed automation JSON.

---

## Accessibility maturity

| Area | Status |
|------|--------|
| Heuristic audit | **Live** |
| axe / CI | **Not wired** |
| Priority checklist | **Published** (`UX_ACCESSIBILITY_ACTION_PLAN.md`) |

**Score:** **3 / 5** — global `focus-visible`; legal + intro + register tap/`aria-label` pass in code; axe baseline still not wired.

---

## Workflow friction score (qualitative)

| Score | Meaning |
|-------|---------|
| **5 / 10** | Finance + quick order + dispatch + approvals less hostile on phone; legal/intro/register MEDIUM items cleared in code; inbox density still primary friction |

---

## Regression risk

| Risk | Level |
|------|-------|
| Silent mobile layout break | **High** if policy ignored |
| Table overflow regression | **Medium** |
| Accessibility regression | **Medium** |

**Mitigation:** `UX_REGRESSION_POLICY.md` mandatory artifacts.

---

## Strongest UX modules

- **Buyer catalogue / marketing** vertical flows — simpler mental model.  
- **Auth entry** — consistent `/login` shell in crawl.  
- **Audit tooling** — reproducible evidence.

---

## Weakest UX modules

- **Finance + inbox** combined density + speed expectation.  
- **Dispatch** on smallest phones.  
- **Reports** on mobile.

---

## Next safest implementation sprint

1. **Full Playwright UX audit** at next major checkpoint (~20 commands) — not rerun this follow-up sprint by policy.  
2. **Operator inbox** composer + metadata — density pass.  
3. **Reports** mobile chart readability.  
4. **axe** smoke on priority routes (tooling).  
5. Re-run **UX audit JSON** to confirm legal/intro/register heuristics cleared.

---

## What must not regress

- Stale-metrics safety in `tests/ux-audit.spec.ts`.  
- Gitignored heavy artifacts policy.  
- No page-level horizontal scroll **fixes** that re-break tables inside modals.

---

## Oasis Central — operationally production-usable today?

**Desktop-first expert operators:** **Yes, with training** — core admin routes render; automated crawl shows **no** critical/heuristic blockers beyond listed MEDIUM items.  
**Mobile-first operational use (finance/dispatch/inbox on phone):** **Conditional** — treat as **pilot / verify** until human video review clears **WARNING** rows in `UX_MOBILE_FIRST_AUDIT_MATRIX.md`.

---

## Links

- Roadmap: `docs/UX_IMPLEMENTATION_PRIORITY_ROADMAP.md`  
- Triage: `docs/UX_TRIAGE_MASTER_BOARD.md`
