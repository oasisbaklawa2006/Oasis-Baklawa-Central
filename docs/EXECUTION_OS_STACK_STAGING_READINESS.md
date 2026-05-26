# Execution OS — Stack Staging & Merge Readiness

**Purpose:** Stabilization checklist for merging PRs **#105 → #121** without scope expansion.  
**Governance anchor:** [EXECUTION_OS_PHASE4_STACK_GOVERNANCE.md](./EXECUTION_OS_PHASE4_STACK_GOVERNANCE.md)  
**Framework:** [EXECUTION_OS_ONE_PHASE_COMMAND_FRAMEWORK.md](./EXECUTION_OS_ONE_PHASE_COMMAND_FRAMEWORK.md)  
**Last verified branch:** `cursor/phase-4g-stock-finalization-c4ef` @ `4ece7f8` (local CI run 2026-05-26)

---

## Golden chain (do not skip)

```
commercially_released → completion_attested → dispatch_finalized / orders.status dispatched → stock_consumption_finalized
```

---

## 1. Stack status table

| PR | Phase | Head branch | GitHub base | On `main`? | Rebase needed? | Notes |
|----|-------|-------------|-------------|------------|----------------|-------|
| #105 | CMD graph / queues | `cursor/connect-read-only-operational-graph-queues-6c20` | `main` | No | After prior merges | Read-only foundation |
| #106 | 3A/3D queues + events | `cursor/execution-os-phase3a3d-foundation-6c20` | `main` | No | After #105 | **Required before 4A FK** (`operational_queue_items`) |
| #107 | 3B queue actions | `cursor/phase-3b-operational-queue-actions-6c20` | `main` | No | Sequential | |
| #108 | 3C barcode | `cursor/phase-3c-barcode-execution-6c20` | `main` | No | Sequential | |
| #109 | 3E CMD center | `cursor/phase-3e-execution-command-center-6c20` | `main` | No | Sequential | |
| #110 | 3F dept boards | `cursor/phase-3f-department-execution-boards-6c20` | `main` | No | Sequential | |
| #111 | 3H customer timeline | `cursor/phase-3h-customer-timeline-engine-6c20` | `main` | No | Sequential | Not on 4G integration branch |
| #112 | 3I search | `cursor/phase-3i-operational-search-index-6c20` | `main` | No | Sequential | |
| #113 | 3J mobile/TV | `cursor/phase-3j-mobile-tv-execution-ux-6c20` | `main` | No | Sequential | |
| #114 | 4A reservation engine | `cursor/phase-4a-inventory-reservation-engine-6c20` | `main` | No | After #106 | |
| #115 | 4A Supabase store | `cursor/phase-4a1-supabase-reservation-store-6c20` | `main` | No | After #114 | **`inventory-reservations` lib** |
| #116 | 4B dispatch readiness | `cursor/phase-4b-dispatch-readiness-6c20` | `main` | No | After #115 | |
| #117 | 4C finance governance | `cursor/phase-4c-finance-governance-6c20` | `main` | No | After #116 | |
| #118 | 4D completion attestation | `cursor/phase-4d-dispatch-completion-governance-c4ef` | `main` † | No | **Stack discipline** | Branch contains 4C commits under 4D tip |
| #119 | 4E dispatch finalization | `cursor/phase-4e-dispatch-finalization-c4ef` | `main` † | No | **Stack discipline** | Stacked on 4B–4D in practice |
| #120 | 4F legacy decommission | `cursor/phase-4f-legacy-dispatch-decommission-c4ef` | `main` † | No | **Stack discipline** | Must merge after #119 |
| #121 | 4G stock finalization | `cursor/phase-4g-stock-finalization-c4ef` | **`cursor/phase-4f-legacy-dispatch-decommission-c4ef`** | No | After #120 | Correct stacked base |

† GitHub lists `main` as base, but remote branch history includes upstream phase commits (e.g. #118 tip includes #117 docs). **Before merge:** either rebase each PR onto previous merged PR tip, or retarget PR base branch in GitHub to match true dependency chain.

### Integration branch note

`cursor/phase-4g-stock-finalization-c4ef` currently carries **28 commits** spanning **4B–4G** (migrations + libs + docs). It is suitable for **integration testing**, not a substitute for merging #105–#117 individually to `main`.

---

## 2. PR-by-PR merge readiness

| PR | Ready? | Blockers / actions |
|----|--------|-------------------|
| #105–#113 | **Staging-only** | Merge in order to `main`; run each phase staging doc when present |
| #114–#115 | **Staging-only** | Merge before #116; apply 4A migration only after #106 |
| #116 | **Staging-only** | [4B staging](./EXECUTION_OS_PHASE4B_STAGING_VALIDATION.md) |
| #117 | **Staging-only** | [4C staging](./EXECUTION_OS_PHASE4C_STAGING_VALIDATION.md); boundary: finance only |
| #118 | **Needs rebase/target fix** | [4D staging](./EXECUTION_OS_PHASE4D_STAGING_VALIDATION.md); confirm PR diff excludes 4C duplicate if merging to `main` |
| #119 | **Needs rebase/target fix** | [4E staging](./EXECUTION_OS_PHASE4E_STAGING_VALIDATION.md); sole `orders → dispatched` path |
| #120 | **Needs rebase/target fix** | [4F staging](./EXECUTION_OS_PHASE4F_STAGING_VALIDATION.md); merge only after #119 |
| #121 | **Blocked on stack** | [4G staging](./EXECUTION_OS_PHASE4G_STAGING_VALIDATION.md); base #120 ✓; needs #115 lib on `main` for production wiring |

**Next PR safe to merge to `main` (if starting fresh):** **#105** (nothing from stack on `main` yet except #104).

**Not ready for production cutover:** Entire chain until staging sign-off complete.

---

## 3. Migration order table

Apply on staging in this order (after dependencies merged):

| Order | Migration file | Depends on |
|-------|----------------|------------|
| 1 | Phase 3A/3D (`execution-os-phase3a3d` — on #106 branch, not on 4G branch) | `main` schema |
| 2 | Phase 3C barcode (#108) | 3A foundation |
| 3 | Phase 3I search (#112) | 3A events/queues |
| 4 | `20260526030000_execution_os_phase4a_inventory_reservation.sql` | **`operational_queue_items`** (#106) |
| 5 | `20260526120000_execution_os_phase4b_dispatch_readiness.sql` | orders / staff RLS helpers |
| 6 | `20260526130000_execution_os_phase4c_finance_governance.sql` | — |
| 7 | `20260526140000_execution_os_phase4d_dispatch_completion.sql` | — |
| 8 | `20260526150000_execution_os_phase4e_dispatch_finalization.sql` | — |
| 9 | `20260526160000_execution_os_phase4g_stock_finalization.sql` | 4A reservations + movements types |

**On `cursor/phase-4g-stock-finalization-c4ef`:** migrations **4A, 4B, 4C, 4D, 4E, 4G** only — no Phase 3 SQL files.

**Checks (pass on Execution OS migrations):**

- [ ] Timestamps unique (260300, 261200, 261300, 261400, 261500, 261600)
- [ ] Append-only triggers on evidence / lineage / movements / stock lineage
- [ ] RLS enabled; staff-only; no public policies
- [ ] 4A `inventory_movements` — no UPDATE/DELETE
- [ ] 4G extends `inventory_movements` CHECK constraint (drops/recreates type check)

---

## 4. Test / build verification

| Command | Result (4G branch @ 4ece7f8) |
|---------|------------------------------|
| `npm run typecheck` | **Pass** |
| `npm run build` | **Pass** |
| Scoped tests (see below) | **104 / 104 pass** |

### Scoped tests run

```
npm run test -- --run \
  src/lib/dispatch-finalization \
  src/lib/stock-finalization \
  src/lib/stock-authority \
  src/lib/finance-governance \
  src/lib/finance-authority \
  src/lib/dispatch-readiness \
  src/lib/dispatch-readiness-authority \
  src/lib/dispatch-completion \
  src/lib/dispatch-completion-authority
```

### Paths not on integration branch

| Path | Status |
|------|--------|
| `src/lib/inventory-reservations` | **Missing** on 4G branch (present on #115); 4G uses `StockReservationRecord` + SQL migration only |
| `src/lib/customer-timeline` | **Missing** (merge #111 first for timeline engine) |

---

## 5. Grep exception table

### Governed charter libs (Phase 4B–4G on integration branch)

| Pattern | Result |
|---------|--------|
| `orders.update` in `dispatch-completion` | **None** |
| `orders.update` in `finance-governance` | **None** |
| `orders.update` for `dispatched` in admin dispatch charter pages | **Blocked** (4F tests + guards); see pre-existing below |
| `.update(patch)` | **Only** `supabaseDispatchFinalizationStore.ts` (4E) |
| Stock balance `.update` | **Only** `supabaseStockFinalizationStore.ts` (4G) |
| `.delete(` in charter libs | **None** |
| `silentDeduct` / `autoAdjust` / `deleteLedger` | Blocklist constants + tests only |
| `notifyOrderDispatched` in packing/accounts | **Removed** (4F decommission tests) |

### Pre-existing / out-of-charter (call out, do not fix in stack stabilization)

| Location | Risk | Note |
|----------|------|------|
| `OrderManagement.tsx` | `orders.update` for pipeline | Blocks `nextStatus === dispatched"` |
| `AdminOrders.tsx` | `orders.update` | Blocks advance to `dispatched` |
| `AdminAccountsRelease.tsx` | `queueNotification` on gate pass | **Not** `orders → dispatched`; customer notify out of 4C–4G charter |
| `AdminFinance.tsx`, `FinanceReleaseBoard.tsx` | Finance UI mutations | Separate from 4C governance lib |
| `dispatches.status: dispatched` | Partial leg metadata | Not `orders.status` |

---

## 6. Production-risk blockers

| ID | Severity | Finding | Mitigation |
|----|----------|---------|------------|
| B1 | **Merge** | #118–#120 GitHub base = `main` but branches contain stacked commits | Rebase each onto prior merged PR or retarget PR base |
| B2 | **Staging** | Phase 3 migrations not in 4G branch | Merge #106+ before applying 4A migration |
| B3 | **Production** | `inventory-reservations` lib not on #121 branch | Merge #115; wire live reads before 4G production |
| B4 | **Production** | Governance boards use in-memory stores by default | Use `create*Bundle` + Supabase probe; 4G gates writes via `canExecuteWrites` |
| B5 | **Production** | Sample UUIDs on boards | Staging/demo only; label as preview (4G banner added) |
| B6 | **Ops** | `AdminAccountsRelease` may still queue `order_dispatched` notifications | Out of 4F scope; track under notifications phase |
| B7 | **Low** | Multi-item stock finalize without DB transaction | Partial write risk; document; future transactional phase |

**Patches applied in this stabilization command:** None (docs-only readiness report).

---

## 7. Staging checklist order

1. Merge **#105 → #113** to staging (or main) per phase docs.  
2. Merge **#114 → #115**; validate reservation persistence.  
3. Merge **#116** → run [4B staging](./EXECUTION_OS_PHASE4B_STAGING_VALIDATION.md).  
4. Merge **#117** → run [4C staging](./EXECUTION_OS_PHASE4C_STAGING_VALIDATION.md).  
5. Merge **#119** (after #118) → run [4E staging](./EXECUTION_OS_PHASE4E_STAGING_VALIDATION.md) — governed finalize.  
6. Merge **#120** → run [4F staging](./EXECUTION_OS_PHASE4F_STAGING_VALIDATION.md) — bypass grep.  
7. Merge **#121** → run [4G staging](./EXECUTION_OS_PHASE4G_STAGING_VALIDATION.md) §12 hardening gates.

### Manual / device tests (staging)

| Area | Tests |
|------|--------|
| Finance | Commercial release → hold → release; no payment capture from governance board |
| Dispatch readiness | Gate eligible badge; not dispatched |
| Completion | Attest → evidence row; order status unchanged |
| Finalization | Full chain finalize → `orders.status = dispatched` + lineage |
| Legacy routes | Packing partial leg only; security gate no order close; pipeline blocked |
| Stock | Finalize blocked before dispatch; variance block; success after finalize + balance row |
| Scanner / TV / mobile | Per #113 staging after merge |
| Security gate | Carton scan without order `dispatched` |

### Rollback plan

- Revert merge commit per PR (forward-only migrations: do not DELETE evidence/lineage rows).  
- Disable write buttons via feature flags / env (`VITE_STOCK_FINALIZATION_DEMO` off).  
- Re-run legacy paths only if intentionally rolling back **#120** (not recommended).

---

## 8. Boundary validation summary

| Phase | Verified on integration branch |
|-------|--------------------------------|
| #117 | `commercially_released` — evidence + internal events only |
| #118 | `completion_attested` — no `orders` writes in lib |
| #119 | Only `supabaseDispatchFinalizationStore` updates `orders.status` to `dispatched` |
| #120 | Legacy decommission tests + guards |
| #121 | Finalize after `dispatch_finalized`; variance/missing balance/reason hardening |

---

## 9. Final recommendation

| Question | Answer |
|----------|--------|
| **Ready to merge next PR to `main`?** | **#105** (first in chain), then strictly in numeric order |
| **Blocked?** | **Yes** for production until #106+#115 on `main`, stack rebase for #118–#120, full staging sign-off |
| **Needs rebase?** | **#118, #119, #120** — align GitHub base with true dependency (`#117` → `#118` → `#119` → `#120` → `#121`) |
| **Needs staging validation?** | **All** PRs before production promotion |

**Do not merge #121 to production** until: #119–#120 on `main`, migrations applied, #115 reservation lib wired, 4G staging §12 signed off, and [stack governance](./EXECUTION_OS_PHASE4_STACK_GOVERNANCE.md) reviewed.

This document is stabilization metadata only — no product capability added.
