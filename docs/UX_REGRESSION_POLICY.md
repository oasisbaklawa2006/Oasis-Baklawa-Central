# Oasis Central — UX regression policy (MOVE 8)

**Goal:** **No silent mobile regressions** — any merge that can affect layout, forms, tables, or navigation on phones must leave an **evidence trail**.

---

## Mandatory before merge (author checklist)

Authors **must** attach or link (CI artifact, PR comment, or ticket):

| Artifact | Requirement |
|----------|-------------|
| **Mobile screenshots** | At least **iphone-14-pro** (390×844) for **each** touched route |
| **Desktop screenshots** | **1440×900** (or project default) for same routes when layout differs |
| **Failure-state screenshots** | If PR touches uploads, auth, payments, dispatch — one **error** + one **empty** path |
| **Interaction recording** | Short `.webm` or Loom **optional** for complex flows; **mandatory** if PR touches modal focus or sticky bars |
| **Accessibility smoke** | Tab through touched flow OR note “a11y unchanged” with reason |
| **Finance-board audit** | Required if any file under finance board / finance release paths changes |
| **Operator inbox audit** | Required if operator inbox / WhatsApp UI paths change |

**No silent mobile regressions:** If mobile screenshot set is missing, **UX owner may block merge** per release policy even if CI is green.

---

## PR size gates

| Change type | Minimum evidence |
|-------------|------------------|
| Global layout / shell | Mobile + desktop + 30s video |
| Table / data grid | Horizontal scroll containment proof |
| Form / wizard | Keyboard open screenshot on iOS-sized viewport |
| Copy-only | Screenshots optional |

---

## When full Playwright UX crawl must run

- Weekly schedule (see ops calendar).  
- Before **release tag**.  
- After any PR labeled `area:admin-shell` or `area:finance-ui`.

Commands: `npm run test:ux-audit` → `npm run test:ux-audit:report`.

---

## No-merge conditions (recap + additions)

**Hard stop:**

- New **page-level** horizontal scroll on `iphone-14-pro` for primary route.  
- Primary CTA **hidden** behind unrelated scroll on mobile.  
- Modal cannot dismiss / cannot reach primary button.  
- New **icon-only** destructive control on mobile without `aria-label`.

**Soft stop (ticket before release):**

- Increased unnamed `button` count on touched page (see raw JSON heuristic).

---

## Accessibility gate

- Follow `docs/UX_ACCESSIBILITY_ACTION_PLAN.md` checklist for priority surfaces.

---

## Links

- Video standards: `docs/UX_PER_PAGE_VIDEO_CAPTURE_PLAN.md`  
- Triage: `docs/UX_TRIAGE_MASTER_BOARD.md`
