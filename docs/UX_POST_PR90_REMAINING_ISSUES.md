# Post–PR #90 — remaining UX issues (extracted)

This note ties together the **latest merged Playwright UX report** and the **live triage board**. It does not replace `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md` or raw crawl JSON under `audit-artifacts/` (gitignored).

---

## 1. Audit date / source

| Field | Value |
|--------|--------|
| **Report file** | `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md` |
| **Generated (UTC)** | **2026-05-24T02:02:05.494Z** |
| **Crawl target** | `https://cursor-central-vercel.vercel.app` (see report header) |
| **Tooling** | `@playwright/test` via `playwright.ux-audit.config.ts`; report merged by `scripts/merge-ux-audit-report.mjs` |
| **Detailed heuristics** | Per-page counts live in `audit-artifacts/raw/raw-<viewport>.json` (not committed) |

---

## 2. What improved after PR #89 / PR #90

| Area | PR / work | Outcome |
|------|-----------|---------|
| Finance + inbox + cart + quick-order foundations | **#89** | Finance board / finance modals, quick-order layout, inbox live-region noise, cart safe-area, global `focus-visible` patterns |
| Dispatch + packing + dispatch-mgmt portrait UX | **#90** | Mobile cards/tables, sticky actions, modal containment, empty/load/error + retry where wired |
| Approvals (`/admin/approvals` / `AdminClients`) | **#90** | Mobile card queue, sheet scroll regions, decision grouping, rejection readability |
| Legal / intro / register | **#90** | ≥44px-class tap targets, `aria-label`s, focus-visible rings |
| **Bugbot follow-ups** | **#90** | (1) **Shared quick-order quantity** across mobile + desktop rows. (2) **Push-to-floor confirm** guarded (no early `pushConfirm` clear; in-flight ref; modal closes on success only). |
| **Merged audit narrative** | **Post-merge crawl** | Heuristic summary moved to **10 / 10**; explicit **MEDIUM** tap-target bullets for `/terms`, `/privacy`, `/shipping` **removed from the report body** (they no longer appear in the merged “Medium polish” list). |

---

## 3. Remaining automated issues (report-level)

From **`docs/UX_AUDIT_PLAYWRIGHT_REPORT.md`** after the May 2026 refresh:

| Class | Count in report narrative | Notes |
|-------|----------------------------|--------|
| **CRITICAL blockers** | **0** | “_(none detected by automated thresholds)_” |
| **HIGH severity** | **0** | “_(none above noise threshold)_” |
| **MEDIUM (listed inline)** | **0** | Section points to “per-page” / raw JSON for *minor* residual signal. |
| **Overall heuristic score** | **10 / 10** | Still explicitly *not* WCAG-complete. |

**Caveat:** Console noise, failed XHR/document responses, and fine-grained tap/alt/button heuristics remain **aggregated in raw JSON**, not fully expanded in the markdown report. Treat “0 listed” as **no threshold violations in the merged summary**, not a claim of zero DOM issues everywhere.

---

## 4. Remaining human-review issues (triage board)

Aligned with **`docs/UX_TRIAGE_MASTER_BOARD.md`** — rows that are still **VERIFY**, **PARTIAL**, or policy **Watch**:

| Bucket | Count | Examples |
|--------|-------|------------|
| **CRITICAL — partial / verify** | **3** | UX-CRT-001 finance-board density & scroll; UX-CRT-002 operator inbox composer vs metadata; UX-CRT-003 dispatch floor portrait (code improved — **video sign-off** still recommended) |
| **HIGH — verify** | **2** | UX-HIG-003 order list/detail timeline + actions; UX-HIG-005 target-vs-actual density |
| **HIGH — partial** | **3** | UX-HIG-001 approvals (layout improved — approver workflow verify); UX-HIG-002 quick-order (sticky totals optional); UX-HIG-004 packing-dispatch on **physical iPad** |
| **MEDIUM — confirm** | **5** | UX-MED-001–005: code landed; triage still asks for **automation / spot-check confirmation** against fresh raw JSON where needed |
| **LOW — partial** | **1** | UX-LOW-001 legal typography rhythm (optional polish pass) |

**Total triage rows:** **14** (unchanged count; statuses are mostly **PARTIAL** or **VERIFY**, not “Open” blockers).

---

## 5. Highest-risk pages / modules (video or manual review)

Operational **policy watchlist** even when automation is quiet:

1. **`/admin/finance-board`** + **`/admin/finance`** — mis-verify risk under time pressure.  
2. **`/admin/operator-inbox`** + **`/admin/whatsapp`** — wrong-send risk; composer vs context density.  
3. **`/admin/dispatch`**, **`/admin/dispatch-mgmt`**, **`/admin/packing-dispatch`** — floor mistakes on smallest phones; confirm with **device video**, not screenshots alone.  
4. **`/cart`** — sticky checkout vs keyboard / FAB overlap (matrix still flags VERIFY cells).  
5. **`/admin/target-vs-actual`** + **`/sales/dashboard`** — exec misread on narrow widths.  
6. **`/admin/approvals`** — approver hierarchy and reject path under real data.

---

## 6. Mobile-specific remaining concerns

- **Sticky / keyboard overlap:** Not reliably auto-detected; verify on real phones for **cart**, **inbox**, and **admin shell** transitions.  
- **iPhone SE (375×667):** Highest stress width for admin tables that still have desktop fallbacks.  
- **`docs/UX_MOBILE_FIRST_AUDIT_MATRIX.md`:** Many cells remain **WARNING** / **VERIFY** until human PASS is recorded — automation clearing in the report does **not** automatically downgrade matrix policy flags.

---

## 7. Accessibility remaining concerns

- **axe-core / CI:** Still not wired; report states full WCAG audit was **not** performed.  
- **Keyboard + screen reader:** Dedicated pass still outstanding for dense admin surfaces and modals.  
- **Icon-only controls** elsewhere in the app: continue incremental `aria-label` work beyond intro/register/legal.  
- **Modal focus return:** Listed on roadmap as a focused audit item.

---

## 8. Recommended next sprint (safest closure order)

1. **Operator inbox / WhatsApp** (UX-CRT-002) — single high-churn module; layout-only options (composer dock, collapsible metadata) without touching message pipeline logic.  
2. **Order detail + orders list** (UX-HIG-003) — bounded routes; timeline accordion + primary CTA dock pattern.  
3. **Tooling:** **axe** Playwright smoke on 4–6 priority routes (docs-only prep acceptable; implementation is test wiring).  
4. **Cart mobile** — keyboard overlap + sticky bar verification after inbox/orders if capacity remains.  
5. **Re-run raw JSON diff** after each sprint to prove heuristic deltas (keep `audit-artifacts/` gitignored).

---

## Links

- `docs/UX_AUDIT_PLAYWRIGHT_REPORT.md`  
- `docs/UX_TRIAGE_MASTER_BOARD.md`  
- `docs/UX_EXECUTIVE_STATUS_SNAPSHOT.md`  
- `docs/UX_MOBILE_FIRST_AUDIT_MATRIX.md`  
- `docs/UX_IMPLEMENTATION_PRIORITY_ROADMAP.md`
