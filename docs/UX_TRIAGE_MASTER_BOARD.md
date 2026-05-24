# Oasis Central — UX triage master board

**Evidence sources:** `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md` (generated **2026-05-24T02:02Z** on latest crawl), `audit-artifacts/raw/raw-*.json`, `audit-artifacts/screenshots/`, `audit-artifacts/videos/*.webm`.  
**Rectification sprint (2026-05-20):** layout-only hardening shipped for finance release board, Admin Finance modals/queue strip, Quick Order / catalogue matrix, operator inbox live-region noise, cart safe-area + tap targets, global `focus-visible` for native controls. Re-verify dispatch and approvals routes on device.  
**PR #89 (merged):** `cursor/oasis-master-ux-rectification-9030` — master UX rectification (docs + TSX/CSS). **PR #90 (merged to `main`):** `cursor/ux-followup-dispatch-approvals-a11y-9030` — dispatch + packing-dispatch + dispatch-mgmt portrait layout, approvals on `AdminClients` / `/admin/approvals`, legal/intro/register tap + `aria-label`, failure/retry copy where touched; **Bugbot** duplicate quick-order quantity + push-to-floor confirm race **closed** in follow-up commit. **Post-merge:** Playwright UX audit re-run → merged report **10/10** heuristic; legal-page MEDIUM tap bullets no longer listed in report body — **VERIFY** against raw JSON if needed.

### Bugbot (PR #90 follow-up) — **CLOSED**

| Item | Status |
|------|--------|
| QuickOrder mobile + desktop duplicate `qty` state | **CLOSED** — quantity lifted in `QuickOrderTable` keyed by product id |
| Push-to-floor confirm cleared before `actingId` guard | **CLOSED** — in-flight ref + close modal on success only; no pre-clear of `pushConfirm` |
**MOVE 1 — Parsed audit signal:** Automated heuristics only detect **subset** of issues (overflow, wide tables, tap sampling, unnamed buttons, missing alt). Items below marked **Auto** come from JSON; **Watch** = operational priority pending human frame review (screenshot/video).

### Parsed dimensions (what automation covers vs not)

| Dimension | In raw / report? | Notes |
|-----------|------------------|--------|
| Horizontal overflow | `layout.horizontalOverflow` | No hits on latest crawl; still verify finance/dispatch tables visually |
| Clipping / nested scroll | Manual | Not auto-detected |
| Unreadable tables | `tables.anyWideOverflow` | No hits latest; verify wide grids in video |
| Sticky collisions / FAB overlap | Manual | Review videos at admin shell transitions |
| Spacing / density / clutter | Manual | Use `UX_VISUAL_CONSISTENCY_STANDARD.md` |
| Inaccessible actions | `a11y.buttonsMissingName`, tap &lt;44px sample | Partial |
| Broken modals / keyboard traps | Manual | Priority verify on finance / approvals |
| Typography / contrast | Manual | axe / design QA |
| Failed states | Manual | See `UX_FAILURE_STATE_LIBRARY.md` |
| Excessive scroll depth | Manual | Compare screenshot stack height |

---

## How to use

1. Run `npm run test:ux-audit` + `npm run test:ux-audit:report`.  
2. Never edit **severity** without re-checking screenshot + route.  
3. **Sprint bucket:** `A` critical mobile/overflow | `B` workflow/hierarchy | `C` a11y | `D` polish.

### Column definitions

| Column | Meaning |
|--------|---------|
| **UX ID** | Stable id `UX-<CAT>-###` |
| **Page / route** | Path |
| **Viewport** | `iphone-14-pro` / `iphone-se` / `ipad` / `desktop` / `all-mobile` |
| **Issue summary** | One line |
| **Operational impact** | Who hurts / how |
| **Screenshot / video** | Path under `audit-artifacts/` (gitignored) |
| **Severity** | CRITICAL / HIGH / MEDIUM / LOW |
| **Recommended fix** | UX-only direction |
| **Sprint bucket** | A–D |
| **Status** | `Open` `Verify` `In progress` `Done` `Won't fix` |

---

## CRITICAL

| UX ID | Page / route | Viewport | Issue summary | Operational impact | Screenshot / video reference | Severity | Recommended fix | Sprint bucket | Status |
|-------|--------------|----------|---------------|-------------------|------------------------------|----------|-------------------|---------------|--------|
| UX-CRT-001 | `/admin/finance-board` | `all-mobile` | **Watch:** dense finance grid on narrow width — verify readability & trapped scroll | Finance errors under pressure; mis-verify | `iphone-14-pro__admin_finance-board.png` + journey `ux-audit-...-iphone-14-pro.webm` | CRITICAL | Card/stack layout for mobile; table scroll inside pane only; sticky action bar audit | A | **Partially resolved** — production tab card fallback &lt; md, sticky thead desktop, load-error + retry, payment dialog scroll + footer grouping; **push-to-floor double-submit guard (PR #90)**; `/admin/finance`: modal sticky footers, safer queue strip; density **VERIFY** |
| UX-CRT-002 | `/admin/operator-inbox` | `all-mobile` | **Watch:** composer vs metadata density | Operator throughput, wrong send | `iphone-14-pro__admin_operator-inbox.png` + video | CRITICAL | Bottom composer; collapsible context; min 44px send | A | **Partially resolved** — removed duplicate filter `aria-live`; aligned sticky z + `isolate`; larger retry control; empty detail no `aria-live` spam |
| UX-CRT-003 | `/admin/dispatch` + `/admin/dispatch-mgmt` | `all-mobile` | **Watch:** floor use on phone portrait | Dispatch mistakes | `iphone-14-pro__admin_dispatch.png`, `...dispatch-mgmt.png` | CRITICAL | Tablet-first layout; scan-first row | A | **Partially resolved** — packing-dispatch: mobile cards + sticky actions, modal scroll + footer, load error + retry; dispatch-mgmt: skeleton/empty states, sticky scan/pack footer, touch-safe controls, `break-words`; human video PASS still recommended |

*Automation reported **zero** critical blockers; rows above are **mandatory verification** items from operational risk policy.*

---

## HIGH

| UX ID | Page / route | Viewport | Issue summary | Operational impact | Screenshot / video reference | Severity | Recommended fix | Sprint bucket | Status |
|-------|--------------|----------|---------------|-------------------|------------------------------|----------|-------------------|---------------|--------|
| UX-HIG-001 | `/admin/approvals` | `iphone-se` | **Watch:** approvals table → card parity | Approvers delay on phone | `iphone-se__admin_approvals.png` | HIGH | Mobile card list + sticky decision bar | A | **Partially resolved** — same surface as client governance: `md:hidden` card queue, desktop table, sheet max-height + scroll regions, sticky decision panel, grouped Approve/Reject, rejection reason textarea readability, list error + retry |
| UX-HIG-002 | `/quick-order` | `all-mobile` | **Watch:** dense SKU grid | Sales errors | `iphone-14-pro__quick-order.png` | HIGH | Row templates; sticky totals | A | **Partially resolved** — card layout &lt; md, desktop table, MOQ clarity, 44px qty controls, loading skeleton, **shared qty state** (mobile ↔ desktop); sticky totals still optional |
| UX-HIG-003 | `/admin/orders` + `/orders` | `all-mobile` | **Watch:** order detail timeline + actions | CS confusion | `iphone-14-pro__admin_orders.png`, `iphone-14-pro__orders.png` | HIGH | Timeline accordion; primary CTA dock | B | Verify |
| UX-HIG-004 | `/admin/packing-dispatch` | `ipad` | **Watch:** label / pack actions visibility | Warehouse delays | `ipad__admin_packing-dispatch.png` | HIGH | Large touch targets; single sticky footer | A | **Partially resolved** — aligned with UX-CRT-003 packing-dispatch work; verify on physical iPad |
| UX-HIG-005 | `/admin/target-vs-actual` | `desktop` | **Watch:** analytics density | Exec misread | `desktop__admin_target-vs-actual.png` | HIGH | Chart card grid; export clarity | B | Verify |

---

## MEDIUM (automation-backed + policy)

| UX ID | Page / route | Viewport | Issue summary | Operational impact | Screenshot / video reference | Severity | Recommended fix | Sprint bucket | Status |
|-------|--------------|----------|---------------|-------------------|------------------------------|----------|-------------------|---------------|--------|
| UX-MED-001 | `/privacy` | `iphone-14-pro`, `iphone-se`, `ipad` | **Auto:** ≥6 interactive controls &lt;44px min dimension (sampled) | Legal page still must be comfortable to read/sign | `iphone-14-pro__privacy.png` (×3 viewports) | MEDIUM | Increase link hit-padding; stack footer links | A | **Verify** — code + May 2026 crawl: **no** tap-target rows in merged report; spot-check `audit-artifacts/raw` if regressions suspected |
| UX-MED-002 | `/shipping` | `iphone-14-pro`, `iphone-se`, `ipad` | **Auto:** 7 undersized tap targets (sampled) | Post-purchase trust | `iphone-14-pro__shipping.png` | MEDIUM | Same as UX-MED-001 | A | **Verify** — same as UX-MED-001 |
| UX-MED-003 | `/terms` | `iphone-14-pro`, `iphone-se`, `ipad` | **Auto:** 6 undersized tap targets | Same | `iphone-14-pro__terms.png` | MEDIUM | Same | A | **Verify** — same as UX-MED-001 |
| UX-MED-004 | `/intro` | `all` | **Auto:** 3 visible `button` without text/`aria-label` | Screen reader / voice control | `iphone-14-pro__intro.png` | MEDIUM | Add `aria-label` or visible label | C | **Verify** — labels landed in code; confirm in raw JSON / SR spot-check |
| UX-MED-005 | `/register` | `all` | **Auto:** 2 unnamed visible buttons | Onboarding friction | `iphone-14-pro__register.png` | MEDIUM | Icon buttons labeled | C | **Verify** — same as UX-MED-004 |

---

## LOW

| UX ID | Page / route | Viewport | Issue summary | Operational impact | Screenshot / video reference | Severity | Recommended fix | Sprint bucket | Status |
|-------|--------------|----------|---------------|-------------------|------------------------------|----------|-------------------|---------------|--------|
| UX-LOW-001 | Global marketing pages | `all` | Micro rhythm: link row density on legal pages | Minor fatigue | same as `/terms` shots | LOW | Typography rhythm per `UX_VISUAL_CONSISTENCY_STANDARD.md` | D | **Partially resolved** — legal footers wrap with gap; full typography pass still optional |

---

## Issue count (this board)

| Category | Count |
|----------|-------|
| CRITICAL (verify debt) | 3 |
| HIGH (verify debt) | 5 |
| MEDIUM (automation-backed) | 5 — **Verify** (May 2026 merged report 10/10; prior tap-target bullets removed from report body) |
| LOW | 1 |
| **Total tracked** | **14** |

---

## Links

- Failure states: `docs/UX_FAILURE_STATE_LIBRARY.md`  
- Mobile matrix: `docs/UX_MOBILE_FIRST_AUDIT_MATRIX.md`  
- Roadmap: `docs/UX_IMPLEMENTATION_PRIORITY_ROADMAP.md`  
- Accessibility: `docs/UX_ACCESSIBILITY_ACTION_PLAN.md`  
- Regression: `docs/UX_REGRESSION_POLICY.md`  
- Post–PR #90 extraction: `docs/UX_POST_PR90_REMAINING_ISSUES.md`
