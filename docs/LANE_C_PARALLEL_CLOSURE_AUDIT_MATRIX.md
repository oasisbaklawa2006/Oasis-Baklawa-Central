# Lane C — Parallel Closure Audit Matrix

**ASM-ID:** TRACE-PLATFORM-CLOSURE  
**THREAD-ID:** LANE-C  
**REPOSITORY:** `oasisbaklawa2006/Oasis-Baklawa-Central` (primary); cross-repo evidence for Trace/Core  
**Audit date:** 2026-09-03  
**Authority baseline:** `main` @ `821cc38d` (post FIN-E2E #439, FACT-E2E #433, R4.5 #429)

## Scope

| Lane slice | Programme points | Register phase |
|---|---|---|
| Trace-adjacent CRM / intake | 61–65 | Phase D — Central CRM & intake |
| Platform / governance | 79–92 | Phase E — finance, inventory, manufacturing |
| E2E Trace | 96 | Phase F — signed scan ingestion |

## Classification legend

| Class | Meaning |
|---|---|
| **COMPLETE** | Software authority merged; mandatory gates satisfied for Central scope |
| **EVIDENCE-ONLY GAP** | Code exists; missing runtime/UAT/E2E evidence or register update |
| **IMPLEMENTATION GAP** | Independent Central work remains |
| **UPSTREAM DEPENDENCY** | Blocked on Core / Trace / physical UAT / other lane |

## Point matrix (exact-head audit)

### Trace-adjacent CRM / intake (61–65)

| Point | Work item | Class | Live authority evidence | Gap / next action |
|---:|---|---|---|---|
| 61 | CRM communication history | **UPSTREAM DEPENDENCY** | Customer 360 fragments in CMD War Room; no unified comms ledger | Core CRM/event ledger + Central read model — defer to CRM lane |
| 62 | Calls, WhatsApp, email, notes, promises | **EVIDENCE-ONLY GAP** | WhatsApp inbox + operator workspace merged; notes/export read-only | Formal Point 62 closure evidence + customer-safe comms projection |
| 63 | Tasks, follow-ups, opportunities, samples | **IMPLEMENTATION GAP** | Work queues / operational_queue_items partial | Persisted task/opportunity model — Core-owned |
| 64 | Customer health, risk, next-best-action | **IMPLEMENTATION GAP** | Projection-only risk signals in war room | Requires canonical customer health authority (Core) |
| 65 | Fragmented WhatsApp message grouping | **EVIDENCE-ONLY GAP** | `whatsapp_message_packets` stitcher + inbox grouping merged (`feat/wa-multi-message-packet-reconstruction`) | Register still NOT STARTED; capture software evidence + operator UAT |

### Platform / governance (79–92)

| Point | Work item | Class | Live authority evidence | Gap / next action |
|---:|---|---|---|---|
| 79 | Wallet, prepaid, credit, available-credit | **UPSTREAM DEPENDENCY** | Core PF lane (#130) payment authority; Central `FinanceReleaseBoard` reads Core RPCs | Wallet ledger authority in Core — Central caller only |
| 80 | Holds, releases, reversals, second approvals | **EVIDENCE-ONLY GAP** | `FinanceReleaseBoard`, `FinanceGovernanceBoard`, governance matrices | E2E evidence for hold/release chain |
| 81 | Ageing, exposure, credit notes, refunds, disputes | **UPSTREAM DEPENDENCY** | Finance boards partial | Core finance canonical tables + Central bind |
| 82 | Real Inventory Command Centre | **EVIDENCE-ONLY GAP** | `InventoryCommandCenter` live B2B read model (stores, availability, receipts, assembly) | Label still said preview in nav — **live**; capture evidence |
| 83 | Reservation / double-reservation prevention | **EVIDENCE-ONLY GAP** | `reservation-board`, Phase 4A reservation store, wizard UAT reports | Physical double-book UAT separate |
| 84 | Stock states | **EVIDENCE-ONLY GAP** | `inventory_stock_balances`, stock finalization boards | State machine census vs Core authority |
| 85 | Batch, shelf-life, FEFO/FIFO, location | **UPSTREAM DEPENDENCY** | Inventory OS libs; batch authority in Core | Core batch/location schema gates |
| 86 | Auto department queue from orders | **EVIDENCE-ONLY GAP** | `operational_queue_items`, department execution boards, Factory cert | Automated queue creation RPC — Core |
| 87 | Production department execution | **EVIDENCE-ONLY GAP** | Department boards + Factory E2E #433 (7/7 browser passes) | Physical TV/handheld UAT separate |
| 88 | Department targets, allocation, start/pause/complete | **EVIDENCE-ONLY GAP** | Execution boards + Factory certification | Physical UAT separate |
| 89 | Wastage, rejection, shortage, blocker, quality-hold | **EVIDENCE-ONLY GAP** | Governance boards + escalation libs | Formal evidence capture |
| 90 | Assembly Management | **EVIDENCE-ONLY GAP** | `AssemblyManagement`, assembly TV, B2B assembly jobs in ICC | Physical UAT separate |
| 91 | Ready Goods Store & Third-Party Store | **EVIDENCE-ONLY GAP** | R4.5 #429 3PGS command centre; ready-goods routes | R4.3 put-away/discrepancy (#410) active |
| 92 | Packing Management & carton rules | **EVIDENCE-ONLY GAP** | Governed `b2b_dispatch_*` carton/DPL chain (FACT-C1/C2/C3); legacy cutover | Carton explorer still preview-only — **separate PR** |

### E2E Trace (96)

| Point | Work item | Class | Live authority evidence | Gap / next action |
|---:|---|---|---|---|
| 96 | Signed scan ingestion, offline retry, duplicate prevention | **IMPLEMENTATION GAP → PR-1** | `barcode-scan-ingest` edge (HMAC, idempotency, CTN-SO validation) merged; 64/64 Trace contract tests cited in ASM | **Central `/admin/scan-timeline` was unwired** — fixed in PR-1 (`cursor/lane-c-trace-point96-scan-timeline-6d7a`) |

#### Point 96 authority stack (verified)

| Layer | Status | Evidence |
|---|---|---|
| Ingest edge | **code merged** | `supabase/functions/barcode-scan-ingest/`, Vitest `barcodeScanIngest.test.ts` |
| Persistence | **code merged** | `operational_scan_records` append-only |
| Idempotency | **code merged** | `X-Idempotency-Key` → unique partial index |
| Central read surface | **PR-1** | `useScanTimeline` → `operational_scan_records` SELECT |
| Trace offline retry | **UPSTREAM DEPENDENCY** | `oasis-trace` submit-central-scan client |
| Physical scanner UAT | **UPSTREAM DEPENDENCY** | Explicitly separate from software certification |

## PR train (Lane C — build parallel, merge serial)

| Order | Branch | Points | Predecessor | Downstream | Rebase target |
|---:|---|---|---|---|---|
| **1** | `cursor/lane-c-trace-point96-scan-timeline-6d7a` | 96 (Central read surface) | — (independent) | Carton explorer live bind; Trace offline retry cert | `main` |
| 2 | TBD | 92 (carton explorer live) | PR-1 | Point 97 handover surfaces | `main` after PR-1 merge |
| 3 | TBD | 65 (WA grouping evidence) | WA lane #126/#134 stability | Point 66–68 | `main` |
| 4 | TBD | 79–81 finance evidence | Core #130 PF merge | Dispatch release chain | `main` after Core #130 |

**Next merge candidate:** PR-1 (Point 96 Central scan timeline wiring).

## Stop condition (this turn)

- Point matrix returned with exact-head classifications.
- First independent implementation PR opened (Point 96 scan timeline).
- Physical device/scanner UAT **not** claimed — software evidence only.

## Remaining risk

- Master register (`APP_VERSE_MASTER_PROGRAMME_REGISTER.md`) still marks Points 61–96 as NOT STARTED; Lane C audit supersedes for closure classification only until register update PR merges.
- `MERGED ≠ CLEARED` — Point 96 software path not cleared until Trace offline retry + physical UAT gates satisfied.
