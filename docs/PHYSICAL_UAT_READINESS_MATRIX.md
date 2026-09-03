# Physical UAT Readiness Matrix — Workstation 5

**ASM scope:** Documentation and evidence orchestration only — no code, schema, or production mutation.  
**Audit date:** 2026-09-03  
**Hardware available:** tablet, Chromebook, laptop, multiple mobile phones, smart TV, scanner.  
**Authority:** `APPVERSE_MISSION_CONTROL.md`, `appverse-control/state.json`, `docs/APP_VERSE_MASTER_PROGRAMME_REGISTER.md`.

## Software baselines (exact heads audited)

Use these SHAs as the prerequisite deployment baseline for every physical session. Re-verify heads before each session; a newer merge invalidates prior exact-head certification (`MERGED ≠ CLEARED`).

| Repository | Role | `main` SHA | Latest merged anchor | Physical-UAT relevance |
|---|---|---|---|---|
| **Oasis-Baklawa-Central** | Admin / operational control tower | `4d4a938c323261131850444c68972350a491729c` | #453 Point 38 Golden Pipeline governance-board E2E | Factory TVs, dispatch-mgmt, scan-timeline, governance boards |
| **oasis-supabase-core** | Migration / RPC / RLS authority | `fd0ee0826364fed9ace376a297528b22868479ec` | #178 Finance DPL-bound final-payment PI revision | All governed RPC paths; **Core RLS companion for Dispatch still OPEN** |
| **oasis-trace** | Label / barcode / scanner app | `e395b77f115803ab998266fb7459744fd743110a` | #18 POINT96 offline scan retry + recovery certification | Scanner ingest, offline queue, HMAC submit to Central |
| **oasis-baklawa** | Customer Buyer app (Expo RN) | `570853c14b18d652301943810f9089acc967a76a` | #8 Governance: forbid shadow backend authority | Mobile buyer journey (100a–100h subset) |
| **oasis-ai-studio** | Product editorial authority | `56868701fb937e4a81847988e4cbf5ed8df0e9d6` | #139 Points 26–27,31–33 closure lane evidence matrix | Mobile capture / approval (Points 44, 51–52, 55–56) — **publication lane NOT CLEARED** |

### Pending software gates that block Dispatch final UAT

| Gate | Repo | PR / lane | Head SHA | State | Blocks |
|---|---|---|---|---|---|
| P0 Dispatch RBAC least-privilege | Central | **#458** (tracks #456) | `8a134fee7747a3af717a55963fe5c3a1ed3121f6` | **OPEN** (CI green) | Dispatch operator UAT on production/staging until merged **and** re-certified |
| Core RLS companion (PostgREST bypass) | Core | **Not open** — documented in #458 body | — | **BLOCKED** | Direct INSERT to `finance_review_evidence` / `inventory_reservations` by Dispatch roles |
| Point 55 legacy URL cutover | Central | #448 | `18415df16d99967ac91020ae8a0558234006be69` | **MERGED** | Prerequisite for governed `/admin/dispatch-mgmt` entry (rows 1–2 of Point 55 bundle) |

**Hard rule:** Do **not** schedule Dispatch **final** UAT (Point 98, stage 11 clearance, Point 55 bundle rows 8–10 with Finance visibility, gate/POD/shipment) until **#458 is merged, deployed, production re-certified with `dispatch@oasisbaklawa.com`, and the Core RLS companion lane is merged and deployed.**

Trace scanner/device testing **may proceed independently** when Trace + Central ingest baselines above are current.

---

## Master disposition — programme points requiring physical/device evidence

Legend: **READY** = safe to run now on stated devices at audited baselines. **BLOCKED** = upstream software gate. **NOT NEEDED** = no separate device session (covered elsewhere or out of scope for physical closure).

### Phase C — AI Studio publication (Points 55–56)

| Point | Work item | Disposition | Primary device | Blocker / note |
|---:|---|---|---|---|
| 55 | Publish operational product data to Central | **BLOCKED** | Laptop (AI Studio) + phone (mobile capture) | Publication contract + approval workflow not programme-CLEARED; no physical publish UAT until software lane clears |
| 56 | Publish customer-safe product data to Customer App | **BLOCKED** | Phone (Buyer app) | Depends on Point 55 + Buyer Core binding; do not run catalogue device UAT as production publish proof |

### Phase E — Factory / stores / production (Points 87–92, ASM stages 07–10)

| Point / stage | Work item | Disposition | Devices (combine in one session) | Blocker / note |
|---|---|---|---|---|
| 51 / stage 07 RGS | Ready Goods Store custody | **READY** | Scanner/handheld + smart TV (`/tv/rgs`) + laptop (setup) | Software cert green (#433); physical UAT explicitly separate; QA provisioning (#368) still blocks **automated** Lane 1 smoke — use existing staging identities (`STORE_READY_GOODS` / `RGS_ADMIN`) |
| 52 / stage 10 Production | Department execution + six-TV estate | **READY** | Smart TV (any production line `/tv/*`) + phone/tablet (HOD companion) + laptop | Factory cert 7/7 + production-truth cert green; use disposable Arabic fixture `E3ED28B0` / UUID `e3ed28b0-0000-4000-8000-000000000001` |
| 53 / stage 09 P&A | Assembly execution | **READY** | Scanner/handheld + tablet + laptop | `/admin/assembly-tasks` FACTORY_CURRENT; assembly TV remains FACTORY_PREVIEW — do not certify preview board as production |
| 54 / stage 08 3PGS | Third-party store / put-away | **READY** (partial) | Laptop + tablet | #410 merged; physical put-away/discrepancy UAT — combine with P&A session on same tablet |
| 90–92 | Assembly / RGS / packing rules | **READY** (evidence-only) | Same as 51–53 session | Software custody green; physical proof is the goal |

### Phase F — Trace, dispatch, physical compliance (Points 93–99, stage 11 / 15)

| Point / stage | Work item | Disposition | Devices | Blocker / note |
|---|---|---|---|---|
| 93 | Central–Trace command contract | **NOT NEEDED** (device) | — | Software contract tests 64/64 at Factory cert; physical proof absorbed into scanner UAT |
| 94 | Barcode identities (product/batch/pack/carton) | **READY** | Scanner + laptop | Trace @ `e395b77f`; print bridge optional for label verification |
| 95 | Label printing / reprint / verification | **READY** (partial) | Scanner + laptop + printer LAN | TSPL/ZPL via local print bridge `127.0.0.1:9191`; defer production printer until staging pilot green |
| 96 | Signed scan ingestion, offline retry, duplicate prevention | **READY** | **Scanner (primary)** + phone (Trace PWA offline) + laptop (Central `/admin/scan-timeline`) | **First READY lane — run sheet below** |
| 97 | Physical handovers (all departments) | **BLOCKED** (partial) | Scanner + handheld | Carton explorer live bind still queued post Point 96; can capture scan→ingest→timeline slice now; full handover chain waits on governed fixture order |
| 98 | Dispatch readiness / loading / finalisation / gate | **BLOCKED** | Scanner + laptop + TV | **#458 + Core RLS companion** must be production-clean first |
| 99 | Trace embedded in Central / mobile / TV | **READY** (partial) | Laptop + phone + TV | Central read surfaces; full cross-surface embed after 96–97 |
| 55 (Factory DPL slice) | Governed DPL through finance **submission** | **BLOCKED** (rows 8–10) / **READY** (rows 1–7 only after #448 deploy) | Scanner + laptop | Rows 1–7: carton scan/lock/DPL creation — **prepare only** on staging; rows 8–10 (Finance visibility, legacy denial under RBAC): **BLOCKED** until #458 + Core RLS |
| stage 11 Dispatch | Full governed lifecycle + legacy cutover | **BLOCKED** | All dispatch devices | Same as Point 98 |

### Phase G — Customer app + programme closure (Point 100)

| Subpoint | Work item | Disposition | Device | Blocker / note |
|---|---|---|---|---|
| 100a–100h | Buyer auth → tracking/support | **READY** (software) / **BLOCKED** (production golden path) | Phone(s) | Frontend complete per APP-E2E ledger; authenticated production golden path + Finance child capabilities still pending — use **staging/non-production** Buyer build only |
| 100i | Central desktop/mobile dashboards | **READY** (partial) | Laptop + tablet + phone | Role-home / workspace rail baseline #319/#321/#322; evidence-only |
| 100j | Operator handheld + Smart TV completion | **READY** | Scanner + TV + tablet | Overlaps Factory lanes 51–52; combine sessions |
| 100k | Cross-app E2E UAT | **BLOCKED** | All | Locked until upstream functional convergence (Mission Control stage 20) |
| 100l–100m | Security / performance / launch | **BLOCKED** | All | Production readiness stage 21 LOCKED |

### Device-efficiency map (one session → many points)

| Session | Devices used together | Points / stages certified without duplicate work |
|---|---|---|
| **A — Trace scanner** | Scanner + laptop (+ phone for offline) | 94, 95 (partial), 96, 99 (partial), Trace stage 15 slice |
| **B — Production TV wall** | Smart TV + laptop (+ phone HOD) | 52, 87–88, 100j (TV slice), stage 10 |
| **C — Stores floor** | Scanner/handheld + tablet + TV (RGS) | 51, 90–91, 100j (handheld slice), stages 07–08 partial |
| **D — P&A floor** | Scanner + tablet | 53, 90, stage 09 |
| **E — Buyer mobile** | Phone(s) | 100a–100h (staging), 56 prep only |
| **F — Dispatch final** | Scanner + laptop + dispatch TV | 55 rows 1–10, 97–98, stage 11 | **DO NOT SCHEDULE** |

---

## READY device lanes — compact run sheets

Each run sheet: one physical session, controlled test fixture, no production mutation unless Mission Control explicitly approves target environment.

### LANE-A — Trace scanner ingest (FIRST READY — execute now)

**Programme coverage:** Points **94, 95 (partial), 96**; Trace ASM stage **15** (device/scanner slice); contributes to **99** timeline embed.  
**Disposition:** **READY** — independent of Dispatch #458 / Core RLS.

#### Prerequisites

| Item | Required value |
|---|---|
| Central deploy | `main` @ `4d4a938c` or newer with `barcode-scan-ingest` edge deployed to **staging** Supabase project |
| Trace deploy | `main` @ `e395b77f` — build Trace PWA or run `npm run dev` on scanner bridge laptop |
| Core deploy | `main` @ `fd0ee082` on same staging backend |
| Test account | Trace user with `ols_roles` containing `dispatch` or `security` (staging identity — do not document password in evidence) |
| Fixture order | Staging SO with known CTN-SO barcode (e.g. `CTN-SO-2026-000136` pattern per `docs/CENTRAL_BARCODE_SCAN_INGEST_ENDPOINT_REPORT.md`) |
| Secrets aligned | `BARCODE_APP_SCAN_SIGNING_SECRET` (Central) = `CENTRAL_SCAN_SIGNING_SECRET` (Trace edge); `VITE_CENTRAL_SCAN_SUBMIT_ENABLED=true` on Trace |
| Central read route | `/admin/scan-timeline` (authenticated staff — `ADMIN_STAFF_ROLES`) |

#### Steps (single session)

1. **Label identity (Point 94)** — On laptop, open Trace; confirm product/carton barcode resolves to fixture order; photograph label + screen.
2. **Verified gate scan (Point 96a)** — Scan CTN-SO gate barcode on **physical scanner**; confirm local `verification_status: verified`; submit to Central.
3. **Central ingest proof** — On laptop, open `/admin/scan-timeline`; confirm new row: `scan_type=dispatch_gate`, `verification_status=verified`, matching `order_number`.
4. **Carton identity scan (Point 96b)** — Repeat for `scan_type=carton` with matching expected barcode.
5. **Idempotency (Point 96c)** — Re-submit same scan with same idempotency key; expect duplicate/no second row (count unchanged).
6. **Bad barcode rejection (Point 96d)** — Scan wrong CTN-SO; expect device rejection before submit OR Central 4xx with reason captured on screen.
7. **Offline retry (Point 96e)** — On **phone** running Trace PWA: disable network mid-scan, queue offline, restore network; confirm `retry_pending` → `submitted` and row appears in scan-timeline.
8. **HMAC failure capture (Point 96f)** — Optional negative: misconfigured secret on disposable env only; capture 401 (never on production).

#### PASS criteria

- Every successful submit creates exactly one append-only `operational_scan_records` row visible in scan-timeline within 60s.
- Duplicate idempotency produces no extra row.
- Wrong barcode does not increment packed/gate truth anywhere in Central dispatch surfaces.
- Offline queue drains without duplicate rows after reconnect.

#### Evidence checklist (attach to programme folder)

| # | Artifact | Required content |
|---:|---|---|
| A1 | Scanner photo | Device model + barcode scanned + Trace UI showing `verified` |
| A2 | Submit success | Trace UI `submitted` + timestamp |
| A3 | Central timeline | Full-screen `/admin/scan-timeline` showing both gate + carton rows with order id |
| A4 | Idempotency | Before/after row count (SQL screenshot or UI filter count) |
| A5 | Rejection | Wrong-barcode error on device or Central response |
| A6 | Offline retry | Phone screenshot sequence: offline → queued → submitted → timeline row |
| A7 | Environment record | Staging project ref + Central SHA + Trace SHA + Core SHA (no secrets) |
| A8 | Operator attestation | Named operator, role, date, fixture order id |

#### Failure capture

- Screenshot + exact error string + HTTP status; note whether failure is Trace client, Trace edge, Central ingest, or RLS.
- Do not retry with production credentials or production order ids.

---

### LANE-B — Production Smart TV wall

**Coverage:** Points 52, 87–88; stage 10. **READY.**

| Step | Device | PASS |
|---|---|---|
| Seed/open job visible on department TV | Smart TV at `/tv/arabic-sweets` (or chocolate/fusion/bakery/nuts) | Job `E3ED28B0` displays with correct qty/status; no false "No Open Jobs" |
| Read-failure honesty | Laptop toggles network off on TV | TV shows error/stale state — not zero falsely |
| HOD companion | Phone/tablet production board | Same job id visible read-only |
| Distance readability | TV photo from 3m | Numerals/status readable; department identity visible |

**Evidence:** TV photo, job UUID short id, Central SHA, timestamp.

---

### LANE-C — RGS handheld + RGS TV

**Coverage:** Point 51; stage 07. **READY** (staging identities).

| Step | Device | PASS |
|---|---|---|
| Reservation/issue on handheld | Scanner + `/admin/ready-goods` | Governed RPC success; no direct table write |
| TV mirror | Smart TV `/tv/rgs` | Custody/reservation state matches handheld after refresh |
| Negative qty | Handheld | Overflow rejected server-side |

**Evidence:** RPC success toast + TV photo + order/reservation ids.

---

### LANE-D — P&A assembly floor

**Coverage:** Points 53, 90; stage 09. **READY.**

| Step | Device | PASS |
|---|---|---|
| Assembly task queue | Tablet `/admin/assembly-tasks` | Governed task visible |
| Component scan/consume | Scanner | Scan resolves; consume RPC succeeds |
| 3PGS bridge (if shortfall) | Tablet | Requirement visible on same session if fixture has shortfall |

**Evidence:** Task id, scan barcode, before/after component qty.

---

### LANE-E — Buyer mobile (staging only)

**Coverage:** 100a–100h software surfaces. **READY** on staging/non-prod; **NOT** production golden-path certification.

| Step | Phone | PASS |
|---|---|---|
| Login → catalogue → cart → submit | Buyer staging build @ `570853c1` | SO identity returned from `submit_customer_order_v1` |
| Order detail + support ticket | Phone | Customer-safe labels only; ticket requires order id |

**Blocker for production signoff:** authenticated production golden path per APP-E2E ledger.

---

## BLOCKED lanes — do not schedule

| Lane | Points | Reason | Unblock when |
|---|---|---|---|
| **Dispatch DPL final (rows 8–10)** | 55, 92, 98 | Finance visibility + RBAC + legacy denial under real Dispatch roles | #458 merged + deployed + Core RLS companion merged + `dispatch@` re-cert |
| **Dispatch finalisation / gate / POD** | 97–98, stage 11 | Governed lifecycle incomplete on production | Same as above + shipment/gate software census |
| **AI Studio publish to Central/Buyer** | 55–56 | Publication contract NOT CLEARED | AI Studio + Core publication lane |
| **Cross-app E2E** | 100k, stage 20 | Mission Control LOCKED | Upstream module software convergence |
| **Production readiness** | 100l–100m, stage 21 | LOCKED | Stage 20 CLEARED |

---

## NOT NEEDED — separate device session omitted

| Item | Reason |
|---|---|
| Chromebook-only Central admin pass | Chromebook and laptop are equivalent for Central web; fold Chromebook into laptop/tablet session |
| TV for Buyer app | Customer app is phone-only in this programme |
| Scanner for AI Studio editorial | AI Studio mobile capture uses phone camera, not shop-floor scanner |
| Duplicate Production TV session per department | One TV session with two department boards sufficient for stage-10 slice proof |
| WhatsApp operator inbox on tablet | Software-certified; physical device evidence not in Workstation 5 closure scope |

---

## Workstation 5 stop condition

Return to Mission Control when:

1. This matrix is accepted as the programme routing authority for physical sessions.
2. LANE-A evidence checklist A1–A8 is attached for Point 96.
3. Subsequent READY lanes (B–E) are scheduled in efficiency order without Dispatch final UAT until #458 + Core RLS are production-clean.

**No production mutation performed by this workstation.**
