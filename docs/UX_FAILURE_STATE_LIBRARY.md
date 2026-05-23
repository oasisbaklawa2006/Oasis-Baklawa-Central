# Oasis Central — UX failure state library

**Purpose:** Define **expected** vs **current** behavior for non-happy paths so QA and design can align before pixels change.  
**Evidence:** Add screenshot paths from `audit-artifacts/screenshots/` when a state is reproduced (keep heavy files out of git per `docs/UX_REFERENCE_LIBRARY/README.md`).

---

## Library format (per category)

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| _(path or “pending”)_ | | | Low / Med / High / Crit | |

---

## Loading states

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Skeleton or spinner with context label; no layout shift into primary actions | _To be filled after audit + walkthrough_ | TBD | Users may duplicate actions or abandon slow screens |

---

## Empty states

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Clear headline, next step CTA, optional learn-more | _TBD_ | TBD | Wrong mental model of system health |

---

## Permission denied

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Explain role gap; link to request access or home | _TBD_ | TBD | Support load; perceived “broken app” |

---

## Failed uploads

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Inline error, retry, preserve form state | _TBD_ | TBD | Lost documents; finance/order delays |

---

## Disconnected state

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Offline banner; queue actions where safe | _TBD_ | TBD | Duplicate submissions; data distrust |

---

## Retry states

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Exponential backoff UI; non-blocking toast | _TBD_ | TBD | Operator thrash under flaky networks |

---

## No data

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Differentiate “zero rows” vs “error loading” | _TBD_ | TBD | False escalations to engineering |

---

## Long-text overflow

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Clamp with expand; preserve table readability | _TBD_ | TBD | Mis-read SO notes / customer names |

---

## Failed receipts

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Clear finance state + buyer messaging | _TBD_ | TBD | Revenue recognition risk |

---

## Stale records

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Timestamp + refresh; conflict modal on edit | _TBD_ | TBD | Wrong dispatch decisions |

---

## Mobile keyboard overlap

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Scroll focused field into view; avoid fixed CTAs covering inputs | _TBD_ | TBD | Cannot complete forms on phone |

---

## Drawer / modal clipping

| Screenshot placeholder | Expected behavior | Current behavior | Severity | Operational impact |
|------------------------|-------------------|------------------|----------|----------------------|
| TBD | Scrollable body; max height 100dvh; focus trap | _TBD_ | TBD | Blocked confirmations |

---

## Cross-links

- Mobile matrix: `docs/UX_MOBILE_FIRST_AUDIT_MATRIX.md`
- Operational flows: `docs/UX_OPERATIONAL_WORKFLOW_REVIEW.md`
