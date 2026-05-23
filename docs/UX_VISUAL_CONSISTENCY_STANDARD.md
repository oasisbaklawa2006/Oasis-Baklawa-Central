# Oasis Central — Visual consistency standard

**Purpose:** A **single north star** for spacing, elevation, type, and interaction so admin and buyer surfaces feel like one premium product. This is a **design contract** for UX work; implementation should follow existing Tailwind/shadcn tokens where possible.

**Aesthetic pillars**

- **Luxury minimal** — generous whitespace, restrained color, one hero action per view where practical.  
- **Operational clarity** — dense data is allowed **only** inside tables with clear hierarchy and sticky context.  
- **Metro / Lumia inspiration** — flat planes, crisp typography, bold section headers, subtle motion.  
- **Bateel-style premium** — deep neutrals, gold accents used sparingly for “celebration” states, packaging-quality imagery on marketing surfaces.

---

## Spacing scale

| Token use | Rem | Usage |
|-----------|-----|--------|
| `2`–`3` | 8–12px | Inline icon gaps, chip padding |
| `4` | 16px | Default component padding |
| `6` | 24px | Card interior comfortable |
| `8` | 32px | Section separation |
| `12+` | 48px+ | Page gutters (mobile tighter than desktop) |

**Rule:** Prefer **8px grid**; avoid arbitrary `7px`/`13px` unless fixing optical alignment.

---

## Card shadows

- **Resting:** `shadow-sm` or flat with hairline border (`border`) — default admin cards.  
- **Raised / interactive:** `shadow-md` on hover only for clickable cards.  
- **Modal / drawer:** `shadow-lg` on overlay surface only.  
- **No double-shadow** (card inside card both elevated).

---

## Radius

- **Cards / inputs:** `rounded-md` (default) or `rounded-lg` for marketing.  
- **Pills / chips:** `rounded-full`.  
- **Tables:** square corners on inner cells; rounded container only.

---

## Typography hierarchy

| Level | Role | Guidance |
|-------|------|----------|
| H1 | Page title | One per route; sentence case |
| H2 | Section | Clear scan pattern |
| H3 | Subsection / card title | Truncate with tooltip if long |
| Body | Primary reading | 16px min on mobile for forms |
| Caption | Meta / timestamps | Muted color; never sole carrier of critical state |

---

## Button hierarchy

1. **Primary** — one primary per viewport region (e.g. sticky footer bar).  
2. **Secondary** — outline or ghost for alternate safe actions.  
3. **Tertiary** — text link style for low-risk navigation.  
4. **Destructive** — always paired with confirmation; never only icon on mobile.

---

## Icon sizes

- **Inline with text:** 16–18px (`h-4 w-4` / `h-5 w-5`).  
- **Touch-leading controls:** min **44×44px** hit area (padding counts).  
- **Empty / marketing:** up to 48px; not mixed in dense tables without alignment grid.

---

## Modal widths

- **Mobile:** full-bleed sheet or bottom sheet preferred over centered micro-modal.  
- **Desktop:** `max-w-lg` for forms; `max-w-3xl` for wide tables with horizontal scroll inside modal body only.

---

## Table density

- **Comfortable default** for finance/ops: row height ≥ **40px**, zebra optional.  
- **Compact** only on secondary analytics; must expose toggle or user preference later.  
- **Horizontal scroll** contained to table element — never whole-page sideways scroll.

---

## Sticky header rules

- Sticky **page** header: max one primary bar; include wayfinding (title or breadcrumb).  
- Sticky **table** header: only when table body scrolls; z-index below modals.  
- Avoid stacked stickies (double height) on mobile.

---

## Color semantics

| Semantic | Use |
|----------|-----|
| Primary | Brand actions, links |
| Muted | Secondary labels |
| Destructive | Irreversible / reject |
| Warning | Attention without stop |
| Success | Completed / verified |
| Info | Neutral system messages |

---

## Danger / warning / success styles

- Always pair **color + icon + text** for accessibility.  
- Do not rely on red/green alone for finance states.

---

## Focus ring standard

- Visible `:focus-visible` ring on all interactive elements (keyboard).  
- Ring color contrasts on both light/dark shells.

---

## Mobile spacing

- **16px** minimum horizontal page gutter on phones.  
- **Safe area** insets respected (`env(safe-area-inset-*)`) on sticky footers.

---

## Drawer behavior

- Enter/exit motion < **250ms**; no blocking animation on open.  
- Focus trap while open; restore focus to trigger on close.  
- Scroll **inside** drawer body, not the page behind.

---

## Implementation note

Document targets here; **map to Tailwind classes and shadcn variants** when opening UI PRs. Deviations require a one-line rationale in the PR description.
