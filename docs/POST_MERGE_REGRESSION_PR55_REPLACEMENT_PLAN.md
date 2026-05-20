# Post-merge regression: PR #55 replacement plan

This document describes a **clean replacement** for draft PR [#55](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/55) after hardened Playwright finance E2E guards landed in [#64](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/64). It is planning only: no implementation steps are executed here.

---

## 1. Current #55 status

| Attribute | Value |
|-----------|--------|
| State | **Draft** |
| GitHub mergeability | **Mergeable** (`mergeable: MERGEABLE`, clean merge state vs `main` at last check) |
| Primary change | Adds **`tests/post-merge-regression.spec.ts`** (single new file, ~366 lines) |

The file defines a serial Playwright suite: buyer catalogue → cart → SO → receipt → finance board → operations → RBAC checks.

---

## 2. Why #55 must not merge as-is

1. **Duplicates helpers already on `main` from #64**  
   The spec inlines logic that matches (or nearly matches) `tests/e2e-helpers.ts`: login, delivery address, cart readiness, catalogue drill-down, add-to-cart retry, diagnostics, and finance-board RBAC assertion. That duplicates maintenance and can drift from the canonical helpers.

2. **Unsafe `TEST_PREVIEW_URL` handling**  
   The branch uses a module-level default such as `process.env.TEST_PREVIEW_URL || "http://localhost:3000"`. Post-#64, preview URL resolution is **lazy**, **required** when used, and guarded by a **safe hostname allowlist** (with an explicit escape hatch only when intentionally enabled). #55 does not enforce that contract.

3. **Hardcoded fallback credentials**  
   Default emails and passwords for buyer, finance, sales, and operations encourage accidental runs against the wrong environment with predictable secrets. Post-#64 patterns require **explicit** credentials for mutation flows (no defaults for buyer/finance).

4. **No `ALLOW_FINANCE_E2E_MUTATIONS` gate**  
   Buyer, finance, and operations steps mutate real preview state (orders, receipts, finance actions, floor release). On `main`, those flows are gated so they do not run unless operators set **`ALLOW_FINANCE_E2E_MUTATIONS=true`**. #55 omits that gate.

5. **Likely stale finance UI assumptions**  
   #55’s finance path references controls such as **“Approve Credit”** / **“Credit approved”**, while the hardened golden pipeline on `main` aligns with **“Verify”** / **“Payment verified”** and FIN-003-related UI. Merging #55 as-is risks a **failing or misleading** spec relative to current Orders / Finance UI.

---

## 3. What to preserve from #55

- **Intent**: A named **post-merge production regression** suite that documents how to exercise the full pipeline after merges.
- **Structure**: **`test.describe.configure({ mode: "serial" })`** so buyer → finance → operations share state (e.g. order prefix).
- **Coverage shape**:
  - Buyer: catalogue → cart → SO → receipt → order survives refresh (or equivalent assertions).
  - Finance: board, receipt visibility, verification/release steps consistent with current UI.
  - Operations: `/admin/operations` and line-level fields when the order is visible.
  - RBAC: sales blocked from finance board; **unauthenticated** checks for sensitive admin routes remain **safe and non-mutating** (navigation + redirect / blocked assertions only).

---

## 4. Replacement implementation plan

1. **Branch from latest `main`**  
   Start a new branch from **`origin/main`** after #64 (and any follow-up fixes), not by layering edits on top of the old #55 file without a rebase.

2. **Add `tests/post-merge-regression.spec.ts`**  
   Reintroduce the suite as **one spec file** that **imports** from **`./e2e-helpers`** instead of copying helper bodies.

3. **Preview URL**  
   Use **`getPreviewUrl()`** (and related helpers) from `e2e-helpers.ts` so hostname allowlist and required `TEST_PREVIEW_URL` behavior stay centralized.

4. **Mutation gate**  
   Before any step that creates orders, uploads receipts, or performs finance/operations actions, require **`ALLOW_FINANCE_E2E_MUTATIONS === "true"`** (same pattern as `golden-pipeline-qa.spec.ts` / finance-gap specs: `test.skip` or thrown guard consistent with repo convention).

5. **Credentials**  
   Require **explicit** env for:
   - `TEST_BUYER_EMAIL` / `TEST_BUYER_PASSWORD`
   - `TEST_FINANCE_EMAIL` / `TEST_FINANCE_PASSWORD`
   - Operations: **`TEST_OPS_EMAIL`** / **`TEST_OPS_PASSWORD`** (or whatever names `e2e-helpers` standardizes; align with existing env naming on `main`—no hardcoded defaults).

   Sales RBAC: require **`TEST_SALES_EMAIL`** / **`TEST_SALES_PASSWORD`** when that test runs, matching “no default credentials” policy.

6. **Reuse buyer + finance flows**  
   Prefer **`buyerCreateSubmittedOrderWithReceiptUpload`** (or the minimal sequence of exported helpers) for the buyer leg so catalogue/cart logic is not forked. Align finance steps with **`golden-pipeline-qa.spec.ts`** (Verify / Payment verified, tabs, cards) so FIN UI assumptions match production UI.

7. **Unauthenticated RBAC tests**  
   Keep them **read-only**: `page.goto` to admin URLs, assert redirect/login/deny—**no** login, **no** mutations, **no** finance flag required.

8. **Diagnostics**  
   If extra logging or screenshots are needed on failure, keep them narrow; follow the spirit of #64 (minimal sensitive data in logs where possible).

---

## 5. Merge order

1. **#64** — Already **merged** to `main` (hardened Playwright finance E2E guards, shared helpers, env contracts).
2. **#51** — **Superseded** by #64; do not treat #51 as the source of truth for helpers or finance assertions.
3. **#55** — The **replacement** PR should land **only after** the new spec is hardened as above; the current #55 branch should **not** merge as-is. Optionally close or supersede the old draft in favor of a new PR number once the replacement is ready (product decision, outside this doc).

---

## 6. Non-goals

The replacement work and this plan explicitly exclude:

- Running or automating **production** E2E against live production URLs.
- **Supabase CLI** usage or remote DB changes.
- **Deploy** steps or promotion of environments.
- **Database migrations** or schema changes.
- Broad refactors outside the post-merge regression spec and its imports.

---

## Summary

Replace #55 with a **thin** `tests/post-merge-regression.spec.ts` that **composes** existing **`e2e-helpers`** and **`main`** env/mutation contracts, preserves the **serial regression story**, and drops duplicated unsafe defaults. Merge only after that hardening; keep unauthenticated RBAC tests non-mutating.
