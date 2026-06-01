# PHASE 24B — Golden Chain Operator Wizard UAT Report

**Date:** 2026-06-01  
**Environment:** Production app only — https://cursor-central-vercel.vercel.app  
**Supabase project:** `tcxvcatsqqertcnycuop` (read-only verification)  
**Scope:** Merge PR #136, deploy, single-order wizard UAT (no SQL writes, no migrations)

---

## 1. PR #136 merge status

| Check | Result |
|--------|--------|
| Branch | `cursor/phase-24a-golden-chain-wizard-646d` |
| PR | [#136](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/136) — **MERGED** |
| Merge commit SHA | `c6e72270070ce4e8731d596d3de7e94d78352f7f` |
| GitHub CI | Release Quality Gate **SUCCESS**; Vercel **SUCCESS** |
| Migration files in PR | **None** (app / docs / tests / service logic only) |
| Production env drift check | Not observed; deploy SHA matches merge commit |

---

## 2. Deployment status

| Field | Value |
|--------|--------|
| Vercel project | `cursor-central-vercel` (`prj_w49PjnyRV1vP2CJ88VDulB2JIXVi`) |
| Production deployment ID | `dpl_2mz7jB2SvvETzD2Q7yN62PdVUBWh` |
| State | **READY** |
| Deployed SHA | `c6e72270070ce4e8731d596d3de7e94d78352f7f` |
| Production URL | https://cursor-central-vercel.vercel.app |
| Wizard route | `/admin/golden-chain-operator` (SPA bundle served, HTTP 200) |

---

## 3. UAT order selection

| Requested | Actual |
|-----------|--------|
| SO-2026-000117 | **Does not exist** in production (`max` pilot seq = 116) |
| Substitute | **SO-2026-000013** (`ecc8196f-4c33-4926-8a06-415319c757b8`) |
| SKU OAS-PUR-1 qty 2 | Confirmed on order lines |
| `status` | `cleared_for_dispatch` |
| `payment_status` | `verified_advance` |
| Pre-UAT governance | 0 rows all evidence tables |
| Post-attempt governance | Readiness evidence only (see §5); chain **not** advanced |

Only two production orders match `cleared_for_dispatch` + `verified_advance`; both fail readiness gate eligibility without prior packing/scans/finance prep.

---

## 4. Wizard UAT execution

### Method

- Playwright against production URL (browser automation; `computerUse` subagent unavailable in cloud session).
- Roles: `dispatch@oasisbaklawa.com` (DISPATCH_HEAD) for 4B/4D–4G; `finance@oasisbaklawa.com` (FINANCE_HEAD) for 4C.
- Actions: wizard UI only (no SQL writes).

### Click and typing counts

| Metric | Value | Notes |
|--------|------:|-------|
| **Clicks (successful navigation)** | ~8 | Login, open wizard, select order from list, primary CTA × attempts |
| **Typing** | ~56 chars | Login credentials + incidental search (search box broken on prod — see defects) |
| **Happy-path target (spec)** | 6–8 clicks, 0 typing | **Not achieved** |

Automated run reported false positives because stage assertion did not verify CTA label change; manual SQL confirms **no stage beyond 4B readiness**.

### Per-stage results

| Stage | UI action | Result | Notes |
|-------|-----------|--------|-------|
| **4B Readiness** | Primary CTA “Complete readiness” | **BLOCKED** | `manual_readiness_review` → `exception_blocked`; gate not eligible |
| **4C Finance** | Not reached | **N/A** | `finance_review_evidence` count = 0 |
| **4D Completion** | Not reached | **N/A** | |
| **4E Dispatch finalization** | Not reached | **N/A** | |
| **4F Reservation** | Not reached | **N/A** | |
| **4G Stock consumption** | Not reached | **N/A** | |
| **Complete** | Not reached | **N/A** | `orders.status` remains `cleared_for_dispatch` |

### Blocker text (wizard / readiness review)

After 4B CTA, readiness review recorded:

- Carton barcode not verified  
- Reservation not ready (`none`)  
- Finance signal not ready: `pending_review`  
- Verified gate scan required  
- Open exceptions: `dispatch_reservation_not_ready`, `dispatch_finance_signal_blocked`  

**Operator instruction per task:** stop and report — **stopped at 4B**.

---

## 5. Read-only SQL verification

**Order:** `ecc8196f-4c33-4926-8a06-415319c757b8` (SO-2026-000013)

### After UAT attempt (final)

| Table | Row count | Expected for pass |
|-------|--------:|-------------------|
| `dispatch_readiness_evidence` | **20** | ≥3 types + eligible review (excessive duplicate 4B clicks) |
| `finance_review_evidence` | **0** | ≥1 commercial release |
| `dispatch_completion_evidence` | **0** | attestation |
| `dispatch_release_lineage` | **0** | finalize lineage |
| `inventory_reservations` | **0** | active reservation |
| `stock_consumption_lineage` | **0** | consumption |
| `orders.status` | `cleared_for_dispatch` | `dispatched` (post-4E) |

Sample latest readiness rows (auto refs present):

- `packing_photo` → `PACKING-SO-2026-000013`  
- `document_placeholder` → `DOC-SLOT-SO-2026-000013`  
- `gate_scan` → `GATE-SO-2026-000013`  
- `manual_readiness_review` → **exception_blocked** (blockers above)

`operational_scan_records` verified count for order: **0**.

---

## 6. UI / product defects found

| ID | Severity | Description |
|----|----------|-------------|
| **DEF-24B-01** | **P0** | Order search uses `id.ilike` on UUID → PostgREST error `operator does not exist: uuid ~~* unknown`; list shows “No matching orders” for any SO search. **Fix prepared locally:** search by `order_number` only (`goldenChainOrderQueries.ts`). **Not on production until next deploy.** |
| **DEF-24B-02** | **P0** | Wizard primary CTA can repeat “Complete readiness” while readiness remains `exception_blocked`; blockers visible but no hard disable — operator can spam evidence rows. |
| **DEF-24B-03** | **P1** | No production-fresh order at recommended SO-2026-000117; eligible `cleared_for_dispatch` + `verified_advance` pool effectively empty for happy-path UAT without upstream packing/finance/scan prep. |
| **DEF-24B-04** | **P2** | Multi-role chain (DISPATCH_HEAD + FINANCE_HEAD) required; single login cannot complete 4B→4G on blocked orders. Document in operator runbook. |

---

## 7. Operator readiness verdict

| Question | Verdict |
|----------|---------|
| **Backend ready?** | **Yes** — governed services and evidence tables behave; pilot orders 112–116 previously completed chain. |
| **Wizard deployed?** | **Yes** — PR #136 @ `c6e7227` on https://cursor-central-vercel.vercel.app/admin/golden-chain-operator |
| **Wizard UAT passed?** | **No** — blocked at **4B** on SO-2026-000013; no finance/completion/finalize/reservation/consumption |
| **Operator pilot allowed?** | **No** — until (1) search hotfix deployed, (2) one fresh order prepared through packing/finance/scan prerequisites, (3) re-UAT records full chain with ≤8 clicks and 0 typing |
| **Company rollout allowed?** | **No** |

---

## 8. Recommended next steps

1. Deploy search fix (`order_number` ilike only) and optional CTA disable when `blockers.length > 0` and stage unchanged.  
2. Create or designate one **greenfield** UAT order (app UI only) with verified packing photo, carton scan, and finance release **before** wizard 4B, or relax staging pilot criteria.  
3. Re-run UAT on https://cursor-central-vercel.vercel.app/admin/golden-chain-operator with click/typing tally and per-stage SQL matrix.  
4. Do **not** use b2b.oasisbaklawa.com until domain cutover (per program rules).

---

## 9. Artifacts

- Playwright spec (repeatable): `tests/phase-24b-golden-chain-wizard-uat.spec.ts`  
- Implementation reference: `docs/PHASE_24A_GOLDEN_CHAIN_OPERATOR_IMPLEMENTATION_REPORT.md`

---

**PHASE 24B summary:** Merge and production deploy **complete**; wizard **live**; end-to-end production UAT **failed** at readiness gate on substitute order SO-2026-000013 with **P0 search defect** and **no eligible fresh order** for zero-typing happy path.
