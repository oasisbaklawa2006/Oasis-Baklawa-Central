# Physical UAT Readiness Matrix — Workstation 5

**ASM scope:** Documentation and evidence orchestration only — no code, schema, or production mutation.  
**Audit date:** 2026-09-05 (control refresh — strict software **+ production** gate audit)  
**Hardware available:** tablet, Chromebook, laptop, multiple mobile phones, smart TV, scanner.  
**Authority:** `APPVERSE_MISSION_CONTROL.md`, `appverse-control/state.json`, `docs/APP_VERSE_MASTER_PROGRAMME_REGISTER.md`.

## Software baselines (exact heads audited)

Re-verify heads before each session. Physical evidence ≠ PASS ≠ programme CLEARED.

| Repository | Role | Audited SHA | Latest anchor | Production-relevant gate |
|---|---|---|---|---|
| **Oasis-Baklawa-Central** | Admin / operational control tower | `08ccb1cfd4a3624103f0681b5515e26727e77cd2` | #479 AI-UAT sign-out (current `main`) | Dispatch RBAC from **#458** @ `ad6c05ad` — confirm live deploy SHA ≥ `ad6c05ad` |
| **oasis-supabase-core** | Migration / RPC / RLS authority | `06bc02f635be59e8cd505e41e7e963748c0feebf` | #197 POINT68 WhatsApp draft review | Production PostgREST deny for Dispatch on `finance_review_evidence` + `inventory_reservations` |
| **oasis-trace** | Scanner / label app | `e395b77f115803ab998266fb7459744fd743110a` | #18 POINT96 offline retry | Unchanged; scanner lane independent |
| **oasis-baklawa** | Customer Buyer app | `570853c14b18d652301943810f9089acc967a76a` | #8 governance | Access-request submit wired; **approval blocked on Central #481** |
| **oasis-ai-studio** | Media workspace | `c010b26e96002ca666e470d3f578b2fc1c64e362` (`main`) | POINT30 runtime remediation | Point 41 software **not on `main`** — use PR **#143** preview @ `a373564a` only |

### Production gates — cleared vs open

| Gate | State | Effect on physical UAT |
|---|---|---|
| Central **#458** Dispatch RBAC @ `ad6c05ad` | **MERGED** | Dispatch operator lane software-ready |
| Production Dispatch RLS cert pin `9eeadbde` | **PASS** (2/2 denied, 0 allowed, 0 inconclusive) | PostgREST bypass probes cleared for probed surfaces |
| Central production deploy includes #458 | **VERIFY before session** | Record deployed SHA in evidence — do not assume `main` = production |
| Trace `barcode-scan-ingest` + HMAC secrets aligned | **VERIFY on target Supabase** | Staging-first per ingest runbook; production only after staging pilot green |
| AI Studio Point 41 PR **#143** | **OPEN** (not merged) | Point 41 physical UAT **preview-only** |
| Central issue **#481** Buyer approval sheet | **OPEN** (physical FAIL recorded 2026-09-05) | **Buyer admin approval lane BLOCKED** until fix merged **and** deployed |

---

## Strict lane disposition (software + production)

Only lanes marked **READY** may be scheduled now. **READY (preview)** and **READY (staging)** require the stated deploy target. **BLOCKED** lanes include prepared re-test scripts but must not be run until gates clear.

| Lane | Focus | Disposition | Deploy target | Why |
|---|---|---|---|---|
| **A — Trace scanner** | Points 94–96 | **READY (staging)** | Staging Supabase + Trace @ `e395b77f` + Central ≥ `ad6c05ad` | Ingest software merged; independent hardware proof; production ingest not assumed |
| **F — Point 41 camera/storage** | Point 41 | **READY (preview)** | AI Studio PR **#143** Vercel preview @ `a373564a` | Software not on `main`; bucket must exist on linked Supabase project |
| **G — Dispatch operator** | Point 55 rows 1–10; 98 slice | **READY (production)** | Central production deploy SHA ≥ `ad6c05ad`; Core production with RLS cert PASS | Software + RLS gates cleared; physical evidence still outstanding |
| **H — Buyer admin approval** | 100a approval chain | **BLOCKED** | — | Issue **#481**: Pricing Slab / Account Manager selects invisible in Admin Clients sheet (z-index + role-case); pending app `dc370b46-…` stuck |
| **E — Buyer access request (phone only)** | 100a submit slice | **READY (production)** | Buyer app + production Core RPCs | Submit path works; **does not include approval PASS** |
| B/C/D — Factory floor | 51–53, 87–90 | **READY (staging)** | Staging identities / disposable cert | Deprioritized until focus lanes evidenced |

---

## Exact next human test sequence

Run **only READY lanes** below in order. Capture evidence per step. Report **OBSERVED** / **FAIL** / **BLOCKED** — never claim programme PASS without attached artifacts.

### Sequence 1 — LANE-A: Trace scanner (staging)

**Prerequisites:** Staging project with `barcode-scan-ingest` deployed; `BARCODE_APP_SCAN_SIGNING_SECRET` aligned; fixture SO with CTN-SO barcode; Trace user with `dispatch`/`security` role.

| Step | Actor / device | Screen / route | Action | Expected result | Evidence capture |
|---:|---|---|---|---|---|
| A1 | Laptop | Trace app | Open fixture order; scan/enter CTN-SO | Barcode resolves; `verification_status: verified` | Photo: label + Trace UI |
| A2 | **Scanner** | Trace scan flow | Scan gate barcode; submit | Status `submitted`; no client error | Screenshot + timestamp |
| A3 | Laptop | Central `/admin/scan-timeline` | Refresh after submit | Row: `scan_type=dispatch_gate`, matching `order_number` | Full-screen timeline screenshot |
| A4 | **Scanner** | Trace | Scan carton barcode; submit | Second distinct row path | Trace + timeline screenshots |
| A5 | **Scanner** | Trace | Re-submit same idempotency key | No duplicate row (count unchanged) | Before/after row count |
| A6 | **Scanner** | Trace | Scan wrong CTN-SO | Rejected on device or Central 4xx with reason | Error screenshot |
| A7 | **Phone** | Trace PWA | Offline mid-scan → queue → reconnect | `retry_pending` → `submitted`; one timeline row | 3-frame phone sequence |
| A8 | Laptop | Notes | Record env | Staging ref + Central/Trace/Core SHAs + fixture order id | Text block in evidence pack |

**Outcome field:** `LANE-A: OBSERVED / FAIL / BLOCKED` — not Point 96 COMPLETE until Mission Control accepts A1–A8.

---

### Sequence 2 — LANE-F: Point 41 live storage + camera (AI Studio preview)

**Prerequisites:** PR **#143** preview URL @ `a373564a`; `product-media` bucket reachable; contributor + reviewer accounts.

| Step | Actor / device | Screen / route | Action | Expected result | Evidence capture |
|---:|---|---|---|---|---|
| F1 | Laptop | `/testing/pilot-readiness` or `/media` | Bucket probe | Bucket OK — not `missing` | Probe screenshot |
| F2 | Laptop | `/media` | Gallery upload valid JPEG ≤50 MiB | Upload succeeds; card with approval badge | Success toast + card |
| F3 | Laptop | `/media` | Attempt disallowed MIME or >50 MiB | **Rejected before storage** | Validation toast; no storage object |
| F4 | **Phone** (Safari/Chrome) | `/media` | **Take photo** → complete upload | Camera intent → image on card; public URL loads on device | Device screenshots |
| F5 | Laptop | `/media/review` | Open pending submission; reject with reason | Queue shows payload; reject succeeds | Review desk screenshots |
| F6 | Laptop | `/media/review` | Confirm Approve absent/disabled | Fail-closed notice (Core mapping not finalized) | Screenshot of blocked Approve |
| F7 | Phone + laptop | `/media` | Hard refresh | Asset persists; badge unchanged | Post-refresh screenshots |
| F8 | Laptop | Sign-off row | Record preview URL, `a373564a`, project ref, tester, date | **OBSERVED/FAIL/BLOCKED** only | Sign-off table |

**Do not claim:** Point 41 COMPLETE or programme strike.

---

### Sequence 3 — LANE-G: Dispatch operator (production)

**Prerequisites:** Confirm production Central deploy SHA ≥ `ad6c05ad`; `dispatch@` or `DISPATCH_MANAGER` account; controlled test order; finance role for row 9.

| Step | Actor / device | Screen / route | Action | Expected result | Evidence capture |
|---:|---|---|---|---|---|
| G1 | Laptop | `/admin/dispatch-mgmt` | Login as dispatch role | Governed surface loads — not legacy execution URL | Entry screenshot |
| G1b | Laptop | `/admin/execution/dispatch` bookmark | Navigate | Redirects to `/admin/dispatch-mgmt` | Redirect screenshot |
| G2 | Laptop | Dispatch mgmt | Create/open consignment + carton (RPC UI) | Consignment + open carton without direct table writes | IDs on screen |
| G3 | **Scanner** | Carton scan UI | Scan governed product barcode | Packed qty increments server-side; duplicate/wrong rejected | Scanner photo + UI qty |
| G4 | Laptop | Carton flow | Capture weight/photo evidence | Evidence recorded before lock allowed | Evidence panel screenshot |
| G5 | Laptop | Carton flow | Lock carton | Locked immutable; stale version rejected if retried | Lock confirmation + reload |
| G6 | Laptop | DPL flow | Create DPL from locked cartons only | DPL version created; unlocked carton path rejected | DPL version id |
| G7 | Laptop | DPL flow | Submit active DPL to Finance | `submitted_to_finance_at` visible after reload | Timestamp screenshot |
| G8 | Laptop | Finance read surface | Login `FINANCE_HEAD`/`FINANCE_EXEC` | Submitted DPL visible — not browser-composed lines | Finance view screenshot |
| G9 | Laptop | Legacy path attempt | Open legacy packing/dispatch for same order | Fail closed (`blockLegacyB2bCartonDplMutation`) | Denial screenshot |
| G10 | Laptop | Notes | Record deploy SHA, order/consignment/DPL ids, RLS cert head `9eeadbde` | Evidence pack metadata | Text block |

**Outcome field:** `LANE-G: OBSERVED / FAIL / BLOCKED` — not stage-11 CLEARED or Point 98 COMPLETE.

---

### Sequence 4 — LANE-H: Buyer admin approval — **DO NOT RUN NOW**

**Gate:** Central issue **#481** OPEN. Physical recording 2026-09-05: Pricing Slab and Account Manager selectors non-responsive inside Admin Clients sheet (Select portal `z-50` behind Sheet `z-[200]`; mixed-case manager roles excluded).

**Status:** **BLOCKED** until bounded fix merged and deployed to production. No approval PASS may be recorded against pending application `dc370b46-ae39-44ec-9d1c-4c4bcdc9a60c` or successors until re-test below passes.

#### Re-test script (execute only after #481 fix deployed)

| Step | Actor / device | Screen / route | Action | Expected result | Evidence capture |
|---:|---|---|---|---|---|
| H1 | **Phone** | Buyer app | Submit or reuse pending access request | `application_id` returned; status `pending` | Phone screenshot + id |
| H2 | Phone or tablet | Central `/admin/clients` | Open pending application review sheet | Sheet opens; application details visible | Sheet screenshot |
| H3 | Phone/tablet | Review sheet | Tap **Pricing Slab** select | Dropdown renders **above** sheet; options visible and selectable | Video or 2-frame proof |
| H4 | Phone/tablet | Review sheet | Select active slab (production has 5) | Selection sticks; no invisible menu | Selected value visible |
| H5 | Phone/tablet | Review sheet | Tap **Account Manager** (optional) | Managers listed including mixed-case production roles | Dropdown screenshot |
| H6 | Phone/tablet | Review sheet | Approve via governed action | `approve_b2b_trade_application_v1` succeeds; `assigned_price_tier` set | Success toast + reload row |
| H7 | **Phone** | Buyer app | Login / refresh as approved buyer | Approved state — not approval-pending | Buyer dashboard screenshot |

**Outcome field:** `LANE-H: OBSERVED / FAIL` — still not 100a programme COMPLETE without golden-path scope acceptance.

---

## Minimal session order (strict)

| Order | Lane | Run now? |
|---:|---|---|
| 1 | **A — Trace scanner (staging)** | **Yes** — if staging ingest verified |
| 2 | **F — Point 41 preview (phone + laptop)** | **Yes** — on PR #143 preview only |
| 3 | **G — Dispatch operator (production)** | **Yes** — after deploy SHA check |
| 4 | **H — Buyer admin approval** | **No** — blocked on **#481** |
| 5 | **E — Buyer access request submit (phone)** | **Optional** — submit evidence only; not approval |
| — | Factory B/C/D | **Defer** until focus lanes attached |

---

## BLOCKED — do not schedule

| Item | Reason |
|---|---|
| Buyer admin approval (LANE-H) | **#481** open — physical FAIL already recorded |
| AI Studio publish 55–56 | Core approve mapping fail-closed |
| Buyer production golden path 100b–h | Finance/document Core contracts not production-exposed |
| Cross-app E2E 100k / launch 100l–m | Mission Control stages 20–21 LOCKED |

---

## NOT NEEDED

| Item | Reason |
|---|---|
| Chromebook-only pass | Fold into laptop/tablet |
| Scanner for Point 41 | Phone camera is authoritative |
| Re-run production RLS probes | Software-certified on `9eeadbde` |
| Dispatch final UAT before Trace evidence | Lanes independent — but Trace first preserves distinct hardware proof |

---

## Workstation 5 stop condition

Return to Mission Control when focus-lane evidence packs are attached with **OBSERVED/FAIL/BLOCKED** per lane — no collapsed PASS. **#481** remains a hard stop for Buyer approval until fix deploy + H1–H7 re-test.

**No production mutation performed by this workstation.**
