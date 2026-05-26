# Execution OS — Stack Staging & Merge Readiness

**Purpose:** Merge status and staging checklist for PRs **#105 → #121**.  
**Framework:** [EXECUTION_OS_ONE_PHASE_COMMAND_FRAMEWORK.md](./EXECUTION_OS_ONE_PHASE_COMMAND_FRAMEWORK.md)  
**Last updated:** `main` @ `482ec57` (2026-05-26) — **full stack merged to `main`**

---

## Golden chain (do not skip in staging)

```
commercially_released → completion_attested → dispatch_finalized / orders.status dispatched → stock_consumption_finalized
```

---

## 1. Merge status (complete)

| PR | Phase | Merge SHA on `main` | Status |
|----|-------|---------------------|--------|
| #105 | CMD read-only feeds | `2d1a0fa` | **Merged** |
| #106 | 3A/3D queues + events | `57088e2` | **Merged** |
| #107 | 3B queue actions | `0fcaa73` | **Merged** |
| #108 | 3C barcode | `b912e1a` | **Merged** |
| #109 | 3E CMD center | `6002fc4` | **Merged** |
| #110 | 3F dept boards | `a41a2e2` | **Merged** |
| #111 | 3H customer timeline | `37d2a37` | **Merged** |
| #112 | 3I search | `50af377` | **Merged** |
| #113 | 3J mobile/TV | `6eff2ca` | **Merged** |
| #114 | 4A reservation engine | `e11e58e` | **Merged** |
| #115 | 4A1 Supabase store | `b26bd8f` | **Merged** |
| #116 | 4B dispatch readiness | `445ab73` | **Merged** (rebase: `App.tsx` / `AdminLayout` conflict resolved) |
| #117 | 4C finance governance | `a5bfb40` | **Merged** (cherry-pick; dropped duplicate 4B commits) |
| #118 | 4D completion attestation | `afedc01` | **Merged** (cherry-pick) |
| #119 | 4E dispatch finalization | `dd12a64` | **Merged** (cherry-pick) |
| #120 | 4F legacy decommission | `3578020` | **Merged** (cherry-pick) |
| #121 | 4G stock finalization | `482ec57` | **Merged** (cherry-pick + direct merge to `main`; GitHub PR merged to stacked base first) |

**Remaining open PRs in stack:** None.

**Starting `main` before stack:** `e09e3f0` (#104).

---

## 2. Rebase / merge notes

| PR | Technique |
|----|-----------|
| #105–#115 | Rebase onto `main`, force-push `--force-with-lease`, merge |
| #116 | Rebase conflict in `App.tsx` / `AdminLayout.tsx` — kept upstream routes + added dispatch-readiness |
| #117–#121 | Cherry-pick phase-only commits onto `main` (dropped duplicate 4B–4F history on stacked branches) |
| #121 | PR base was `#120` branch; content landed on `main` via `482ec57` merge commit |

---

## 3. Migration order (apply on staging)

All migrations are on `main`. Apply in timestamp order:

| Order | Migration |
|-------|-----------|
| 1 | `20260525230000_execution_os_phase3a3d_foundation.sql` (#106) |
| 2 | Phase 3C barcode SQL (#108) |
| 3 | Phase 3I search SQL (#112) |
| 4 | `20260526030000_execution_os_phase4a_inventory_reservation.sql` (#114/#115) |
| 5 | `20260526120000_execution_os_phase4b_dispatch_readiness.sql` (#116) |
| 6 | `20260526130000_execution_os_phase4c_finance_governance.sql` (#117) |
| 7 | `20260526140000_execution_os_phase4d_dispatch_completion.sql` (#118) |
| 8 | `20260526150000_execution_os_phase4e_dispatch_finalization.sql` (#119) |
| 9 | `20260526160000_execution_os_phase4g_stock_finalization.sql` (#121) |

---

## 4. Staging validation order

Run phase staging checklists on staging DB after migrations:

1. [4B](./EXECUTION_OS_PHASE4B_STAGING_VALIDATION.md) → [4C](./EXECUTION_OS_PHASE4C_STAGING_VALIDATION.md) → [4D](./EXECUTION_OS_PHASE4D_STAGING_VALIDATION.md) → [4E](./EXECUTION_OS_PHASE4E_STAGING_VALIDATION.md) → [4F](./EXECUTION_OS_PHASE4F_STAGING_VALIDATION.md) → [4G](./EXECUTION_OS_PHASE4G_STAGING_VALIDATION.md)

Plus Phase 3 staging docs as applicable (#106–#113).

---

## 5. Production blockers (post-merge)

| ID | Blocker | Mitigation |
|----|---------|------------|
| P1 | Staging migrations not applied | Run §3 order on staging Supabase |
| P2 | Governance boards default in-memory | Wire `create*Bundle` + Supabase on staging |
| P3 | Sample UUIDs on boards | Staging/demo only |
| P4 | `AdminAccountsRelease` gate notifications | Track under notifications phase |
| P5 | Multi-item stock finalize without DB txn | Document; future transactional phase |

**Do-not-merge list:** Empty (stack on `main`). **Do-not-promote-to-production** until staging sign-off complete.

---

## 6. Governed write surfaces (grep charter)

| Surface | Location |
|---------|----------|
| `orders.status → dispatched` | `src/lib/dispatch-finalization/supabaseDispatchFinalizationStore.ts` only |
| Stock balance `.update` | `src/lib/stock-finalization/supabaseStockFinalizationStore.ts` only |
| Append-only INSERT | evidence / lineage / movements / queue event repos |

Pre-existing legacy routes documented in [LEGACY_DISPATCH_MUTATION_AUDIT.md](./LEGACY_DISPATCH_MUTATION_AUDIT.md).

---

## 7. Final recommendation

| Question | Answer |
|----------|--------|
| **Stack merged to `main`?** | **Yes** — #105–#121 @ `482ec57` |
| **Next action** | Apply migrations on staging; run phase staging checklists; wire Supabase bundles for production paths |
| **Rebase #106+?** | **Not needed** — already on `main` |
