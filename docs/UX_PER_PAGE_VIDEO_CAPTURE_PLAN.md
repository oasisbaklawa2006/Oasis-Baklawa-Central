# Oasis Central — Per-page video capture plan (MOVE 9)

**Mission:** Evidence pack for **regression**, **training**, and **design review** — short clips, not hour-long dumps.

---

## Required interactions (every clip)

Each recording must intentionally show:

1. **Scrolling** — full vertical pass of primary content + any inner scroll region.  
2. **Filtering / searching** — at least one filter change or search query where applicable.  
3. **Modal open / close** — including **Escape** and **click-outside** if supported.  
4. **Keyboard usage** — Tab through primary controls **or** on-screen keyboard open for forms.  
5. **Approvals** — approve/deny path **read-only** demo if mutations disallowed.  
6. **Upload flow** — pick file + cancel + error toast (mock env if needed).  
7. **Sticky action behavior** — scroll until sticky header/footer engages; verify no overlap.  
8. **Mobile interactions** — rotate optional; include **pull** gesture only if app supports.

---

## Recording standards

| Rule | Detail |
|------|--------|
| Resolution | Match Playwright project viewport |
| Frame rate | 30fps sufficient |
| Length | **≤ 4 min** per clip (prefer 60–120s) |
| Audio | Off unless narrating |
| Cursor | Visible; move deliberately |
| Anonymize | No real customer PII; use staging |

---

## Naming standards

`audit-artifacts/videos/<route-slug>--<viewport>.webm`

Examples: `finance-board--iphone-14-pro.webm`, `operator-inbox--ipad.webm`

---

## Success checkpoints (global)

- [ ] No **page-level** horizontal scroll during clip unless demonstrating bug.  
- [ ] Primary CTA visible within **two** viewport heights on mobile.  
- [ ] Modal focus trap **obvious** (tab loops inside).  
- [ ] Sticky regions never cover active input.

---

## Clip catalog (expanded)

| File | Purpose | Critical interactions | Duration target | Checkpoints |
|------|---------|----------------------|-----------------|-------------|
| `login-flow--iphone-14-pro.webm` | Auth trust | focus, error, success | 60–90s | keyboard overlap |
| `finance-board--iphone-14-pro.webm` | Finance readability | filter, row, modal | 2–4 min | sticky, table scroll |
| `operator-inbox--iphone-14-pro.webm` | Throughput | thread switch, compose | 2–4 min | send bar, metadata |
| `dispatch-flow--ipad.webm` | Floor | scan, pack | 2–3 min | large taps |
| `order-lifecycle--iphone-14-pro.webm` | Clarity | timeline | 2–4 min | accordions |
| `approvals--iphone-se.webm` | Stress width | approve/deny | 2–3 min | SE viewport |
| `mobile-cart--iphone-14-pro.webm` | Checkout | qty, sticky total | 1–2 min | footer overlap |
| `quick-order--iphone-14-pro.webm` | Density | search, row | 2–3 min | nested scroll |
| `reports--desktop.webm` | Exec | filter, chart | 2–3 min | chart readability |

---

## Review cadence

| Cadence | Owner | Output |
|---------|-------|--------|
| Weekly | Design + Eng | 3 clips reviewed; issues → `UX_TRIAGE_MASTER_BOARD.md` |
| Per release | PM | Archive links in release notes |

---

## Links

- Regression policy: `docs/UX_REGRESSION_POLICY.md`  
- Operational review: `docs/UX_OPERATIONAL_WORKFLOW_REVIEW.md`
