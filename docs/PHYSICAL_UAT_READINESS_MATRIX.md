# Physical UAT Readiness Matrix — Workstation 5

**ASM scope:** Documentation and evidence orchestration only — no code, schema, or production mutation.  
**Audit date:** 2026-09-05 (refreshed after Central **#458** merge + production Dispatch RLS certification PASS)  
**Hardware available:** tablet, Chromebook, laptop, multiple mobile phones, smart TV, scanner.  
**Authority:** `APPVERSE_MISSION_CONTROL.md`, `appverse-control/state.json`, `docs/APP_VERSE_MASTER_PROGRAMME_REGISTER.md`.

## Software baselines (exact heads audited)

Re-verify heads before each session. A newer merge invalidates prior exact-head certification (`MERGED ≠ CLEARED`). Physical UAT evidence does not by itself clear a programme point.

| Repository | Role | Audited SHA | Latest merged anchor | Physical-UAT relevance |
|---|---|---|---|---|
| **Oasis-Baklawa-Central** | Admin / operational control tower | `ad6c05ad3e8e064953d5ee6a41b462ded2c48d44` | **#458** P0 Dispatch RBAC least-privilege (merge commit) | `/admin/dispatch-mgmt`, scan-timeline, Factory TVs, governance boards |
| **oasis-supabase-core** | Migration / RPC / RLS authority | `049950fb5f7c681c5cbcc58f0d2d7825075a52d7` | #191 POINT29-CORE preview compat overlay | Governed RPC paths; production PostgREST deny probes for Dispatch |
| **oasis-trace** | Label / barcode / scanner app | `e395b77f115803ab998266fb7459744fd743110a` | #18 POINT96 offline scan retry | Scanner ingest, offline queue, HMAC submit to Central |
| **oasis-baklawa** | Customer Buyer app (Expo RN) | `570853c14b18d652301943810f9089acc967a76a` | #8 Governance: forbid shadow backend authority | Mobile buyer journey (100a–100h subset) |
| **oasis-ai-studio** | Product editorial authority | `cdf901498c48a2716d038ddc33bee7a5170f73ab` | #138 POINT30 governed AI extraction | Media workspace software on **PR #143** head `a373564a` (not merged) |

### Cleared Dispatch software gates (formerly blocking)

| Gate | Repo | Evidence | State | Physical-UAT effect |
|---|---|---|---|---|
| P0 Dispatch RBAC least-privilege | Central | **#458** merged @ `ad6c05ad` | **MERGED** | Dispatch operator physical UAT may proceed on deployed target matching merge head |
| Production Dispatch RLS characterization | Central + Core | Workflow `.github/workflows/dispatch-rls-production-cert.yml` pin `9eeadbde17e09236f1c6ea88ca8fbefeb8bbee59`; summary **2/2 denied, 0 allowed, 0 inconclusive** on `finance_review_evidence` + `inventory_reservations` direct INSERT probes | **PASS** | PostgREST bypass concern for these surfaces is **software-certified**; physical Dispatch UAT no longer blocked on this gate |
| Point 55 legacy URL cutover | Central | #448 @ `18415df1` | **MERGED** | Governed `/admin/dispatch-mgmt` entry (Point 55 bundle row 1) |

**Dispatch physical rule (updated):** Dispatch **software** gates for operator UAT are **cleared**. Dispatch **programme clearance** still requires physical operator evidence (Point 55 bundle rows 1–10, stage 11 census, Point 98 lifecycle). Do not conflate RLS certification PASS or #458 merge with stage-11 CLEARED.

Trace scanner/device testing remains **distinct and independent** of Dispatch physical UAT.

---

## Minimal next physical session order

Run in this order to maximize evidence without duplicating setup. Skip any lane whose checklist is already accepted by Mission Control.

| Order | Lane | Devices | Programme slice | Gate note |
|---:|---|---|---|---|
| **1** | **LANE-A — Trace scanner ingest** | Scanner + laptop (+ phone offline) | Points 94–96; Trace stage 15 | Independent of Dispatch; **execute first if not yet evidenced** |
| **2** | **LANE-F — Point 41 live storage + camera** | Phone (camera) + laptop (gallery/review) | Point 41 media workspace | AI Studio **PR #143** exact-head preview only; **does not claim Point 41 COMPLETE** |
| **3** | **LANE-G — Dispatch operator physical** | Scanner + laptop (+ dispatch TV optional) | Point 55 rows 1–10; stage 11 / 98 slice | **Now READY** — #458 merged + production RLS cert PASS |
| **4** | **LANE-E — Buyer governed onboarding (100a)** | Phone | 100a auth / access request | Software wired; **do not invent PASS** for approval workflow or production golden path |
| **5** | **LANE-B/C/D — Factory floor combined** | Smart TV + scanner/tablet + laptop | Points 51–53, 87–90 | Combine in one floor session when Trace + Dispatch sessions complete |

---

## Master disposition — programme points requiring physical/device evidence

Legend: **READY** = safe to run now at audited baselines. **BLOCKED** = upstream software or authority gate. **NOT NEEDED** = no separate device session.

### Phase C — AI Studio media & publication (Points 41, 44, 55–56)

| Point | Work item | Disposition | Primary device | Blocker / note |
|---:|---|---|---|---|
| **41** | Complete media workspace | **READY** (physical) | Phone (camera) + laptop | Software on AI Studio **PR #143** @ `a373564a` (exact-head CI green); **live storage + camera UAT not PASS until checklist signed** — see LANE-F |
| 44 | Guided mobile camera capture | **READY** (partial) | Phone | Absorbed into Point 41 camera steps C1–C4; not a separate session |
| 55 | Publish operational product data to Central | **BLOCKED** | Laptop + phone | Publication contract + Core approve mapping still fail-closed |
| 56 | Publish customer-safe product data to Customer App | **BLOCKED** | Phone (Buyer) | Depends on Point 55 + Buyer Core binding |

### Phase E — Factory / stores / production (Points 87–92, ASM stages 07–10)

| Point / stage | Work item | Disposition | Devices | Blocker / note |
|---|---|---|---|---|
| 51 / stage 07 RGS | Ready Goods Store custody | **READY** | Scanner/handheld + smart TV (`/tv/rgs`) + laptop | Factory cert green (#433); use staging identities |
| 52 / stage 10 Production | Department execution + six-TV estate | **READY** | Smart TV (`/tv/*`) + phone/tablet + laptop | Fixture `E3ED28B0` / UUID `e3ed28b0-0000-4000-8000-000000000001` |
| 53 / stage 09 P&A | Assembly execution | **READY** | Scanner/handheld + tablet + laptop | `/admin/assembly-tasks` FACTORY_CURRENT |
| 54 / stage 08 3PGS | Third-party store / put-away | **READY** (partial) | Laptop + tablet | #410 merged |
| 90–92 | Assembly / RGS / packing rules | **READY** (evidence-only) | Same as 51–53 session | Software custody green |

### Phase F — Trace, dispatch, physical compliance (Points 93–99, stage 11 / 15)

| Point / stage | Work item | Disposition | Devices | Blocker / note |
|---|---|---|---|---|
| 93 | Central–Trace command contract | **NOT NEEDED** (device) | — | 64/64 Trace contract tests at Factory cert |
| 94 | Barcode identities | **READY** | Scanner + laptop | Trace @ `e395b77f` |
| 95 | Label printing / reprint / verification | **READY** (partial) | Scanner + laptop + printer LAN | Print bridge `127.0.0.1:9191` |
| 96 | Signed scan ingestion, offline retry, duplicate prevention | **READY** | Scanner + phone + laptop | **LANE-A** — distinct from Dispatch |
| 97 | Physical handovers (all departments) | **READY** (partial) | Scanner + handheld | Scan→ingest→timeline now; full handover chain needs governed fixture order |
| **98** | Dispatch readiness / loading / finalisation / gate | **READY** (physical) | Scanner + laptop + TV | Software unblocked; **physical evidence still required** |
| 99 | Trace embedded in Central / mobile / TV | **READY** (partial) | Laptop + phone + TV | After LANE-A timeline proof |
| 55 (Factory DPL slice) | Governed DPL through finance submission | **READY** (physical) | Scanner + laptop | Rows 1–10 per `docs/POINT_55_DISPATCH_DPL_CLOSURE_WORKSTATION.md` — **LANE-G** |
| **stage 11 Dispatch** | Full governed lifecycle + legacy cutover | **READY** (physical) | All dispatch devices | Software gates cleared; shipment/gate/POD physical census still separate programme work |

### Phase G — Customer app + programme closure (Point 100)

| Subpoint | Work item | Disposition | Device | Blocker / note |
|---|---|---|---|---|
| **100a** | Authentication and onboarding | **READY** (physical, staging) | Phone | `submit_b2b_trade_application_v1` wired per APP-E2E ledger; **approval + protected runtime NOT PASS** — capture onboarding UX only |
| 100b–100h | Catalogue → support | **READY** (staging software) / **NOT PASS** (production golden path) | Phone(s) | Use non-production Buyer build; Finance/document child capabilities Core-blocked |
| 100i | Central desktop/mobile dashboards | **READY** (partial) | Laptop + tablet + phone | Evidence-only |
| 100j | Operator handheld + Smart TV | **READY** | Scanner + TV + tablet | Overlaps Factory lanes |
| 100k | Cross-app E2E UAT | **BLOCKED** | All | Mission Control stage 20 LOCKED |
| 100l–100m | Security / performance / launch | **BLOCKED** | All | Stage 21 LOCKED |

### Device-efficiency map

| Session | Devices | Points / stages |
|---|---|---|
| **A — Trace scanner** | Scanner + laptop (+ phone) | 94, 95 (partial), 96, 99 (partial), Trace 15 |
| **F — Point 41 media** | Phone + laptop | 41, 44 (partial) |
| **G — Dispatch operator** | Scanner + laptop (+ TV) | 55 rows 1–10, 92 (partial), 97–98 (slice), stage 11 |
| **E — Buyer 100a** | Phone | 100a onboarding/access request only |
| **B — Production TV** | Smart TV + laptop (+ phone) | 52, 87–88, 100j |
| **C — Stores floor** | Scanner + tablet + TV | 51, 90–91 |
| **D — P&A floor** | Scanner + tablet | 53, 90 |

---

## READY device lanes — compact run sheets

### LANE-A — Trace scanner ingest (order 1 — distinct hardware proof)

**Coverage:** Points **94, 95 (partial), 96**; Trace stage **15**.  
**Disposition:** **READY** — independent of Dispatch lanes.

#### Prerequisites

| Item | Required value |
|---|---|
| Central deploy | `main` @ `ad6c05ad` or newer; `barcode-scan-ingest` on **staging** |
| Trace deploy | `main` @ `e395b77f` |
| Core deploy | `main` @ `049950fb` on same backend |
| Test account | Trace user with `dispatch` or `security` in `ols_roles` |
| Fixture | Staging SO with known CTN-SO barcode |
| Central read | `/admin/scan-timeline` |

#### Evidence checklist A1–A8

| # | Artifact | Required content |
|---:|---|---|
| A1 | Scanner photo | Device + barcode + Trace `verified` |
| A2 | Submit success | Trace `submitted` + timestamp |
| A3 | Central timeline | Gate + carton rows with order id |
| A4 | Idempotency | Duplicate submit → no extra row |
| A5 | Rejection | Wrong-barcode error captured |
| A6 | Offline retry | Phone: offline → queued → submitted → timeline row |
| A7 | Environment | Staging ref + Central/Trace/Core SHAs (no secrets) |
| A8 | Attestation | Operator, role, date, fixture order id |

---

### LANE-F — Point 41 live storage + physical camera (order 2)

**Coverage:** Programme Point **41** (media workspace).  
**Disposition:** **READY** on AI Studio exact-head preview — **software PR #143 not merged**; physical sign-off is the sole remaining programme gate per that PR.

**Authority checklist:** `oasis-ai-studio` branch `cursor/point41-media-workspace-closure-0890` @ `a373564acac6738a9f450201d8bf2c2b3a7c93a2` — sections A–E of `docs/programme/POINT41_MEDIA_LIVE_STORAGE_UAT_CHECKLIST.md` on that branch.

#### Prerequisites

| Item | Required value |
|---|---|
| AI Studio deploy | Exact-head Vercel preview for PR **#143** @ `a373564a` |
| Supabase target | Same project as preview `VITE_SUPABASE_URL`; bucket `product-media` present |
| Roles | Catalogue contributor (`/media`) + reviewer (`/media/review`) |
| Devices | **Phone** (iOS Safari / Android Chrome) for camera; **laptop** for gallery + review desk |

#### Compact steps

| Step | Device | PASS (evidence — not programme COMPLETE) |
|---|---|---|
| F1 Bucket probe | Laptop `/testing/pilot-readiness` or `/media` | Bucket reachable — not `missing` |
| F2 Gallery upload | Laptop `/media` | Valid JPEG uploads; disallowed MIME / >50 MiB rejected **before** storage |
| F3 Physical camera | **Phone** `/media` | Camera capture → upload → public URL renders on device |
| F4 Review desk | Laptop `/media/review` | Pending submission visible; reject works; **Approve hidden** (Core mapping fail-closed) |
| F5 Persistence | Phone + laptop | Hard refresh shows asset; approval-state badge correct |

#### Evidence checklist F1–F6

| # | Artifact | Required content |
|---:|---|---|
| F1 | Bucket OK | Pilot-readiness or probe screenshot |
| F2 | Validation reject | Toast for bad MIME or oversize — no storage object |
| F3 | Camera capture | Device photo of capture flow + uploaded card on phone |
| F4 | Review reject | Reviewer screenshot with rejection reason |
| F5 | Approve blocked | Screenshot showing no functional Approve (expected until Core mapping) |
| F6 | Sign-off row | Preview URL, commit `a373564a`, project ref, tester, date — **PASS/FAIL/BLOCKED** (not programme strike) |

**Do not claim:** Point 41 COMPLETE, programme Point 55/56 publish, or Core `approve_catalogue_media_submission` clearance.

---

### LANE-G — Dispatch operator physical (order 3 — newly unblocked)

**Coverage:** Point **55** bundle rows 1–10 (`docs/POINT_55_DISPATCH_DPL_CLOSURE_WORKSTATION.md`); stage **11** / Point **98** operator slice.  
**Disposition:** **READY** — Central **#458** merged; production RLS cert **PASS** on `9eeadbde`.

#### Prerequisites

| Item | Required value |
|---|---|
| Central deploy | `main` @ `ad6c05ad` on staging or Mission Control-approved target |
| Core deploy | Production/staging with deployed deny policies evidenced by RLS cert |
| Roles | `DISPATCH_MANAGER` / `DISPATCH_INCHARGE`; `FINANCE_HEAD` or `FINANCE_EXEC` for row 9 |
| Devices | **Scanner** (row 3); **laptop** (rows 1–2, 4–10); optional **dispatch TV** |
| Fixture | Controlled test order — **no ad hoc production mutation** |

#### Compact steps (rows 1–10 summary)

| Row | Scenario | PASS |
|---:|---|---|
| 1 | Governed entry `/admin/dispatch-mgmt` | Legacy URL redirects; correct role lands on governed surface |
| 2–7 | Consignment → scan → evidence → lock → DPL | Governed RPC chain; scanner resolves barcode server-side |
| 8 | Submit to Finance | `submitted_to_finance_at` visible on reload |
| 9 | Finance visibility | Submitted DPL in Accounts Release read surface |
| 10 | Legacy denial | Legacy paths fail closed for same order universe |

#### Evidence checklist G1–G5

| # | Artifact | Required content |
|---:|---|---|
| G1 | Entry + redirect | Screenshot of dispatch-mgmt + bookmark redirect |
| G2 | Scanner scan | Device + packed qty match |
| G3 | DPL + finance submit | DPL version id + finance timestamp |
| G4 | Finance read | Finance role view of submitted DPL |
| G5 | Environment | Central `ad6c05ad`, RLS cert head `9eeadbde`, order/consignment ids |

**Do not claim:** Stage 11 CLEARED, Point 98 COMPLETE, or shipment/gate/POD clearance.

---

### LANE-E — Buyer governed onboarding 100a (order 4 — staging only)

**Coverage:** Subpoint **100a** only (auth, access request, approval-pending states).  
**Disposition:** **READY** for physical UX evidence on **non-production** Buyer build @ `570853c1`.

#### Governed gate (do not invent PASS)

| Claim | Allowed | Not allowed |
|---|---|---|
| Access request form submits via `submit_b2b_trade_application_v1` | Capture staging submit success + returned `application_id` | Claim production onboarding COMPLETE |
| Approval workflow | Show approval-pending / unauthorised states | Claim admin approval or buyer activation PASS |
| Golden path | — | Claim 100a–100h production PASS or Finance/document PASS |

#### Compact steps

| Step | Phone | Evidence |
|---|---|---|
| E1 Splash/login/password recovery | Buyer staging | Bounded error copy; no raw backend errors |
| E2 Access request submit | Authenticated or guest flow per env | Form labels + successful RPC response id |
| E3 Approval-pending state | Test identity in pending state | Safe customer copy — no role codes |
| E4 Sign-out / stale session | Phone | Session terminates; no dashboard leak |

**Blockers unchanged:** production authenticated golden path; wallet/credit/statements (Core contract); general non-order support query.

---

### LANE-B — Production Smart TV wall (order 5 batch)

**Coverage:** Points 52, 87–88; stage 10. **READY.**

| Step | Device | PASS |
|---|---|---|
| Job on TV | Smart TV `/tv/arabic-sweets` (or peer line) | Fixture `E3ED28B0` visible with correct qty/status |
| Stale/error honesty | Laptop network toggle | TV shows error — not false zero |
| Readability | TV photo @ 3m | Department identity + numerals readable |

---

### LANE-C — RGS handheld + RGS TV (order 5 batch)

**Coverage:** Point 51; stage 07. **READY.**

| Step | Device | PASS |
|---|---|---|
| Reservation/issue | Scanner + `/admin/ready-goods` | Governed RPC success |
| TV mirror | Smart TV `/tv/rgs` | Matches handheld after refresh |

---

### LANE-D — P&A assembly floor (order 5 batch)

**Coverage:** Points 53, 90; stage 09. **READY.**

| Step | Device | PASS |
|---|---|---|
| Task queue | Tablet `/admin/assembly-tasks` | Governed task visible |
| Scan/consume | Scanner | Consume RPC succeeds |

---

## BLOCKED lanes — do not schedule

| Lane | Points | Reason |
|---|---|---|
| **AI Studio publish to Central/Buyer** | 55–56 | Publication + Core approve mapping not CLEARED |
| **Buyer production golden path** | 100b–100h (production) | APP-E2E: authenticated production runtime + Finance/document contracts pending |
| **Cross-app E2E** | 100k, stage 20 | Mission Control LOCKED |
| **Production readiness / formal launch** | 100l–100m, stage 21 | LOCKED |

---

## NOT NEEDED — separate device session omitted

| Item | Reason |
|---|---|
| Chromebook-only Central pass | Equivalent to laptop; fold into laptop/tablet session |
| TV for Buyer app | Phone-only customer surface |
| Scanner for AI Studio Point 41 | Phone camera is authoritative gate per Point 41 checklist |
| Duplicate Production TV per department | One TV session with two boards suffices for stage-10 slice |
| Re-running production RLS cert probes | Software-certified on `9eeadbde`; physical Dispatch UAT is operator/scanner proof |

---

## Workstation 5 stop condition

Return to Mission Control when:

1. This refreshed matrix is accepted as routing authority.
2. **LANE-A** checklist A1–A8 and/or **LANE-F** F1–F6 and/or **LANE-G** G1–G5 evidence is attached — each lane reported separately; no collapsed “everything PASS”.
3. Buyer **100a** evidence explicitly scoped as staging UX — **not** programme Point 100 COMPLETE.

**No production mutation performed by this workstation.**
