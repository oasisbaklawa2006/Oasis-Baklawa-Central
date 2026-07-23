# Oasis App-Verse Master Programme Register

**Programme owner:** Oasis Baklawa  
**Master sequence:** 1–100  
**Current programme progress:** 0/100  
**Current point:** 1  
**Register version:** 1.0  

## 1. Operating rules

1. Every primary point is numbered from `1` to `100`.
2. Additional work discovered within a point is numbered `1a`, `1b`, `1c`, and so on.
3. A subpoint does not add separate programme percentage; it remains part of its parent point.
4. A point is counted complete only after all of its required subpoints, tests, documentation, approvals, migrations, integrations and evidence are complete.
5. Allowed statuses are:
   - `NOT STARTED`
   - `IN PROGRESS`
   - `BLOCKED`
   - `UNDER REVIEW`
   - `COMPLETE`
6. The only valid closure declaration is:

   > **POINT N — COMPLETE**

7. Starting code or design work does not complete a point.
8. A merged pull request alone does not complete a point unless its acceptance criteria are satisfied.
9. Demo, preview, projection-only or local-only behaviour cannot be accepted as production completion.
10. Any new work caused by correction, redesign, audit, overhauling, security remediation or integration must be attached to its relevant point as a subpoint.

## 2. Completion evidence standard

A point may be closed only when the applicable evidence is recorded:

- architecture or design decision
- source-code commit or merged pull request
- schema or migration evidence
- automated test result
- typecheck, lint and build result
- security validation
- runtime/UAT evidence
- deployment evidence
- cross-app contract validation
- documentation update
- remaining-risk statement

## 3. Dependency rule

A point may begin early when useful, but it cannot be declared complete while a required predecessor remains incomplete. Any dependency exception must be explicitly documented.

## 4. Progress calculation

- Each completed primary point equals `1%`.
- Subpoints do not independently increase the percentage.
- Programme progress is expressed as `completed primary points / 100`.

## 5. Standard status report

```text
Current Point: N
Status: NOT STARTED | IN PROGRESS | BLOCKED | UNDER REVIEW | COMPLETE
Subpoints: Na, Nb, Nc
Dependencies: ...
Blockers: ...
Completion Evidence: ...
Programme Progress: X/100
```

---

# Master Completion Sequence

## Phase A — Architecture, security and shared foundation

| Point | Work item | Status |
|---:|---|---|
| 1 | Establish the master programme register | IN PROGRESS |
| 2 | Verify the current state of all five repositories | NOT STARTED |
| 3 | Complete exposed-secret verification and remediation | NOT STARTED |
| 4 | Freeze repository ownership boundaries | NOT STARTED |
| 5 | Freeze the canonical application authority map | NOT STARTED |
| 6 | Create the canonical entity register | NOT STARTED |
| 7 | Freeze shared identity rules | NOT STARTED |
| 8 | Freeze the role and permission model | NOT STARTED |
| 9 | Freeze the canonical audit model | NOT STARTED |
| 10 | Freeze event and command standards | NOT STARTED |
| 11 | Freeze idempotency and duplicate-prevention standards | NOT STARTED |
| 12 | Freeze the canonical order lifecycle | NOT STARTED |
| 13 | Freeze the customer-safe order status projection | NOT STARTED |
| 14 | Freeze the environment matrix | NOT STARTED |
| 15 | Make Supabase Core the migration and shared-contract authority | NOT STARTED |

## Phase B — Shared platform implementation

| Point | Work item | Status |
|---:|---|---|
| 16 | Consolidate shared authentication | NOT STARTED |
| 17 | Implement shared company, branch and contact hierarchy | NOT STARTED |
| 18 | Implement shared role-based access control | NOT STARTED |
| 19 | Implement step-up authentication for sensitive mobile actions | NOT STARTED |
| 20 | Implement the shared event ledger | NOT STARTED |
| 21 | Implement shared notification infrastructure | NOT STARTED |
| 22 | Implement shared document and file-storage governance | NOT STARTED |
| 23 | Implement shared realtime-channel standards | NOT STARTED |
| 24 | Implement shared integration error and retry handling | NOT STARTED |
| 25 | Implement schema-drift and migration validation in CI | NOT STARTED |

## Phase C — AI Studio: product authority

| Point | Work item | Status |
|---:|---|---|
| 26 | Audit and stabilise AI Studio’s current repository state | NOT STARTED |
| 27 | Complete Fast Create foundation | NOT STARTED |
| 28 | Complete duplicate and similar-product detection | NOT STARTED |
| 29 | Complete barcode, OCR, voice and pasted-text intake | NOT STARTED |
| 30 | Complete AI-assisted field extraction and suggestions | NOT STARTED |
| 31 | Complete the Full Editor data architecture | NOT STARTED |
| 32 | Complete product and variant hierarchy | NOT STARTED |
| 33 | Complete pack, inner-pack, carton and pallet hierarchy | NOT STARTED |
| 34 | Complete ingredients, allergens, shelf-life and storage fields | NOT STARTED |
| 35 | Complete dimensions, weight and CBM handling | NOT STARTED |
| 36 | Complete MOQ, lead-time and commercial-readiness fields | NOT STARTED |
| 37 | Complete packaging and label-readiness fields | NOT STARTED |
| 38 | Complete product workflow states | NOT STARTED |
| 39 | Complete approval, rejection, correction and resubmission workflow | NOT STARTED |
| 40 | Complete product version history and audit | NOT STARTED |
| 41 | Complete media workspace | NOT STARTED |
| 42 | Implement controlled photography image families | NOT STARTED |
| 43 | Implement Bateel-derived photography governance | NOT STARTED |
| 44 | Implement guided mobile camera capture | NOT STARTED |
| 45 | Implement AI image enhancement with exact-product preservation | NOT STARTED |
| 46 | Implement image quality validation | NOT STARTED |
| 47 | Implement WebP, WebM, print and UHD output generation | NOT STARTED |
| 48 | Implement AI product naming and description generation | NOT STARTED |
| 49 | Implement multilingual content and selling-point generation | NOT STARTED |
| 50 | Implement catalogue, WhatsApp, website and label-copy outputs | NOT STARTED |
| 51 | Complete AI Studio mobile product creation | NOT STARTED |
| 52 | Complete AI Studio mobile approval and controlled launch | NOT STARTED |
| 53 | Implement deferred-detail handling | NOT STARTED |
| 54 | Implement the approved-product publication contract | NOT STARTED |
| 55 | Publish operational product data to Central | NOT STARTED |
| 56 | Publish customer-safe product data to the Customer App | NOT STARTED |

## Phase D — Central: CRM, intake and command

| Point | Work item | Status |
|---:|---|---|
| 57 | Audit and stabilise Central’s current live, partial and demo modules | NOT STARTED |
| 58 | Remove or unmistakably label demo and projection-only authority | NOT STARTED |
| 59 | Build the canonical Customer 360 | NOT STARTED |
| 60 | Implement company, branches, contacts and buyer hierarchy | NOT STARTED |
| 61 | Implement CRM communication history | NOT STARTED |
| 62 | Implement calls, WhatsApp, email, notes and promises | NOT STARTED |
| 63 | Implement tasks, follow-ups, opportunities and samples | NOT STARTED |
| 64 | Implement customer health, risk and next-best-action logic | NOT STARTED |
| 65 | Implement fragmented WhatsApp message grouping | NOT STARTED |
| 66 | Implement employee sender and original customer identification | NOT STARTED |
| 67 | Complete WhatsApp packet-to-draft workflow | NOT STARTED |
| 68 | Complete WhatsApp draft review and correction | NOT STARTED |
| 69 | Implement approved WhatsApp draft to live order creation | NOT STARTED |
| 70 | Build one canonical order-intake authority | NOT STARTED |
| 71 | Complete the Central Order Pool | NOT STARTED |
| 72 | Implement order duplicate detection and source attribution | NOT STARTED |
| 73 | Implement price, MOQ, carton and customer-term validation | NOT STARTED |
| 74 | Implement order priority, owner, SLA and escalation | NOT STARTED |
| 75 | Implement amendment, cancellation and substitution control | NOT STARTED |
| 76 | Implement partial and split fulfilment | NOT STARTED |

## Phase E — Central: finance, inventory and manufacturing

| Point | Work item | Status |
|---:|---|---|
| 77 | Consolidate finance into one canonical authority | NOT STARTED |
| 78 | Complete payment-proof review and bank reconciliation | NOT STARTED |
| 79 | Complete wallet, prepaid, credit and available-credit logic | NOT STARTED |
| 80 | Complete holds, releases, reversals and second approvals | NOT STARTED |
| 81 | Complete ageing, exposure, credit notes, refunds and disputes | NOT STARTED |
| 82 | Build the real Inventory Command Centre | NOT STARTED |
| 83 | Implement reservation and double-reservation prevention | NOT STARTED |
| 84 | Implement stock states | NOT STARTED |
| 85 | Implement batch, shelf-life, FEFO/FIFO and location control | NOT STARTED |
| 86 | Implement automatic department queue creation from orders | NOT STARTED |
| 87 | Complete production department execution | NOT STARTED |
| 88 | Complete department targets, allocation, start, pause and completion | NOT STARTED |
| 89 | Complete wastage, rejection, shortage, blocker and quality-hold flows | NOT STARTED |
| 90 | Complete Assembly Management | NOT STARTED |
| 91 | Complete Ready Goods Store and Third-Party Store | NOT STARTED |
| 92 | Complete Packing Management and carton-building rules | NOT STARTED |

## Phase F — Trace, dispatch and physical compliance

| Point | Work item | Status |
|---:|---|---|
| 93 | Freeze the Central–Trace command and event contract | NOT STARTED |
| 94 | Complete product, batch, pack and carton barcode identities | NOT STARTED |
| 95 | Complete label printing, reprinting and verification | NOT STARTED |
| 96 | Complete signed scan ingestion, offline retry and duplicate prevention | NOT STARTED |
| 97 | Complete physical handovers across all departments | NOT STARTED |
| 98 | Complete Dispatch Readiness, Loading, Finalisation and Gate Release | NOT STARTED |
| 99 | Embed Trace into Central PC, mobile, handheld and Smart TV surfaces | NOT STARTED |

## Phase G — Customer App and final launch

| Point | Work item | Status |
|---:|---|---|
| 100 | Complete, integrate, test and launch the full App-Verse | NOT STARTED |

### Point 100 controlled subpoints

- `100a` Customer App authentication and onboarding
- `100b` Customer App catalogue
- `100c` Product detail
- `100d` Order Desk
- `100e` Quotes and orders
- `100f` Accounts and payments
- `100g` Tracking and documents
- `100h` Support and Selling Support
- `100i` Central desktop/mobile dashboards
- `100j` Operator handheld and Smart TV completion
- `100k` Cross-app end-to-end UAT
- `100l` Security, performance, accessibility and resilience acceptance
- `100m` Production deployment and formal launch acceptance

---

# Point 1 acceptance criteria

Point 1 is complete only when:

- the permanent register exists in version control;
- all 100 primary points are present;
- the subpoint convention is documented;
- status values are frozen;
- completion evidence requirements are documented;
- progress calculation is documented;
- dependency handling is documented;
- the formal closure declaration is documented;
- the register is reviewed for numbering continuity and duplicates;
- Point 1 is updated to `COMPLETE` after verification.

# Point 1 execution record

| Subpoint | Requirement | Status |
|---|---|---|
| 1a | Create persistent GitHub register | COMPLETE |
| 1b | Record all 100 points | COMPLETE |
| 1c | Record status and subpoint rules | COMPLETE |
| 1d | Record evidence and dependency rules | COMPLETE |
| 1e | Verify sequence continuity and uniqueness | PENDING |
| 1f | Update Point 1 status and issue formal closure declaration | PENDING |
