# Oasis Central — Executive UX status snapshot (MOVE 10)

**As-of:** Aligns with `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md` + triage board **2026-05-24** (post rectification sprint).

---

## Top 10 UX blockers (prioritized)

1. **Finance board mobile density** — **improved** on `/admin/finance-board` + `/admin/finance` (modals, queue strip); still verify dispatch-adjacent flows on smallest phones.  
2. **Operator / WhatsApp composer vs metadata** — **partially mitigated** (live region, sticky stack, retry target); composer density still **verify**.  
3. **Dispatch on portrait phone** — unchanged this sprint (out of scope for touched files); **still verify**.  
4. **Quick order grid** — **improved** (cards &lt; md, skeleton, tap targets); sticky totals still optional.  
5. **Approvals queue on narrow width** — **unchanged** (route still `/admin/approvals` → legacy surface); **verify**.  
6. **Cart sticky checkout vs keyboard** — **partially mitigated** (safe-area bottom padding, larger line qty controls, wrap names); full checkout keyboard pass still **verify**.
7. **Reports charts on mobile** — exec misread.  
8. **Legal pages tap targets** (`/terms`, `/privacy`, `/shipping`) — automation MEDIUM.  
9. **Unnamed buttons** (`/intro`, `/register`) — accessibility debt.  
10. **Modal / sticky interaction debt (unverified)** — policy until disproven by video review.

---

## Operational UX maturity

| Dimension | Score (1–5) | Notes |
|-----------|-------------|-------|
| Workflow documentation | **4** | `UX_OPERATIONAL_WORKFLOW_REVIEW.md` now concrete |
| Failure-state clarity | **3.5** | Library expanded; finance board + quick order now surface empty / error / skeleton states in touched surfaces |
| Role-specific optimization | **2.5** | Finance release + finance tower + quick order improved; dispatch / approvals still verify |

---

## Mobile operational readiness

| Area | Status |
|------|--------|
| Automated crawl | **Strong** |
| Heuristic signal | **Sparse** (few auto flags — legal + intro/register) |
| Human verification | **Still required** for dispatch, approvals, and end-to-end inbox send — fewer blockers on finance / quick order |

**Summary:** **Core finance + quick-order mobile surfaces improved in code;** operational declaration of PASS still needs dispatch + approvals video sign-off.

---

## Accessibility maturity

| Area | Status |
|------|--------|
| Heuristic audit | **Live** |
| axe / CI | **Not wired** |
| Priority checklist | **Published** (`UX_ACCESSIBILITY_ACTION_PLAN.md`) |

**Score:** **2.75 / 5** — global `focus-visible` for links/buttons; more `aria-label` on cart / quick order; axe baseline still not wired.

---

## Workflow friction score (qualitative)

| Score | Meaning |
|-------|---------|
| **5.5 / 10** | Finance + quick order less hostile on phone; admin shell sticky classes tightened; dispatch / approvals friction unchanged |

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

1. **Dispatch + packing** portrait hardening (layout-only).  
2. **Approvals** surface audit — confirm route owns “approvals” UX or split page.  
3. **axe** smoke on four routes (tooling only).  
4. Legal / intro / register automation items (UX-MED-001–005).

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
