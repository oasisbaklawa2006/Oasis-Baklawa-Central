# CRM-lite Lane E closure audit — Points 74–78

**ASM-ID:** Parallel Closure Lane E (master #437)  
**THREAD-ID:** Central CRM-lite E74–E78  
**REPOSITORY:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**MISSION:** Census live Core/Central CRM-lite authority for Points 74–78; implement safe independent Central gaps without migrations or production mutations.  
**STOP CONDITION:** Point evidence matrix returned; independent gaps implemented in narrow PR(s) with merge-train metadata.

> **Numbering note:** Lane E uses the parallel-closure scope from #437 (CRM-lite linkage), not the Phase D/E numbering in `APP_VERSE_MASTER_PROGRAMME_REGISTER.md` (which assigns 74–76 to order SLA/amendments and 77–78 to finance consolidation).

---

## Point evidence matrix

| Point | Lane E scope | Classification | Core/Central evidence | Gap |
|------:|---|---|---|---|
| **74** | CRM-lite sales assistance | **Partial — evidence + gap closed in PR** | `client_interactions` table + CRUD in `SalesDashboard`, `ClientInteractionsTab`, `SalesPerformanceHub`; WA outbound auto-log via `send-whatsapp`; roster filtered by `companies.account_manager_id`; `/sales/dashboard` sales-exec console | Fragmented across surfaces; no unified assist workspace on sales console |
| **75** | Repeat-contact trigger | **Genuine gap → Central UI closure** | `client_interactions.follow_up_date` captured; `crm_tasks` schema exists; overdue task **count** on dashboard | No due follow-up queue, no task creation from follow-ups, no `crm_tasks` write UI |
| **76** | Credit / special-price linkage | **Partial — gap closed in PR** | PF-6B governed credit RPCs (`request_credit_authority_v1`, `resolveCreditBinding`); `CreditRequestModal`; company `price_tier` / `discount_percentage`; product `price_special` in `AdminPricing` | Orphaned credit modal; sales roster showed placeholder only; tier/discount not on sales console |
| **77** | First-line ticket linkage | **Partial — read-only closure in PR** | Mature `support_tickets` queue (`AdminSupport`, `ClaimModal`, buyer RPC); CMD War Room complained-order lens | No sales/account-manager bridge; tickets linked via `order_id` only (no direct `company_id`) |
| **78** | Commission / feedback linkage | **Partial — read-only closure in PR** | `users.commission_rate_percentage`; `commission_payouts` in `AdminFinance`; ticket rating fields + `commission_blocked` in `AdminSupport` | Feedback/penalty fields not surfaced on sales console; no payout mutation from CRM-lite |

### Upstream dependencies (not blocked — read-only or existing RPCs used)

| Dependency | Owner | Gate |
|---|---|---|
| PF-6B credit/wallet authority | Core (merged) | `resolveCreditBinding`, `request_credit_authority_v1` |
| `crm_tasks` / `client_interactions` RLS | Core | Sales exec scoped by `sales_exec_id` / `executive_id` |
| `support_tickets` → `orders.company_id` join | Core schema | Existing FK graph |
| Commission payout settlement | Finance lane | Out of Lane E scope — read-only lens only |
| Full Customer 360 (register P59–64) | Future CRM | Explicitly out of bounded v1 scope |

---

## Files / routes / contracts

| Point | Routes | Primary files | Contracts |
|------:|---|---|---|
| 74 | `/sales/dashboard` | `src/pages/sales/SalesDashboard.tsx`, `src/components/sales/ClientInteractionsTab.tsx`, `src/components/sales/crm-lite/SalesCrmLiteWorkspace.tsx` | `client_interactions`, `companies.account_manager_id` |
| 75 | `/sales/dashboard` (Follow-ups tab) | `SalesCrmLiteWorkspace.tsx` | `client_interactions.follow_up_date`, `crm_tasks` insert/update |
| 76 | `/sales/dashboard` (Credit & pricing tab) | `SalesCrmLiteWorkspace.tsx`, `CreditRequestModal.tsx`, `creditWalletAuthorityClient.ts` | `sales_order_proforma_invoice_authority_v1`, PF-6B RPCs |
| 77 | `/sales/dashboard` (Tickets tab), `/admin/support` | `SalesCrmLiteWorkspace.tsx`, `AdminSupport.tsx` | `support_tickets`, `orders.company_id` |
| 78 | `/sales/dashboard` (Commission tab), `/admin/finance`, `/admin/sales-hub` | `SalesCrmLiteWorkspace.tsx`, `AdminFinance.tsx`, `SalesPerformanceHub.tsx` | `commission_blocked`, rating columns, `commission_payouts` |

---

## Corrective PR train (canonical merge order)

| Order | PR | Branch | Predecessor | Downstream dependency | Rebase target |
|------:|---|---|---|---|---|
| 1 | **E74–E78 unified CRM-lite workspace** | `cursor/crm-lite-lane-e-closure-1970` | Core PF-6B + existing CRM tables merged | Finance commission settlement lane; full CRM app (P59+) | `main` |

**Merge serial note:** All five points touch the same sales console surface; one narrow Central PR avoids merge conflicts while preserving point-level tab boundaries inside `SalesCrmLiteWorkspace`.

---

## Implementation summary (this PR)

- **`SalesCrmLiteWorkspace`** — tabbed CRM-lite workspace on `/sales/dashboard`:
  - **Assist:** embeds `ClientInteractionsTab` (P74)
  - **Follow-ups:** due follow-up queue, repeat-contact task creation, `crm_tasks` CRUD (P75)
  - **Credit & pricing:** tier/discount display + governed SO credit request via `CreditRequestModal` (P76)
  - **Tickets:** read-only first-line lens via order→company join (P77)
  - **Commission:** read-only commission-risk ticket aggregation (P78)
- **Roster enrichment:** `price_tier` column on client roster table
- **Contract tests:** `src/lib/crm-lite/__tests__/salesCrmLiteClosure.test.ts`

---

## Exact-head validation

```bash
npm run test -- src/lib/crm-lite/__tests__/salesCrmLiteClosure.test.ts
npm run test -- src/lib/order-authority/__tests__/creditWalletAuthorityClient.test.ts
npm run build
```

---

## Next merge candidate

**This PR** (`cursor/crm-lite-lane-e-closure-1970`) — first and only Lane E Central closure PR at current head. Downstream: Mission Control may assign full CRM Customer 360 (register P59–64) or commission-adjustment workflow to Core/Finance lanes separately.

**Gate state:** Code closure for bounded CRM-lite v1 linkage — **not** stage CLEARED (`PR MERGED ≠ STAGE CLEARED`).
