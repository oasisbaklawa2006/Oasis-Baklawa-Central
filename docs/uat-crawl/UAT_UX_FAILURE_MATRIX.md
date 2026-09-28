# UI/UX Failure Matrix — Mandatory Appverse UAT Crawl

**Authority:** Mission Control physical UAT crawl Phase 2–4 (supplements functional correctness).  
**Rule:** Any UX criterion FAIL → **FAIL-ID** in `UAT_FAILURE_LEDGER.md`, even when underlying function technically works.  
**Evidence:** NO SCREENSHOT = NOT TESTED for that criterion.

Machine-readable criteria: [`ux-matrix.json`](./ux-matrix.json) (148 checks, sections A–T).

---

## Evaluation scope

For **every** UAT-ID / page / state in `UAT_ROUTE_CENSUS.json`:

1. Run functional crawl (Phase 3) where credentials and fixtures permit.
2. Run **all applicable** UX criteria below; mark N/A only when the page genuinely lacks the surface (e.g. no table → skip 101 with note).
3. Record PASS/FAIL per criterion with screenshot reference.
4. Emit UX failures with related test numbers, e.g. `UX-32/33`.

---

## Screenshot evidence (section U)

| Shot | Required capture |
|---|---|
| **S0** | Settled default page |
| **S1** | Primary menu / tab / filter opened |
| **S2** | Primary action / form / dialog opened |
| **S3** | Success or expected result after safe action **OR** exact blocked/error state |

Additional shots for every discovered visual defect. For FAIL shots: annotate defect location in manifest notes or provide exact coordinates/component name — **do not** edit pixels to hide evidence.

Filename pattern (extends visual crawl):

```
UAT-0001_<app>_<role>_<route-slug>_S0-default.png
UAT-0001_<app>_<role>_<route-slug>_S1-menu-open.png
UAT-0001_<app>_<role>_<route-slug>_S2-dialog-open.png
UAT-0001_<app>_<role>_<route-slug>_S3-result-or-error.png
```

---

## UX failure severity

| Severity | When to use |
|---|---|
| **P0** | Security/role leakage, wrong authority, dangerous destructive action, false-success state, financially/operationally incorrect data or action |
| **P1** | Primary workflow unusable/blocked, invisible controls/options, major responsive failure, impossible navigation, scanner/camera failure |
| **P2** | Meaningful confusion/friction, misleading copy/status, broken empty/error state, poor mobile interaction, significant accessibility defect |
| **P3** | Cosmetic consistency/spacing/icon/copy polish that does not block correct operation |

Failure ledger columns for UX rows add: **`UX-Refs`** (e.g. `32/33/36`), **`Evidence shots`** (S0–S3 + extras).

---

## Section A — PAGE ENTRY / ORIENTATION

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 1 | Correct page title, module name, role context and breadcrumb/return path are obvious within 3 seconds. | |
| 2 | User can tell what this page is for without prior knowledge. | |
| 3 | Primary action is visually dominant; destructive/secondary actions are not competing with it. | |
| 4 | No duplicate page/module names causing ambiguity. | |
| 5 | No legacy/demo/preview wording on production operational surfaces unless intentionally labelled. | |
| 6 | No dead-end page: every screen has an obvious next/back/home path. | |

## Section B — NAVIGATION / INFORMATION ARCHITECTURE

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 7 | Side/bottom/top navigation matches the logged-in role only. | |
| 8 | Active nav item is visibly highlighted. | |
| 9 | Browser/device Back returns to the expected previous state without data loss. | |
| 10 | Redirects do not flash forbidden/legacy pages. | |
| 11 | No duplicated routes exposing the same authority under different names unless explicitly redirected. | |
| 12 | Deep links land on the correct governed page and survive refresh. | |
| 13 | Tabs/sub-tabs remain understandable and preserve state where expected. | |
| 14 | Mobile bottom navigation never overlaps content or safe areas. | |
| 15 | Menus/drawers close predictably after selection. | |

## Section C — ROLE / AUTHORITY UX

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 16 | Forbidden modules are absent, not merely visually disabled, where policy requires hiding. | |
| 17 | If an action is unavailable by authority, explanation is explicit and truthful. | |
| 18 | No role sees War Room/CMD/Admin/Security Gate/Finance/Inventory surfaces outside its scope. | |
| 19 | Dispatch specifically sees only ready orders, pickup/readiness, packing detail, packing scan, dispatch recording/finalization. | |
| 20 | Security Gate remains independent of Dispatch. | |
| 21 | Buyer never sees internal operational fields or admin terminology. | |
| 22 | Staff do not see Buyer-only actions where not applicable. | |

## Section D — RESPONSIVE / LAYOUT

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 23 | Test required phone widths including iPhone-sized viewport, tablet, laptop/desktop, and TV where applicable. | |
| 24 | No horizontal clipping or accidental horizontal scroll. | |
| 25 | Cards/tables/controls do not overlap at narrow widths. | |
| 26 | Fixed headers/footers do not cover content. | |
| 27 | Safe-area insets respected around iPhone notch/home indicator. | |
| 28 | Long names/order numbers/company names wrap or truncate intentionally with access to full value. | |
| 29 | Tables remain usable on mobile: responsive cards, horizontal scroll, or deliberate compact layout. | |
| 30 | Modal/sheet content stays fully reachable with keyboard open. | |
| 31 | TV screens remain legible from distance; no tiny controls or interactive affordances on read-only TVs. | |

## Section E — STACKING / OVERLAY / PORTAL DEFECTS

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 32 | Open every Select, ComboBox, Popover, Tooltip, Dropdown, Context Menu, Dialog, Sheet and Drawer. | |
| 33 | Verify each appears ABOVE the parent surface and is not clipped by overflow containers. | |
| 34 | Verify overlay can be dismissed by expected methods without losing form state. | |
| 35 | Verify nested overlays do not trap focus or render behind parent overlays. | |
| 36 | **Specifically retest Buyer approval Pricing Slab + Account Manager inside Sheet (#481).** | |

## Section F — FORMS / DATA ENTRY

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 37 | Required vs optional fields are visually obvious before submission. | |
| 38 | Labels remain visible after typing; placeholders are not used as the only label. | |
| 39 | Correct keyboard type appears on mobile for phone/email/numeric fields. | |
| 40 | Numeric fields reject impossible/negative/non-numeric values safely. | |
| 41 | Date/time fields show timezone and format clearly where operationally important. | |
| 42 | Validation appears beside the actual bad field, not only as a generic toast. | |
| 43 | Validation wording explains how to correct the problem. | |
| 44 | Form errors preserve entered values unless security requires clearing. | |
| 45 | Submit button enable/disable state is understandable and updates immediately when requirements are met. | |
| 46 | Double-tap/double-click cannot create duplicate governed actions. | |
| 47 | Unsaved changes are protected or clearly discarded. | |
| 48 | Autofill/paste does not corrupt formatting. | |

## Section G — SEARCH / FILTER / SORT / PAGINATION

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 49 | Search returns correct results and clear zero-result state. | |
| 50 | Search input does not lag, clear unexpectedly, or hide selected filters. | |
| 51 | Applied filters are visibly represented and individually removable. | |
| 52 | 'Clear all' behaves correctly. | |
| 53 | Filter counts/results match displayed data. | |
| 54 | Sort indicator matches actual sort order. | |
| 55 | Pagination/infinite scroll does not duplicate or skip records. | |
| 56 | Returning from detail preserves useful list/filter position where practical. | |
| 57 | **Retest known B2B Dispatch filter empty-data case against expected production data.** | |

## Section H — LOADING / EMPTY / ERROR / RETRY STATES

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 58 | Every async page has a deliberate loading state; no frozen blank page. | |
| 59 | Skeleton/loading indicator does not imply false data. | |
| 60 | Empty state explains whether there is genuinely no data, a filter issue, or missing authority. | |
| 61 | Error state shows a useful user-safe message, not raw SQL/RPC/stack output. | |
| 62 | Retry control actually retries and recovers. | |
| 63 | Partial data failure is not presented as full success. | |
| 64 | Stale cached data is clearly distinguishable where operational decisions depend on freshness. | |
| 65 | Network/offline loss produces safe feedback and does not silently drop mutations. | |

## Section I — FEEDBACK AFTER ACTION

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 66 | Every click/tap that changes state gives immediate visible acknowledgement. | |
| 67 | Long-running operations show progress or working state. | |
| 68 | Success toast/banner confirms WHAT succeeded, not merely 'Success'. | |
| 69 | Failed mutation clearly remains failed; UI must not optimistically display a completed state after server rejection. | |
| 70 | Buttons cannot remain indefinitely spinning after request completion/failure. | |
| 71 | State change is reflected in all relevant badges/lists/timelines without manual reload where expected. | |
| 72 | Refresh does not revert a genuinely committed action. | |

## Section J — COPY / TERMINOLOGY / COMPREHENSION

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 73 | Use one canonical term for SO, PI, Invoice, DPL, Dispatch Clearance, Security Gate, etc. | |
| 74 | No conflicting terms like 'order complete' before dispatch/gate truth is complete. | |
| 75 | Buyer-facing copy is customer-safe and avoids internal implementation jargon. | |
| 76 | MOQ/carton guidance is actionable ('add X boxes to complete carton'), not punitive. | |
| 77 | Payment wording reflects 30% advance policy and governed calculation; UI does not locally invent finance amounts. | |
| 78 | Error messages tell user what to do next. | |
| 79 | Button labels describe the resulting action ('Approve & Activate', 'Submit for QC') rather than vague 'Save' where a governed transition occurs. | |

## Section K — VISUAL HIERARCHY / CONSISTENCY

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 80 | Typography hierarchy is consistent across equivalent screens. | |
| 81 | Font size remains readable on phone and TV. | |
| 82 | Contrast is sufficient for text, disabled states, badges and status colors. | |
| 83 | Status colors are consistent app-wide and never the sole source of meaning. | |
| 84 | Spacing/alignment is consistent; no accidental compressed/oversized gaps. | |
| 85 | Cards/buttons/input heights remain consistent for equivalent components. | |
| 86 | Icons match their action and are not ambiguous without labels where meaning is not obvious. | |
| 87 | No clipped logos, distorted images, broken thumbnails, missing product imagery, or unexpected placeholders. | |
| 88 | Long pages retain visual grouping and section boundaries. | |

## Section L — TOUCH / POINTER / KEYBOARD USABILITY

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 89 | Touch targets are comfortably tappable; flag targets below roughly 44x44 CSS px on primary mobile controls. | |
| 90 | Adjacent destructive/non-destructive buttons are not dangerously close. | |
| 91 | Hover-only information has a touch-accessible equivalent. | |
| 92 | Keyboard Tab order is logical on desktop. | |
| 93 | Enter/Space activates expected controls without accidental submission. | |
| 94 | Escape closes overlays appropriately. | |
| 95 | Focus indicator is visible. | |
| 96 | Focus returns sensibly after closing a dialog/sheet. | |

## Section M — ACCESSIBILITY / SEMANTICS

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 97 | Buttons/inputs have meaningful accessible names. | |
| 98 | Icon-only controls have aria-label/title equivalents. | |
| 99 | Form errors are associated with fields. | |
| 100 | Heading order is logical. | |
| 101 | Tables expose meaningful headers. | |
| 102 | Images have appropriate alt behavior; decorative images do not pollute screen-reader flow. | |
| 103 | Status differences are not communicated only by color. | |
| 104 | Zoom/text scaling to at least 200% must not hide critical controls on web surfaces. | |

## Section N — DATA TRUTH / OPERATIONAL TRUST

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 105 | Displayed order/customer/product/finance/stock data matches authoritative backend values for the chosen synthetic fixture. | |
| 106 | No placeholder/mock/demo numbers on operational screens. | |
| 107 | Currency, GST, units, dates and quantity formatting are correct. | |
| 108 | SO/PI/Invoice numbers are not silently fabricated by the frontend. | |
| 109 | No duplicate records caused by UI retries. | |
| 110 | Audit/event/timeline ordering is chronological and understandable. | |
| 111 | 'Ready', 'Approved', 'Paid', 'Packed', 'Dispatched', 'Released' labels reflect actual governed state, not inferred UI state. | |
| 112 | Sensitive IDs/secrets/internal diagnostic payloads are not exposed unnecessarily. | |

## Section O — MODULE-SPECIFIC BUYER UX

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 113 | Welcome/login/access request/approval-pending/session expiry flows are obvious and recoverable. | |
| 114 | Buyer Dashboard: account status, wallet, pending amount, SO-ready advance, PI/final-payment, documents, statement, delays, banners, quick actions all render without contradiction. | |
| 115 | Catalogue: category/filter/search/product detail/favorites/quick buy work with MOQ/carton guidance. | |
| 116 | Cart: carton completion guidance, multi-item quantities, totals, and checkout authority are clear. | |
| 117 | Orders: list/detail/golden pipeline/status/timeline/reorder are coherent. | |
| 118 | Account: profile/company/employees/transporter/documents/settings remain usable on mobile. | |
| 119 | Support: ticket/general enquiry states are understandable and communication history is readable. | |

## Section P — MODULE-SPECIFIC CENTRAL / FACTORY / DISPATCH

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 120 | Central Order Pool has one obvious authority path and no duplicate War Room ambiguity. | |
| 121 | Finance screens separate review, payment, PI/final invoice, DPL receipt, dispatch clearance and gate release clearly. | |
| 122 | Factory/HOD queues show what is awaiting action vs blocked vs complete without needing hidden knowledge. | |
| 123 | RGS/3PGS/P&A screens show stock/shortage/booking/handover truth clearly. | |
| 124 | Packing scan surfaces identify carton/order/current progress and scan errors unambiguously. | |
| 125 | Dispatch recording shows exactly what remains before completion. | |
| 126 | Gate screen shows independent release truth and cannot be mistaken for Dispatch action. | |

## Section Q — TRACE / SCANNER UX

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 127 | Scanner gives immediate feedback for valid, duplicate, wrong-order, wrong-stage and offline scans. | |
| 128 | Offline queue count and retry state are visible. | |
| 129 | Duplicate scan does not look like a new successful event. | |
| 130 | Camera permission denied/granted states are understandable. | |
| 131 | Manual barcode fallback, where permitted, is discoverable and governed. | |
| 132 | Scan timeline clearly distinguishes device time/server time if relevant. | |

## Section R — AI STUDIO / MEDIA UX

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 133 | Create/edit/approval states clearly distinguish draft vs approved vs published. | |
| 134 | AI-generated fields are visibly reviewable/correctable before governed acceptance. | |
| 135 | Media upload/camera progress, failure, retry and completed storage state are visible. | |
| 136 | Image preview corresponds to the exact product/variant being edited. | |
| 137 | No failed enhancement/upload is shown as successful. | |
| 138 | Physical camera orientation/crop/retake/permission flows are usable on phone. | |

## Section S — TV / READ-ONLY UX

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 139 | TV pages are actually non-interactive/read-only. | |
| 140 | Priority/blinker/color semantics are understandable from viewing distance. | |
| 141 | Orders/SO/dispatch schedule/expected-today information fit without clipping. | |
| 142 | Automatic refresh does not reset to blank or stale silently. | |
| 143 | No admin buttons/inputs appear on TV routes. | |

## Section T — PERFORMANCE AS UX

| # | Criterion | PASS/FAIL |
|---:|---|---|
| 144 | Flag pages with visibly excessive first meaningful render time. | |
| 145 | Flag controls where tap-to-feedback feels delayed or duplicates due to repeated taps. | |
| 146 | Large tables/lists should remain scrollable without severe jank. | |
| 147 | Images should not cause layout shift that moves controls after initial render. | |
| 148 | Modal/dropdown opening should be immediate and stable. | |

---

## Manifest schema (per UAT-ID)

Each row in `UAT_MANIFEST.jsonl` includes:

```json
{
  "uxStatus": "NOT-TESTED | PARTIAL | PASS | FAIL | BLOCKED",
  "uxEvidence": {
    "s0": "relative/path.png",
    "s1": null,
    "s2": null,
    "s3": null
  },
  "uxCriteriaTotal": 148,
  "uxCriteriaEvaluated": 0,
  "uxCriteriaPassed": 0,
  "uxCriteriaFailed": 0,
  "uxCriteriaBlocked": 0,
  "uxFailures": []
}
```

`uxFailures` entries:

```json
{
  "failId": "FAIL-UX-481-001",
  "uxRefs": "32/33/36",
  "severity": "P0",
  "summary": "Pricing Slab Select renders behind Sheet",
  "screenshots": ["S2", "extra-overlay.png"]
}
```

---

## Mission Control review rule

Every screenshot tranche is posted in **strict UAT-ID order**. Mission Control independently inspects each screenshot for additional failures not marked by the crawler and appends them to the same failure ledger **before remediation begins**.

---

## Pre-registered UX failures (physical evidence)

| FAIL-ID | UAT-ID | UX-Refs | Severity | Summary |
|---|---|---|---|---|
| FAIL-UX-481-001 | UAT-0068 | 32/33/36 | **P0** | Pricing Slab Select portal z-index behind Sheet — options invisible on phone |
| FAIL-UX-481-002 | UAT-0068 | 17/36 | **P1** | Account Manager select empty due to mixed-case role filter |

Functional duplicate rows remain as FAIL-481-001/002 until UX crawl re-confirms post-fix.
