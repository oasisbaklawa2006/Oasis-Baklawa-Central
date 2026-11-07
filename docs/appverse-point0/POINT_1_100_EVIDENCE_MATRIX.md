# Appverse Original 1–100 — Evidence Matrix and Denominator Assessment (E0, 5 Nov 2026)

**Status: DRAFT evidence matrix. Not a score, not a launch certificate.** Numbering is immutable (issue #437 / #459 / `docs/APP_VERSE_MASTER_PROGRAMME_REGISTER.md`). Merged PRs are evidence, never closure (`PR MERGED != STAGE CLEARED`).

## How to read this
- **Title** comes verbatim from the Master Programme Register (v1.1).
- **Last documented status** comes from the issue #437 ledger (last reconciled 4 Sep 2026) plus the 10 Oct 2026 reconciliation comment. The Register file itself is stale (shows 2/100); #437 is the later source. Where #437 has no explicit status the row says `OPEN (per #459, not re-verified)`.
- **Re-verified 5 Nov** is `No` unless the E0 audit directly checked it. Nothing here is a fresh runtime or production proof.
- **Weights are blank on purpose.** Weights, the 163 Studio control decomposition and per-app ownership shares need owner approval. They are not invented here.

## Denominator assessment
| Requirement for a valid percentage | State (5 Nov) |
|---|---|
| 100 primary points enumerated with titles | **Done** (this file) |
| Per-point current status with source | **Partial** — documented statuses only; most rows not re-verified at an exact SHA |
| Per-app decomposition of each point into controls | **Missing** — the 163 Studio controls list was not found by text search of the Central and AI Studio `main` trees (Core, Buyer and Trace trees not searched for it); the only `163` hit in Studio is an unrelated test-file count |
| Approved weights | **Missing** — owner decision |
| Exact-head runtime proof per point | **Missing** for essentially all rows; Buyer/Factory certification jobs are currently red on Central (see #437 CP4/CP5) |
| Core pull-request/CI inventory | **Inherited** from the independent census; not re-verified by this session |
**Conclusion: the denominator is NOT approved. Build %, Testing %, Certification % and Combined % remain N/V.** Counts of documented statuses below are an inventory, not a percentage.

## Inventory of documented statuses (not scores)

- BLOCKED: 1
- COMPLETE: 14
- IN PROCESS: 19
- NOT STARTED: 1
- OPEN: 64
- UNDER REVIEW: 1

## Matrix

| # | Title | Phase / owning repositories | Last documented status | Re-verified 5 Nov | Weight | Notes / evidence gaps |
|---:|---|---|---|---|---|---|
| 1 | Establish the master programme register | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 2 | Verify the current state of all five repositories | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 3 | Complete exposed-secret verification and remediation | A Architecture/security/shared foundation (Core + governance) | UNDER REVIEW | No | _unset_ | Provider/runtime closure evidence incomplete. |
| 4 | Freeze repository ownership boundaries | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 5 | Freeze the canonical application authority map | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 6 | Create the canonical entity register | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 7 | Freeze shared identity rules | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 8 | Freeze the role and permission model | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 9 | Freeze the canonical audit model | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 10 | Freeze event and command standards | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 11 | Freeze idempotency and duplicate-prevention standards | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 12 | Freeze the canonical order lifecycle | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 13 | Freeze the customer-safe order status projection | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 14 | Freeze the environment matrix | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 15 | Make Supabase Core the migration and shared-contract authority | A Architecture/security/shared foundation (Core + governance) | COMPLETE (governance/authority freeze) | No | _unset_ |  |
| 16 | Consolidate shared authentication | B Shared platform (Core + apps) | IN PROCESS | No | _unset_ |  |
| 17 | Implement shared company, branch and contact hierarchy | B Shared platform (Core + apps) | IN PROCESS | No | _unset_ |  |
| 18 | Implement shared role-based access control | B Shared platform (Core + apps) | IN PROCESS | No | _unset_ | Core direct-write hardening deployed; Central #458 and Buyer #10 documented merged on 10 Oct (inherited); post-merge production RLS characterisation and Dispatch UAT evidence not re-verified. |
| 19 | Implement step-up authentication for sensitive mobile actions | B Shared platform (Core + apps) | IN PROCESS | No | _unset_ |  |
| 20 | Implement the shared event ledger | B Shared platform (Core + apps) | NOT STARTED | No | _unset_ |  |
| 21 | Implement shared notification infrastructure | B Shared platform (Core + apps) | IN PROCESS | No | _unset_ |  |
| 22 | Implement shared document and file-storage governance | B Shared platform (Core + apps) | IN PROCESS | No | _unset_ | Historical #447/#454 communication-log work is misnumbered and does not close Point 22. |
| 23 | Implement shared realtime-channel standards | B Shared platform (Core + apps) | IN PROCESS | No | _unset_ |  |
| 24 | Implement shared integration error and retry handling | B Shared platform (Core + apps) | IN PROCESS | No | _unset_ |  |
| 25 | Implement schema-drift and migration validation in CI | B Shared platform (Core + apps) | IN PROCESS | No | _unset_ |  |
| 26 | Audit and stabilise AI Studio’s current repository state | C AI Studio product authority (Studio + Core) | IN PROCESS | No | _unset_ |  |
| 27 | Complete Fast Create foundation | C AI Studio product authority (Studio + Core) | IN PROCESS | No | _unset_ |  |
| 28 | Complete duplicate and similar-product detection | C AI Studio product authority (Studio + Core) | IN PROCESS | No | _unset_ |  |
| 29 | Complete barcode, OCR, voice and pasted-text intake | C AI Studio product authority (Studio + Core) | IN PROCESS | No | _unset_ | Core implementation merged; #190 repair and production migrations 20260904030100/030200 present in the production ledger (verified 5 Nov); AI Studio #135 documented merged 10 Oct (inherited). Semantic production verification not re-run. |
| 30 | Complete AI-assisted field extraction and suggestions | C AI Studio product authority (Studio + Core) | IN PROCESS | No | _unset_ | #138 documented merged 10 Oct (inherited). |
| 31 | Complete the Full Editor data architecture | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 32 | Complete product and variant hierarchy | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 33 | Complete pack, inner-pack, carton and pallet hierarchy | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 34 | Complete ingredients, allergens, shelf-life and storage fields | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 35 | Complete dimensions, weight and CBM handling | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 36 | Complete MOQ, lead-time and commercial-readiness fields | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 37 | Complete packaging and label-readiness fields | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 38 | Complete product workflow states | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 39 | Complete approval, rejection, correction and resubmission workflow | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 40 | Complete product version history and audit | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 41 | Complete media workspace | C AI Studio product authority (Studio + Core) | IN PROCESS | No | _unset_ | Studio #143 software repair; live storage and physical-camera evidence absent. |
| 42 | Implement controlled photography image families | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 43 | Implement Bateel-derived photography governance | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 44 | Implement guided mobile camera capture | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 45 | Implement AI image enhancement with exact-product preservation | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 46 | Implement image quality validation | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 47 | Implement WebP, WebM, print and UHD output generation | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 48 | Implement AI product naming and description generation | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 49 | Implement multilingual content and selling-point generation | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 50 | Implement catalogue, WhatsApp, website and label-copy outputs | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 51 | Complete AI Studio mobile product creation | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 52 | Complete AI Studio mobile approval and controlled launch | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 53 | Implement deferred-detail handling | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 54 | Implement the approved-product publication contract | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 55 | Publish operational product data to Central | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 56 | Publish customer-safe product data to the Customer App | C AI Studio product authority (Studio + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 57 | Audit and stabilise Central’s current live, partial and demo modules | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 58 | Remove or unmistakably label demo and projection-only authority | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 59 | Build the canonical Customer 360 | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 60 | Implement company, branches, contacts and buyer hierarchy | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 61 | Implement CRM communication history | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 62 | Implement calls, WhatsApp, email, notes and promises | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 63 | Implement tasks, follow-ups, opportunities and samples | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 64 | Implement customer health, risk and next-best-action logic | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 65 | Implement fragmented WhatsApp message grouping | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 66 | Implement employee sender and original customer identification | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 67 | Complete WhatsApp packet-to-draft workflow | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 68 | Complete WhatsApp draft review and correction | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 69 | Implement approved WhatsApp draft to live order creation | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 70 | Build one canonical order-intake authority | D Central CRM/intake/command (Central + Core) | IN PROCESS | No | _unset_ | Stage-2 v3 TEXT PASS (8,804 windows) documented; media-inclusive protected execution and WA7 live-provider gates outstanding. |
| 71 | Complete the Central Order Pool | D Central CRM/intake/command (Central + Core) | IN PROCESS | No | _unset_ | Central #467 was held behind #458; not in the 5 Nov open-PR list, state not re-verified. |
| 72 | Implement order duplicate detection and source attribution | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 73 | Implement price, MOQ, carton and customer-term validation | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 74 | Implement order priority, owner, SLA and escalation | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ | Central #455 CRM-lite is misnumbered and does not close Point 74. |
| 75 | Implement amendment, cancellation and substitution control | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 76 | Implement partial and split fulfilment | D Central CRM/intake/command (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 77 | Consolidate finance into one canonical authority | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 78 | Complete payment-proof review and bank reconciliation | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 79 | Complete wallet, prepaid, credit and available-credit logic | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 80 | Complete holds, releases, reversals and second approvals | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 81 | Complete ageing, exposure, credit notes, refunds and disputes | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 82 | Build the real Inventory Command Centre | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 83 | Implement reservation and double-reservation prevention | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 84 | Implement stock states | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 85 | Implement batch, shelf-life, FEFO/FIFO and location control | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 86 | Implement automatic department queue creation from orders | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 87 | Complete production department execution | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 88 | Complete department targets, allocation, start, pause and completion | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 89 | Complete wastage, rejection, shortage, blocker and quality-hold flows | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 90 | Complete Assembly Management | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 91 | Complete Ready Goods Store and Third-Party Store | E Central finance/inventory/manufacturing (Central + Core) | IN PROCESS | No | _unset_ | Central #465 merged; downstream runtime/physical closure evidence outstanding. |
| 92 | Complete Packing Management and carton-building rules | E Central finance/inventory/manufacturing (Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 93 | Freeze the Central–Trace command and event contract | F Trace/dispatch/physical (Trace + Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 94 | Complete product, batch, pack and carton barcode identities | F Trace/dispatch/physical (Trace + Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 95 | Complete label printing, reprinting and verification | F Trace/dispatch/physical (Trace + Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 96 | Complete signed scan ingestion, offline retry and duplicate prevention | F Trace/dispatch/physical (Trace + Central + Core) | IN PROCESS (software merged in Trace; physical scanner UAT outstanding) | No | _unset_ | Physical scanner UAT is a separate gate. |
| 97 | Complete physical handovers across all departments | F Trace/dispatch/physical (Trace + Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 98 | Complete Dispatch Readiness, Loading, Finalisation and Gate Release | F Trace/dispatch/physical (Trace + Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 99 | Embed Trace into Central PC, mobile, handheld and Smart TV surfaces | F Trace/dispatch/physical (Trace + Central + Core) | OPEN (per #459, not re-verified) | No | _unset_ |  |
| 100 | Complete, integrate, test and launch the full App-Verse | G Customer App and final launch (all) | BLOCKED | No | _unset_ | Blocked until prerequisite points and final production/physical evidence clear. |

## Alias warnings carried from #437
Central #452 "Point 37" maps to original 87 evidence; #453 "Point 38" maps to original 12/13; #447/#454 communication-log work is not original 22; #455 CRM-lite is not original 74. Aliases never strike an original row.

## Next steps to a valid denominator
1. Owner supplies or approves: the 163-control list for AI Studio, per-point weights, and the shared-control ownership split (no double counting of Core and WhatsApp).
2. E0 re-verifies each IN PROCESS/COMPLETE row against exact heads and the production ledger.
3. Only then compute Build, Testing, Certification and Combined from audited numerators. Until then all four stay N/V.
