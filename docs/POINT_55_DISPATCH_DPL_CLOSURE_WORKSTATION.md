# Point 55 — Dispatch DPL closure workstation (Agent #7)

**Workstation lock:** Agent #7 owns Factory component **Point 55** exclusively until programme clearance or Mission Control reassignment.  
**Work PR:** [#448](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/448) (`cursor/lane-d-factory-points-51-55-closure-976a`)  
**Merge train controller:** Agent #2 — issue [#450](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/450)  
**Master programme tracker:** [#437](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/437)

## Merge train position

| Control | State |
|---|---|
| **HOLD** | Remain **behind** [#447](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/447) (Lane A / merge-train slot ahead of Factory lane D) |
| **Rebase target** | `main` (rebase before merge approval; do not merge until #450 canonical order clears #447) |
| **Predecessor evidence** | FACT-E2E #433; FACT-C3; Core FACT-C1/C2 |
| **Does not own** | Points 51–54, 56; shipment/gate/POD; Finance post-submission release |

## Software closure status (Point 55 scope)

Point 55 = **governed Dispatch Packing List (DPL) authority** on the FACT-C3 `DispatchManagement` surface through `submit_b2b_dispatch_packing_list_to_finance`, with **no parallel legacy mutation path** for the same B2B order universe.

### Merged authority (pre-#448)

| Layer | Evidence |
|---|---|
| Core RPC chain | `open_b2b_dispatch_carton`, `record_b2b_dispatch_carton_item_scan`, `lock_b2b_dispatch_carton`, `create_b2b_dispatch_packing_list`, `supersede_b2b_dispatch_packing_list`, `submit_b2b_dispatch_packing_list_to_finance` |
| Central UI | `DispatchManagement.tsx` — sole governed operator workflow; `legacyDispatchGuard` blocks legacy B2B carton/DPL writes |
| Autonomous cert | FACT-E2E #433 golden-order dispatch consignment → carton → scan → evidence → lock → DPL → finance submission |
| Unit contracts | `legacyDplMutationDecommission.test.ts`; `DispatchManagement.test.tsx` |
| Source truth | `b2b_dispatch_packing_list_versions` AUTHORITATIVE in `factoryOperationsSourceTruthRegistry.ts` |

### #448 software delta (Point 55 legacy cutover)

| Change | Rationale |
|---|---|
| `/admin/execution/dispatch` → `/admin/dispatch-mgmt` | Retire dead `operational_queue_items` projection; align with `auth-routing.ts` dispatch role defaults |
| AdminLayout / role home / department board config | Remove stale links to legacy execution URL |
| Registry `LEGACY_REDIRECT` + `tests/lane-d-dispatch-route-closure.spec.ts` | Contract that bookmark compatibility does not resurrect dead authority |

**Software verdict after #448 merge:** Point 55 **software implementation complete**. `MERGED ≠ CLEARED` — programme strike on #437 still requires operational evidence below.

## Exact-head CI / review evidence (#448 head)

Recorded at PR head after rebase onto current `main` (refresh on each push):

| Check | Result | Notes |
|---|---|---|
| Factory Operations Ephemeral Certification | **PASS** | Disposable FACT-E2E + route health + custody layers |
| Release Quality Gate | **PASS** | Typecheck, unit, build, Playwright smoke |
| Repo Ownership Boundaries | **PASS** | |
| CodeQL | **PASS** | |
| Codacy | **PASS** | |
| Snyk | **PASS** | |
| GitHub Advanced Security (AI findings) | **FAIL (infra)** | `Model "claude-opus-4.6" is not available` — platform/model availability; not a code finding |
| Vercel preview | **Ready** | Preview deploy on PR branch |

**Action:** Re-run Factory cert workflow on final merge-ready head after #447 lands and this branch rebases. GHAS infra failure is escalated to platform/Mission Control; not fixed by Central code changes.

## Physical / operator UAT evidence required before #437 may strike Point 55

Autonomous software certification **explicitly excludes** physical wall-TV, scanner, printer, and kiosk/handheld UAT. Point 55 cannot be struck on #437 until Mission Control accepts **operator evidence** for the DPL slice (not full programme stage 11 clearance).

### Mandatory physical evidence bundle

| # | Scenario | Actor | Pass criterion |
|---|---|---|---|
| 1 | Governed entry | `DISPATCH_MANAGER` or `DISPATCH_INCHARGE` | Lands on `/admin/dispatch-mgmt` (not legacy execution URL); bookmark to `/admin/execution/dispatch` redirects to governed surface |
| 2 | Consignment + carton open | Dispatch operator | Consignment created via RPC; carton opened with governed RPC; no direct table writes |
| 3 | Physical scan | Dispatch operator + **physical scanner** | `record_b2b_dispatch_carton_item_scan` resolves barcode server-side; packed qty matches scan; duplicate/wrong-barcode rejected on device |
| 4 | Evidence capture | Dispatch operator | Weight/photo evidence recorded before lock; lock rejected without evidence |
| 5 | Carton lock | Dispatch operator | Locked carton immutable; stale version rejected |
| 6 | DPL creation | Dispatch operator | DPL derived **only** from locked carton truth; rejected if any required carton unlocked |
| 7 | DPL correction | Dispatch operator | Supersede preserves history + correction reason |
| 8 | Submit to Finance | Dispatch operator (authorized) | `submit_b2b_dispatch_packing_list_to_finance` succeeds; `submitted_to_finance_at` visible on reload in Dispatch + Finance read surfaces |
| 9 | Finance visibility | `FINANCE_HEAD` or `FINANCE_EXEC` | Submitted FACT-C2 DPL appears in Accounts Release without browser-composed lines |
| 10 | Legacy denial | Any role | `AdminPackingDispatch` / legacy paths fail closed (`blockLegacyB2bCartonDplMutation`) for same order universe |

### Environment rules

- Run on **staging or disposable certification** target first; production only after Mission Control confirms FACT-C1/C2 RPCs on target (`docs/FACT_E2E_GOLDEN_ORDER_RUNBOOK.md` pre-conditions).
- **No production mutation** from this workstation; physical UAT uses controlled test orders/fixtures.
- Record: operator role, order/SO id, consignment id, DPL version id, timestamps, screenshots or short capture, scanner model if used.

### Explicitly outside Point 55 strike scope

These remain separate programme gates (stage 11 / later points) and do **not** block striking Point 55 once rows 1–10 are evidenced:

- Finance payment verification / release-of-payment after submission
- Transporter selection, loading, departure, POD
- Security gate clearance / Trace gate release
- Full legacy dispatch census (`execution-command-center` family, `dispatch-tv` preview boards)
- Cross-app Buyer/Trace device certification beyond DPL carton membership reads

## Strike checklist for #437 (Point 55 row)

Mission Control may strike Point 55 when **all** are true:

- [ ] #447 merged per Agent #2 merge train (#450)
- [ ] #448 merged at exact head with Factory cert **PASS** on merge commit
- [ ] Physical UAT bundle rows 1–10 accepted with named operator evidence
- [ ] No open Point-55 software defect against governed `DispatchManagement` / FACT-C2 DPL RPCs
- [ ] Programme stage 11 may remain NOT_CLEARED (shipment/gate/UAT census) — Point 55 strike does not claim full Dispatch stage clearance

## Agent #7 stop condition

Return to Mission Control when:

1. #448 is merge-ready behind #447 with green exact-head Factory cert, **or**
2. A genuine blocker requires cross-repo/Core authority, **or**
3. Point 55 software + physical evidence accepted and #437 row struck.

**Do not** implement Points 51–54 or expand into shipment/gate without reassignment.
