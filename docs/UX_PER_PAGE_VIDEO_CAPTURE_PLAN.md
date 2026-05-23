# Oasis Central — Per-page video capture plan

**Purpose:** Complement the **single full-journey** `.webm` per viewport (today) with **short, named recordings** for critical flows — easier review in PRs and training.  
**Storage:** `audit-artifacts/videos/` (gitignored); promote only compressed clips if ever committed by exception.

---

## Planned recordings

### login-flow.webm

| Field | Detail |
|-------|--------|
| **Purpose** | Validate auth shell, errors, redirect, keyboard on mobile |
| **Critical interactions** | Email/password focus, submit, failed login, success redirect |
| **Expected duration** | 45–90s |
| **Mandatory checkpoints** | Error copy readable; no keyboard overlap; tap targets ≥44px on submit |

---

### finance-board.webm

| Field | Detail |
|-------|--------|
| **Purpose** | Finance verification readability and horizontal scroll containment |
| **Critical interactions** | Open row, verify/reject path (non-mutating recording if possible), scroll wide table inside pane |
| **Expected duration** | 2–4 min |
| **Mandatory checkpoints** | Sticky context visible; destructive actions behind confirm |

---

### operator-inbox.webm

| Field | Detail |
|-------|--------|
| **Purpose** | Inbox density, thread scroll, composer safety |
| **Critical interactions** | Select thread, scroll long body, focus composer, attach (if applicable) |
| **Expected duration** | 2–4 min |
| **Mandatory checkpoints** | Send not obscured; no double FAB collision |

---

### dispatch-flow.webm

| Field | Detail |
|-------|--------|
| **Purpose** | Floor-friendly layout for packing/dispatch |
| **Critical interactions** | Lane change, label print path (read-only demo), search |
| **Expected duration** | 2–3 min |
| **Mandatory checkpoints** | Large hit targets; table scroll isolated |

---

### order-lifecycle.webm

| Field | Detail |
|-------|--------|
| **Purpose** | Buyer order detail vs admin order view consistency |
| **Critical interactions** | Timeline expand, receipt area, status chips |
| **Expected duration** | 2–4 min |
| **Mandatory checkpoints** | Long text clamps; mobile card stacking |

---

### approvals.webm

| Field | Detail |
|-------|--------|
| **Purpose** | Approvals list + detail on small screens |
| **Critical interactions** | Approve/deny affordances, reason capture |
| **Expected duration** | 1–3 min |
| **Mandatory checkpoints** | Confirmation modals complete on SE viewport |

---

### mobile-cart.webm

| Field | Detail |
|-------|--------|
| **Purpose** | Cart math readability, sticky checkout |
| **Critical interactions** | Qty stepper, remove line, navigate to checkout |
| **Expected duration** | 1–2 min |
| **Mandatory checkpoints** | Sticky summary not covering inputs |

---

### quick-order.webm

| Field | Detail |
|-------|--------|
| **Purpose** | Dense SKU entry UX on mobile |
| **Critical interactions** | Row add, search, submit |
| **Expected duration** | 2–3 min |
| **Mandatory checkpoints** | Row height usable; no horizontal page scroll |

---

### reports.webm

| Field | Detail |
|-------|--------|
| **Purpose** | Charts + tables on tablet/desktop |
| **Critical interactions** | Filter change, scroll chart card, export (if any) |
| **Expected duration** | 2–3 min |
| **Mandatory checkpoints** | Chart legends legible; table overflow contained |

---

## Implementation roadmap (engineering)

1. Add **optional** Playwright project or env flag `UX_PER_PAGE_VIDEO=1` that runs a **small** spec file with `test.describe` per clip (avoid multi-hour CI by default).  
2. Output files named exactly as above into `audit-artifacts/videos/`.  
3. CI uploads artifacts; never commit raw `.webm` without compression + approval.

---

## Related

- Policy: `docs/UX_REGRESSION_POLICY.md`  
- Operational flows: `docs/UX_OPERATIONAL_WORKFLOW_REVIEW.md`
