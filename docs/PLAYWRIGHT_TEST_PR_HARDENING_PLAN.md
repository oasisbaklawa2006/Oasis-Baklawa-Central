# Playwright test PR hardening plan

**Purpose:** Harden **draft PRs #55** and **#51** (and any follow-on Playwright suites) before merge or CI execution so tests **cannot** accidentally mutate **production** or shared critical environments, and **secrets** do not leak via logs.  
**Scope:** Documentation and process only. **No** code changes in this task, **no** PR merge/close, **no** push, **no** test or Playwright execution, **no** deploy, **no** Supabase CLI.

---

## 1. Current status — PR **#55** and **#51**

| PR | Title (short) | Draft | Mergeable (last review) | Files |
|----|----------------|-------|-------------------------|--------|
| **#55** | Post-merge production regression suite | **Yes** | **MERGEABLE** / **CLEAN** | `tests/post-merge-regression.spec.ts` (new, self-contained) |
| **#51** | Sprint A FIN-003/FIN-004 gap validation + shared e2e helpers | **Yes** | **MERGEABLE** / **CLEAN** | `tests/e2e-helpers.ts` (new), `tests/sprint-a-finance-gap-validation.spec.ts` (new), `tests/golden-pipeline-qa.spec.ts` (refactor) |

**`main` today:** `tests/golden-pipeline-qa.spec.ts` exists; **`post-merge-regression.spec.ts`**, **`e2e-helpers.ts`**, and **`sprint-a-finance-gap-validation.spec.ts`** are **not** on `main` until these PRs land (or equivalent work supersedes them).

---

## 2. Risks found

### 2.1 Hardcoded fallback credentials

- Both PRs default **buyer / finance / sales** (where used) to **`testpass123`** and `*@test.oasis.local`-style emails when env vars are unset.  
- **#55** additionally defaults **`TEST_OPS_PASSWORD`** to **`"production_manager"`** — a **misleading** and **high-risk** literal (suggests real role semantics even if the string is not a prod password).  
- **Effect:** CI or a developer running tests **without** env configuration still attempts **real UI logins** against whatever **`TEST_PREVIEW_URL`** resolves to, using **predictable** credentials.

### 2.2 `TEST_PREVIEW_URL` default behavior

- Both use: `process.env.TEST_PREVIEW_URL || "http://localhost:3000"`.  
- **Default is not production**, which is good for local dev.  
- **Risk:** Any workflow that **exports** `TEST_PREVIEW_URL` to a **production** or **shared staging** URL (or a typo to prod) runs **full** buyer + finance + ops flows against that host **without** an additional safety gate.

### 2.3 Destructive finance / ops actions

- Suites perform **real UI actions** that imply backend mutations: **submit SO**, **upload receipt**, **finance approve credit**, **reject payment**, **push to floor**, **“in production”** assertions, **operations** views.  
- **#51** skips the **operations** role test only when `TEST_OPERATIONS_EMAIL` / `TEST_OPERATIONS_PASSWORD` are empty — **good partial gate**.  
- **Neither** PR (as reviewed) gates **approve / reject / push** behind an explicit **“mutations allowed”** env flag — if credentials exist, **mutations run**.

### 2.4 Production / shared environment risk

- If `TEST_PREVIEW_URL` points at **production** or a **shared** environment, tests can **create orders**, **change finance state**, and **move orders on the factory board** — impacting **real users**, **reporting**, and **audit trails**.  
- **Serial** suites (#55 describe block) increase **blast radius** within a single run (long-lived session assumptions).

### 2.5 CI log / network payload risk

- **#51** wires **request** listeners that capture **`orders` PATCH** and **`audit_logs` POST** bodies for assertions.  
- **Risk:** CI or local logs may contain **PII**, **rejection reasons**, or **internal fields** if logging is verbose; artifacts (screenshots) may include sensitive UI.  
- **#55** attaches console/network diagnostics for cart failures — same class of **exposure** if URLs or payloads include tokens.

---

## 3. Recommendations (hardening before merge)

1. **Fix / land #51 first (conceptually)** — it introduces **`tests/e2e-helpers.ts`** and refactors **`golden-pipeline-qa.spec.ts`**. Centralize **`PREVIEW_URL`**, **`login`**, catalogue/cart helpers, and **env validation** once so **#55** can **reuse** them instead of duplicating ~300 lines.  
2. **Require explicit `TEST_PREVIEW_URL` in CI** — fail fast in CI if unset (local dev can keep a **documented** `.env.test` with `http://localhost:3000`).  
3. **Add allowlist / hostname check** — at suite startup (in shared helper), **`throw` or `test.skip`** unless host is: `localhost`, `127.0.0.1`, or a **small allowlist** of preview subdomains (e.g. `*.vercel.app` under your org naming convention). **Never** allow bare production apex without an impossible-to-miss override (e.g. `I_UNDERSTAND_PRODUCTION_E2E=true` **and** allowlist still false for prod domain).  
4. **Add `ALLOW_FINANCE_E2E_MUTATIONS=true` gate** — wrap **approve credit**, **reject**, **push to floor**, and any step that changes **finance/ops** state so default CI **read-only** or **skipped** unless explicitly enabled.  
5. **Remove default passwords for mutating roles** — require **`TEST_BUYER_PASSWORD`**, **`TEST_FINANCE_PASSWORD`**, **`TEST_OPS_PASSWORD`** (etc.) from **CI secrets** or local env; **no** `testpass123` / **`production_manager`** fallbacks in committed code.  
6. **Keep #55 as Draft** until it is **rebased** onto the hardened **#51** helper layer **or** explicitly **superseded** by a single consolidated regression spec that imports the same helpers.

---

## 4. Exact non-goals

| Non-goal | Notes |
|----------|--------|
| **No production test run** | Do not point Playwright at production URLs for these suites until a **separate**, executive-approved process exists (not in scope here). |
| **No Supabase mutation** | This plan does **not** authorize `db push`, SQL against prod, or Edge deploys for test convenience. |
| **No merge / close now** | Hardening is **pre-merge** work; do not merge or close **#55** / **#51** solely because this document exists. |

---

## 5. Merge order **after** hardening

1. **Land the hardened “#51 equivalent” first** — shared **`e2e-helpers`**, env gates, **`golden-pipeline`** refactor, **`sprint-a-finance-gap-validation`** with `ALLOW_FINANCE_E2E_MUTATIONS` and preview allowlist.  
2. **Land the hardened “#55 equivalent” second** **only if** a **distinct** post-merge regression suite remains valuable **after** deduplication — ideally **thin** specs importing **`e2e-helpers`**, not a second copy of login/catalogue logic.

---

*End of Playwright test PR hardening plan.*
