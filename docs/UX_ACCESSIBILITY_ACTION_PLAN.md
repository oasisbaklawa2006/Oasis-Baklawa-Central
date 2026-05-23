# Oasis Central — Accessibility action plan (MOVE 6)

**Scope:** UX / markup / focus behavior only — **no** business-logic changes.  
**Mandatory priority surfaces:** **operator inbox**, **finance board**, **approvals** (policy).

---

## Priority matrix

| Surface | Tab order | Focus rings | Keyboard shortcuts | Sticky focus traps | SR labels | aria-live | Modal focus return | Table readability | Contrast | Touch a11y |
|---------|-----------|-------------|--------------------|--------------------|-----------|-----------|-------------------|-------------------|----------|------------|
| Finance board | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| Operator inbox | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| Approvals | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| Dispatch | VERIFY | VERIFY | OPTIONAL | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |
| Quick order | VERIFY | VERIFY | OPTIONAL | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY |

---

## Audit checklist (per PR touching UI)

### Tab order

- [ ] Tab sequence follows visual order on **mobile** and **desktop**.  
- [ ] No `tabindex` > 0 except rare modals (prefer roving tabindex in complex widgets).

### Focus rings

- [ ] `:focus-visible` visible on **all** interactive elements (shadcn defaults where possible).  
- [ ] No `outline-none` without replacement ring.

### Keyboard shortcuts

- [ ] Documented in PR if added; never single-key destructive without modifier.  
- [ ] `/` search etc. must not steal focus from inputs.

### Sticky focus traps

- [ ] Only **one** trap active (open modal).  
- [ ] Sticky headers do not intercept focus to content below (verify with Tab from top).

### Screen-reader labels

- [ ] Icon-only buttons have **`aria-label`**.  
- [ ] Nav landmarks (`nav`, `main`, `aside`) preserved.

### aria-live

- [ ] Toasts: `polite` default; `assertive` only for true errors.  
- [ ] No chatty live regions (finance row hover spam).

### Modal focus return

- [ ] On close, focus returns to trigger control.  
- [ ] Escape closes + restores.

### Table readability

- [ ] `<th scope="col">` on data tables where applicable.  
- [ ] Row headers for multi-line finance tables when feasible.

### Contrast

- [ ] Text vs background **≥ 4.5:1** for body; **≥ 3:1** large headings (WCAG AA target).  
- [ ] Status chips not color-only (icon + text).

### Touch accessibility

- [ ] Min **44×44px** hit targets on mobile primary/secondary (aligns with Playwright tap heuristic).  
- [ ] Spacing between destructive and primary ≥ 8px.

---

## Tooling roadmap (non-breaking)

1. Add **@axe-core/playwright** optional project targeting `/login`, `/admin/finance-board`, `/admin/operator-inbox`, `/admin/approvals`.  
2. CI: informational job first; promote to gate after baseline clean.

---

## Links

- Triage (includes unnamed button findings): `docs/UX_TRIAGE_MASTER_BOARD.md`  
- Regression policy: `docs/UX_REGRESSION_POLICY.md`
