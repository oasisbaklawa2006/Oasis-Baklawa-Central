# Oasis Central — UX implementation priority roadmap (MOVE 11)

**Principles:** Surgical PRs; **UX / layout / a11y only** unless separately approved. Branch prefix suggestions are **non-binding**.

**Progress (2026-05-20):** PR **#89** merged (`cursor/oasis-master-ux-rectification-9030`). Follow-up **dispatch + approvals + legal/intro/register** work targets branch `cursor/ux-followup-dispatch-approvals-a11y-9030` — layout/a11y/docs only; no Supabase migrations or Edge edits.

---

## Phase A — Critical mobile stabilization

| Item | Risk | Operational impact | Implementation difficulty | Regression sensitivity | Suggested branch prefix | Notes |
|------|------|--------------------|-----------------------------|-------------------------|-------------------------|-------|
| Finance board mobile read/act layout | High | Mis-verify / delay | Medium–High | **High** | `ux/finance-board-mobile-` | |
| Operator inbox composer dock | High | Wrong send | Medium | **High** | `ux/operator-inbox-layout-` | |
| Dispatch single-column scan mode | High | Mis-pick | Medium | High | `ux/dispatch-mobile-` | **Partially shipped** — packing-dispatch + dispatch-mgmt portrait/sticky/modal pass; dedicated “scan mode” spec still optional |
| Legal pages tap padding (`/terms`,`/privacy`,`/shipping`) | Medium | Trust / fatigue | Low | Low | `ux/legal-tap-` | **Shipped** — 44px-class targets + `focus-visible`; re-audit to confirm |
| Overflow containment audit (manual fixes) | Medium | Horizontal scroll | Medium | High | `ux/overflow-` | |

---

## Phase B — Workflow simplification & hierarchy

| Item | Risk | Operational impact | Implementation difficulty | Regression sensitivity | Suggested branch prefix | Notes |
|------|------|--------------------|-----------------------------|-------------------------|-------------------------|-------|
| Approvals card queue | Medium | Approver time | Medium | Medium | `ux/approvals-cards-` | **Partially shipped** — client governance / `/admin/approvals` mobile cards + sticky decision sheet |
| Quick order row accordion | Medium | SKU errors | Medium | Medium | `ux/quick-order-` | |
| Order detail timeline accordion | Medium | CS confusion | Medium | Medium | `ux/order-timeline-` | |
| Spacing normalization vs standard | Low | Visual trust | Low–Medium | Medium | `ux/spacing-pass-` | |

---

## Phase C — Accessibility & keyboard

| Item | Risk | Operational impact | Implementation difficulty | Regression sensitivity | Suggested branch prefix | Notes |
|------|------|--------------------|-----------------------------|-------------------------|-------------------------|-------|
| `aria-label` for intro/register icon buttons | Medium | SR users blocked | Low | Low | `a11y/icon-labels-` | **Shipped** for reported controls; axe smoke still recommended |
| axe-core Playwright smoke project | Low | Prevents regressions | Medium | Low | `chore/axe-smoke-` | |
| Modal focus return audit | Medium | Keyboard traps | Medium | High | `a11y/modal-focus-` | |
| Table `scope` / headers pass | Low | SR table nav | Medium | Medium | `a11y/table-scope-` | |

---

## Phase D — Animation & premium polish

| Item | Risk | Operational impact | Implementation difficulty | Regression sensitivity | Suggested branch prefix |
|------|------|--------------------|-----------------------------|-------------------------|-------------------------|
| Motion reduction respect (`prefers-reduced-motion`) | Low | Comfort | Low | Low | `ux/motion-` |
| Shadow/radius alignment pass | Low | Brand consistency | Low | Low | `ux/visual-polish-` |
| Micro-interactions on success paths | Low | Delight | Low | Low | `ux/micro-motion-` |

---

## Dependency order

```text
A (mobile critical) → B (workflow) → C (a11y) → D (polish)
         ↘ early win: legal tap + aria labels (subset of A+C)
```

---

## Success metrics

| Metric | Target |
|--------|--------|
| WARNING → PASS (matrix) | ≥ 8 cells cleared per sprint |
| MEDIUM triage items | −50% count |
| axe critical violations | 0 on priority routes |

---

## Links

- Triage IDs: `docs/UX_TRIAGE_MASTER_BOARD.md`  
- Mobile matrix: `docs/UX_MOBILE_FIRST_AUDIT_MATRIX.md`  
- Regression: `docs/UX_REGRESSION_POLICY.md`
