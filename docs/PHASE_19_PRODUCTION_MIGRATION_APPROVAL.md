# PHASE 19 — Production migration execution approval

**Document type:** Formal approval pack for **DDL only** — not pilot orders, not legacy containment execution.  
**Production Supabase project ID:** `tcxvcatsqqertcnycuop`  
**Production app SHA (baseline):** `189177dfd70407ac02b042cd11a7a5f24f846e44`  
**Prepared:** 2026-05-30  
**Rules for approvers:** This approval authorizes **migration execution** during a named window. It does **not** authorize manual SQL DDL, `migration repair`, or pilot UI writes.

**Executable detail:** `docs/PHASE_18_MIGRATION_EXECUTION_PACKAGE.md`  
**Reprobe SQL:** `docs/PHASE_15_5_PRODUCTION_REPROBE.md`  
**Post-migration pilot / 4B gates:** `docs/PHASE_18_REPORT.md`, `docs/PHASE_19_OPERATOR_ONE_PAGE_GO_NO_GO.md`

---

## 1. Scope of this approval

| In scope | Out of scope |
|----------|----------------|
| `npx supabase db push` — **19** migrations on `tcxvcatsqqertcnycuop` | Pilot golden-chain UI (4B–4G) |
| Pre/post migration list archive | Application code deploy |
| Read-only reprobe G1–G8 | Manual CREATE TABLE / ALTER in SQL editor |
| UI smoke (boards load, no writes) | `migration repair` without DBA plan |
| | `db pull` on production |
| | Dropping governance tables |

---

## 2. Migration inventory

### 2.1 Totals

| Metric | Count |
|--------|------:|
| **Total migrations in this push** | **19** |
| **Execution OS migrations (critical path)** | **9** |
| Pre–Execution OS migrations (same push) | 10 |

### 2.2 Full sequence (do not reorder)

| # | Version | Purpose |
|---|---------|---------|
| 1 | `20260503201343` | B2B request info columns |
| 2 | `20260503215926` | `users.deleted_at` |
| 3 | `20260504035656` | `debug_webhooks.message_intent` |
| 4 | `20260508155100` | Sales roster RLS (**elevated risk**) |
| 5 | `20260510120000` | `dispatches` proof columns |
| 6 | `20260515120000` | Orders finance audit columns |
| 7 | `20260515120001` | `order_payment_status` enum label |
| 8 | `20260515194500` | Buyer receipt + storage RLS |
| 9 | `20260516200000` | `payment_rejection_reason` |
| 10 | `20260518220000` | WhatsApp audit reconcile (idempotent) |
| 11 | `20260525230000` | **Execution OS** 3A3D foundation |
| 12 | `20260526010000` | **Execution OS** 3C barcode / scans |
| 13 | `20260526020000` | **Execution OS** 3I search index |
| 14 | `20260526030000` | **Execution OS** 4A reservations / movements |
| 15 | `20260526120000` | **Execution OS** 4B dispatch readiness |
| 16 | `20260526130000` | **Execution OS** 4C finance evidence |
| 17 | `20260526140000` | **Execution OS** 4D completion |
| 18 | `20260526150000` | **Execution OS** 4E finalization / lineage |
| 19 | `20260526160000` | **Execution OS** 4G stock finalization |

### 2.3 Critical Execution OS tables (post-push must exist)

`operational_queue_items`, `operational_scan_records`, `operational_search_index`, `inventory_reservations`, `inventory_movements`, `dispatch_readiness_evidence`, `finance_review_evidence`, `dispatch_completion_evidence`, `dispatch_release_lineage`, `inventory_stock_balances`, `stock_consumption_lineage`

---

## 3. Exact command sequence (authorized method only)

```bash
export PROD_REF=tcxvcatsqqertcnycuop
export CUTOVER_SHA=189177dfd70407ac02b042cd11a7a5f24f846e44

git fetch origin && git checkout "$CUTOVER_SHA"
npx supabase@latest login
npx supabase@latest link --project-ref "$PROD_REF"
npx supabase@latest migration list --linked    # PRE — archive output

# DBA: backup/PITR complete — record ID in change ticket

npx supabase@latest db push                  # applies all 19 migrations

npx supabase@latest migration list --linked    # POST — archive output
# Then: PHASE_15_5 reprobe G1–G8 (read-only SQL)
# Then: UI smoke — open /admin/dispatch-readiness (no pilot writes)
```

**Only** the Supabase CLI apply path above is approved. No alternate ordering.

---

## 4. Required change window

| Field | Value |
|-------|--------|
| **Recommended duration** | 2 hours minimum (45–105 min technical + buffer) |
| **Recommended timing** | Off-peak; low concurrent admin on `orders` / `companies` |
| **Change ticket #** | _________________________ |
| **Window start (UTC)** | _________________________ |
| **Window end (UTC)** | _________________________ |
| **War room channel** | _________________________ |
| **User comms sent?** | ☐ Yes  ☐ N/A |

**Reason for window:** Migration **4** (`20260508155100`) rewrites RLS on `companies`, `orders`, `order_items`.

---

## 5. Required backup / PITR confirmation

| # | Requirement | DBA confirmation |
|---|-------------|----------------|
| B1 | Point-in-time recovery enabled on project `tcxvcatsqqertcnycuop` | ☐ |
| B2 | Full backup or PITR snapshot taken **immediately before** `db push` | ☐ |
| B3 | Backup / snapshot ID recorded: _________________________ | ☐ |
| B4 | Restore drill path documented (who invokes PITR) | ☐ |
| B5 | Rollback owner named: DBA _________________ Eng _________________ | ☐ |

**Without B1–B3 checked:** migration execution is **not approved**.

---

## 6. Exact STOP conditions (halt — do not pilot)

Execute **STOP** if **any** occur:

| ID | Condition |
|----|-----------|
| S1 | `db push` exits non-zero |
| S2 | `migration list --linked` POST still shows any of the 19 versions with empty Remote |
| S3 | Pre-apply showed Remote-only version with no local file |
| S4 | Reprobe G1 — any of nine pilot tables **MISSING** |
| S5 | Reprobe G3 — fewer than **9** rows for versions `20260525230000`–`20260526160000` |
| S6 | Reprobe G8 — `orders` or `order_status_history` count **decreased** vs pre-deploy snapshot |
| S7 | Mass auth failure or RLS denial reported immediately after step 4 migration |
| S8 | Operator runs `migration repair` without written DBA plan |
| S9 | Partial schema (tables exist but migration history incomplete) |

**On STOP:** Preserve logs; notify rollback owners; **no** pilot orders; **no** blind retry.

---

## 7. Exact GO conditions (migration phase complete)

**Migration GO** (authorizes proceeding to pilot *planning*, not automatic pilot) requires **all**:

| ID | Condition |
|----|-----------|
| G1 | `db push` exit code **0** |
| G2 | POST `migration list` — all **19** pending versions on Remote |
| G3 | Reprobe G1–G8 **PASS** (see §9) |
| G4 | UI smoke — `/admin/dispatch-readiness` loads without persistence error |
| G5 | Pre/post artifacts archived to change ticket |
| G6 | DBA sign-off line on migration execution package (§11) |
| G7 | Engineering owner sign-off line (§11) |

**Pilot GO** is a **separate** approval after route containment + five orders registered (`PHASE_18_PILOT_EXECUTION_PACKAGE.md`).

---

## 8. Who must approve

| Role | Approves | Signature | Date |
|------|----------|-----------|------|
| **Engineering lead** | Repo SHA, 19-migration scope, RLS migration `20260508155100` reviewed | | |
| **DBA / platform owner** | Backup/PITR, window, rollback path, CLI-only apply | | |
| **Operations / change manager** | Change window, comms, war room | | |
| **Finance owner** (awareness) | RLS + finance tables in bundle — no pilot yet | | |
| **Executive sponsor** (optional) | Production DDL on live commerce DB | | |

**Minimum to execute:** Engineering lead + DBA + Operations (3 signatures).

---

## 9. Post-migration validation checklist (execute before pilot)

| # | Check | Pass ☐ |
|---|------|--------|
| V1 | G1 — Ten tables exist (`PHASE_15_5` §2) | |
| V2 | G2 — Five supporting tables | |
| V3 | G3 — Nine Execution OS migration versions in `schema_migrations` | |
| V4 | G4 — Ten functions (8 immutable + 2 helpers) | |
| V5 | G5 — RLS enabled on governance tables | |
| V6 | G6 — CHECK includes `dispatch_consumption_confirmed`, `consumption_finalized` | |
| V7 | G7 — `is_internal_staff`, `get_user_role` present | |
| V8 | G8 — Legacy counts unchanged | |
| V9 | UI smoke — 4B, 4C, 4D, 4E, 4F, 4G boards load | |
| V10 | Screenshots A1–A9 attached per `PHASE_18_MIGRATION_EXECUTION_PACKAGE.md` §10 | |

---

## 10. First 4B entry checklist (after migration GO — separate gate)

Do **not** open pilot order on 4B until **all** checked:

| # | Check | Pass ☐ |
|---|------|--------|
| F1 | Migration GO (§7) complete | |
| F2 | `VITE_EXECUTION_PREVIEW_FALLBACK=false` on production | |
| F3 | `VITE_STOCK_FINALIZATION_DEMO=false` on production | |
| F4 | Pilot order #1 UUID in `PILOT_ORDER_TEST_MATRIX.md` | |
| F5 | Dispatch operator internal staff + 4B insert role verified | |
| F6 | Route containment sign-off (`PHASE_18_ROUTE_CONTAINMENT_PLAN.md`) | |
| F7 | Class A routes briefed (finance-board, finance, webhook policy, pilot SKU freeze) | |
| F8 | Pilot coordinator assigned | |

---

## 11. Execution sign-off (fill at T0)

| Role | GO / NO-GO | Name | UTC time |
|------|------------|------|----------|
| DBA (pre-push backup) | | | |
| Engineering (`db push`) | | | |
| DBA (post reprobe) | | | |
| Engineering (UI smoke) | | | |

---

## 12. Approval statement

By signing §8, approvers authorize **one** production `supabase db push` applying **19** migrations to **`tcxvcatsqqertcnycuop`** during the named change window, following `PHASE_18_MIGRATION_EXECUTION_PACKAGE.md`, and **not** authorizing manual DDL or pilot UI until §9–§10 are satisfied.

---

*End of production migration approval pack.*
