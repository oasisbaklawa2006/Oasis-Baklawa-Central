# Oasis Central — Executive UX status snapshot (MOVE 10)

**As-of:** Aligns with latest committed `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md` + triage board **2026-05** closure sprint.

---

## Top 10 UX blockers (prioritized)

1. **Finance board mobile density** — verify PASS/WARN; revenue-critical.  
2. **Operator / WhatsApp composer vs metadata** — wrong-send risk.  
3. **Dispatch on portrait phone** — operational mis-tap risk.  
4. **Quick order grid** — SKU error risk on SE.  
5. **Approvals queue on narrow width** — decision latency.  
6. **Cart sticky checkout vs keyboard** — checkout drop-off.  
7. **Reports charts on mobile** — exec misread.  
8. **Legal pages tap targets** (`/terms`, `/privacy`, `/shipping`) — automation MEDIUM.  
9. **Unnamed buttons** (`/intro`, `/register`) — accessibility debt.  
10. **Modal / sticky interaction debt (unverified)** — policy until disproven by video review.

---

## Operational UX maturity

| Dimension | Score (1–5) | Notes |
|-----------|-------------|-------|
| Workflow documentation | **4** | `UX_OPERATIONAL_WORKFLOW_REVIEW.md` now concrete |
| Failure-state clarity | **3** | Library expanded; product copy not yet wired |
| Role-specific optimization | **2** | Finance/inbox/dispatch still “verify” |

---

## Mobile operational readiness

| Area | Status |
|------|--------|
| Automated crawl | **Strong** |
| Heuristic signal | **Sparse** (few auto flags — legal + intro/register) |
| Human verification | **Required** for finance/inbox/dispatch |

**Summary:** **Operational mobile readiness = “verify before declare PASS”** for core admin surfaces.

---

## Accessibility maturity

| Area | Status |
|------|--------|
| Heuristic audit | **Live** |
| axe / CI | **Not wired** |
| Priority checklist | **Published** (`UX_ACCESSIBILITY_ACTION_PLAN.md`) |

**Score:** **2.5 / 5** until axe baseline exists.

---

## Workflow friction score (qualitative)

| Score | Meaning |
|-------|---------|
| **6 / 10** | Usable for expert operators on desktop; mobile admin still high-friction without mitigations |

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

1. **Layout-only:** legal pages tap padding; intro/register `aria-label`.  
2. **Finance board:** mobile read/act split prototype (UI-only branch).  
3. **axe** smoke on four routes (tooling only).

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
