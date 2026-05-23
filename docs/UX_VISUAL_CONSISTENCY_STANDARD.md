# Oasis Central — Visual consistency standard (MOVE 7)

**North star:** **Luxury operational UI** — calm, legible under stress, Metro/Lumia structure (flat planes, crisp type), **Bateel-style** premium restraint (gold accents rare), **minimal density** with **controlled** information density in tables.

---

## Exact spacing scale (4px base)

| Token | px | rem | Use |
|-------|----|-----|-----|
| `0.5` | 2 | 0.125rem | Hairline adjustments only |
| `1` | 4 | 0.25rem | Icon-text gap |
| `2` | 8 | 0.5rem | Tight inline groups |
| `3` | 12 | 0.75rem | Chip padding |
| `4` | 16 | 1rem | **Default** component padding |
| `5` | 20 | 1.25rem | Comfortable field spacing |
| `6` | 24 | 1.5rem | Card interior |
| `8` | 32 | 2rem | Section gap |
| `10` | 40 | 2.5rem | Major section |
| `12` | 48 | 3rem | Page vertical rhythm |
| `16` | 64 | 4rem | Hero / marketing only |

**Mobile page gutter:** `px-4` (16px) minimum; `max-w-*` containers keep **16px** side inset on phones.

---

## Exact radius scale

| Token | rem | px (16 root) | Use |
|-------|-----|--------------|-----|
| `rounded-sm` | 0.125rem | 2px | Tags (rare) |
| `rounded-md` | 0.375rem | 6px | **Default** inputs, buttons, inner cards |
| `rounded-lg` | 0.5rem | 8px | Outer cards, modals |
| `rounded-xl` | 0.75rem | 12px | Featured cards |
| `rounded-2xl` | 1rem | 16px | Marketing panels only |
| `rounded-full` | — | — | Avatars, pills |

---

## Exact shadow scale

| Token | CSS gist | Use |
|-------|----------|-----|
| `shadow-none` + `border` | hairline | **Default admin** surfaces |
| `shadow-sm` | subtle lift | Hoverable **card** (optional) |
| `shadow-md` | medium | **Dropdown / popover** |
| `shadow-lg` | large | **Modal / drawer** shell only |
| `shadow-xl` | extra | **Avoid** in admin (too glossy) |

**Rule:** One elevation winner per viewport region (no stacked `shadow-lg`).

---

## Button variants (hierarchy)

| Variant | When | Notes |
|---------|------|------|
| `default` | Single primary action in region | Max one per sticky footer |
| `secondary` / `outline` | Alternate safe path | |
| `ghost` | Tertiary navigation | |
| `destructive` | Irreversible | Always with confirm; never icon-only on mobile |
| `link` | Inline text actions | |

---

## Table row density

| Mode | Min row height | Padding |
|------|----------------|---------|
| **Comfortable (default)** | 40px | `py-2.5` + `px-3` |
| **Compact (opt-in)** | 32px | `py-1.5` + `px-2` — only with user toggle |

**Horizontal scroll:** **only** inside `<table>` wrapper, never `body`.

---

## Mobile padding

| Context | Rule |
|---------|------|
| Page | `px-4` min |
| Sticky footer | `pb-[calc(env(safe-area-inset-bottom)+12px)]` |
| FAB | Clear **72px** vertical clearance from nav |

---

## Sticky behavior

1. **Max one** primary sticky bar (app chrome OR in-page toolbar, not both full-width without height budget).  
2. z-index: `modal` > `popover` > `sticky-header` > `content`.  
3. Sticky must not cover focused inputs — scroll-into-view on focus.

---

## Card hierarchy

| Level | Style |
|-------|-------|
| L1 Page | flat / bordered |
| L2 Section | `rounded-lg` + `border` |
| L3 Nested | `rounded-md` + muted bg — **no** second heavy shadow |

---

## Typography scale (Tailwind-aligned)

| Role | Classes (indicative) | Notes |
|------|----------------------|-------|
| Display | `text-3xl md:text-4xl font-semibold tracking-tight` | Marketing only |
| H1 | `text-2xl font-semibold` | One per screen |
| H2 | `text-xl font-semibold` | |
| H3 | `text-lg font-medium` | Card titles |
| Body | `text-sm md:text-base` | Admin dense; **16px min** on buyer forms |
| Caption | `text-xs text-muted-foreground` | Never sole state indicator |

---

## Icon spacing

- Inline: **8px** gap (`gap-2`) between icon and label.  
- Touch row: icon box **40–44px** with padding to hit **44px** total.

---

## Danger / success / warning semantics

| Semantic | Pair |
|----------|------|
| Danger | `destructive` + icon + text |
| Warning | amber chip + icon + text |
| Success | green chip + icon + text |
| Info | neutral + icon |

**Never** color-only for finance state.

---

## Enforcement

- PRs cite this doc section when changing spacing/shadows.  
- Deviations need **one-line** rationale + screenshot in PR.

---

## Links

- Regression: `docs/UX_REGRESSION_POLICY.md`  
- Roadmap: `docs/UX_IMPLEMENTATION_PRIORITY_ROADMAP.md`
