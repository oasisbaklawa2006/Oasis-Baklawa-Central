# Immutable Ledger Refresh — 2026-09-06

**ASM-ID:** #459 evidence-reconciliation workstation  
**Authority:** Original immutable 1–100 numbering (#459)  
**Scope:** Read-only evidence census — no code, schema, or production mutations  
**Clearance rule:** `PR MERGED ≠ CLOSED` unless every mandatory gate for that original point is satisfied

---

## Five-repo heads (live-verified)

| Repo | HEAD | Notes |
|------|------|-------|
| **Central** | `80f5d391` | post-#492 AI-UAT planner quota fix |
| **Core** | `8e73d94f` | post-#202 Point20 pgTAP + post-#141 protected deploy |
| **AI Studio** | `6f8e1641` | post-#147 Point35 merge |
| **Trace** | `a5c34731` | Point93 / #20 merged — unchanged |
| **Buyer** | *(unchanged)* | #10 trade-application gate persists |

---

## (1) Original Point 20 — STRIKE AUTHORIZED → COMPLETE

**Prior withhold (2026-09-06 02:48Z):** Core #202 was test-only behavioral pgTAP over existing `operational_events` / `append_operational_event_v1` authority; production semantic/runtime evidence on exact merged head was not yet recorded.

### Closure evidence

| Gate | Evidence |
|------|----------|
| Canonical implementation | Core #17 @ `08a7fa9914d90ef1e5ab02857fdeb2fb24ababc1` — immutable `operational_events` ledger; runtime-verified per Core `docs/APP_VERSE_POINT_20_EVENT_LEDGER_RUNTIME_EVIDENCE_2026-07-23.md` |
| Duplicate authority closed | Core #193 closed **DUPLICATE** — no second ledger authority |
| Behavioral pgTAP closure | Core #202 merged @ `8e73d94fe83545ee3a84ea8b6ccbd0701e23de66` — 26 pgTAP assertions (auth, actor binding, idempotency, append-only, RLS); **test-only, no schema change** |
| Protected production deploy | Production Migration Release **#141** / run **`34008131771`** on exact SHA `8e73d94` — both jobs **SUCCESS** |
| Post-deploy verification | Production ledger verification PASS; semantic parity PASS; contract smoke PASS; provenance upload |

**Verdict:** Original Point 20 closure rule is **fully satisfied**. The #202 delta closes the prior exact-head production-evidence gap; it does not introduce new runtime authority beyond #17.

---

## (2) Original Point 35 — STRIKE AUTHORIZED → COMPLETE

**Prior state:** PARTIAL / production-blocked — Core schema gap (`carton_dimensions_cm`, `cbm`, `gross_weight_kg`) + AI #147 downstream-held.

### Closure evidence

| Gate | Evidence |
|------|----------|
| Core shared authority | Core #199 merged @ `882d6e545c32991b50812c9c11a2ab1f4a40b3d1` — `20260905130000_point35_shared_carton_shipping_authority.sql` + pgTAP |
| Protected production deploy | Release **#141** / run **`34008131771`** @ `8e73d94` — supersedes skipped-deploy #139 hold; post-deploy ledger + semantic parity PASS |
| AI Studio adapter | AI #147 merged @ `6f8e16417dcef2323d833072d23a92a32b87a833` (squash of approved head `84754d2`) |
| Exact-head gates | 60/60 focused tests; 23/23 exact-head CI; 0 unresolved review threads; collaborator approval on final head |
| Live contract | `carton_dimensions_cm` + `cbm` live write/read; `gross_weight_kg` UI-blocked by design (grams canonical) — AI `docs/programme/POINT_35_DIMENSIONS_WEIGHT_CBM_AUDIT.md` |
| Explicit out-of-scope | Central snapshot connector (25B/25C) not publishing `cbm`/`carton_dimensions_cm` — **Point 55 territory**, not Point 35 |

**Verdict:** Original Point 35 closure rule is **fully met** for Core + AI Studio authority. No post-merge runtime recertification gate applies (unlike Point 30 provider certification).

---

## (3) Original Point 94 — TRACE LANE RETRY: ACCESS STILL DENIED

**Retry action:** Attempted push to `oasisbaklawa2006/oasis-trace` from this Central-scoped agent against current main `a5c347311325607a0a82b1ffe6f76ffd0b44ce1f`.

**Exact failure:**

```
remote: Permission to oasisbaklawa2006/oasis-trace.git denied to cursor[bot].
fatal: unable to access 'https://github.com/oasisbaklawa2006/oasis-trace.git/': The requested URL returned error: 403
```

GitHub API `permissions.push` = **false**. Prior census/work at head `749a8ac` is **not re-executed** per instruction. Bounded PR `POINT94 — canonical barcode identity closure` remains **unopened**.

**Classification:** Original Point 94 remains **IN PROCESS** — software contract closure pending Trace repo write access + PR review/merge.

---

## (4) Explicitly withheld / unchanged

| Point | Status | Reason |
|------:|--------|--------|
| **18** | **IN PROCESS** | Central #493 P0 Dispatch→Finance repair; same-ID UAT-005 evidence pending post-merge retest; physical Dispatch UAT still mandatory |
| **54** | UNDER REVIEW | Core #196 audit candidate — independent reconciliation still required |
| **56 / 100** | BLOCKED | Buyer #10 governed trade-application approval |
| **68** | **COMPLETE** *(already struck)* | Prior certified closure retained |
| **71** | IN PROCESS | Central #467 sequencing-held behind #493; collaborator approval outstanding |

---

## (5) Updated safe strike set

**Prior certified count:** 15/100 — original Points **1–2, 4–15, 68**

**Net additions this refresh (+2):**

| Point | New status | Primary evidence anchor |
|------:|------------|-------------------------|
| **20** | **COMPLETE** | Core #17 + #202 @ `8e73d94` + release #141 run `34008131771` |
| **35** | **COMPLETE** | Core #199 + release #141 + AI #147 @ `6f8e1641` |

**Updated certified strike set: 17/100**

`1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 35, 68`

No speculative strikes. Point 94 global count unchanged pending Trace PR. Point 18 remains open per instruction.

---

## (6) Exact #437 row patch (Points 20 and 35 only)

Apply these replacements to the **Primary original 1–100 ledger** section of issue #437:

```diff
- - **20. Shared event ledger** — NOT STARTED.
+ - ~~**20. Shared event ledger** — COMPLETE.~~ Core #17 @ `08a7fa99` runtime-verified; Core #202 @ `8e73d94` behavioral pgTAP (26 assertions, test-only); Core #193 DUPLICATE closed; protected Production Migration Release #141 run `34008131771` SUCCESS with post-deploy ledger, semantic parity and contract smoke PASS.
```

```diff
- - **31–40** — OPEN at statuses/evidence recorded in #459; no speculative strikes.
+ - ~~**35. Dimensions, weight and CBM handling** — COMPLETE.~~ Core #199 + protected deploy via release #141 @ `8e73d94`; AI #147 merged @ `6f8e1641` (60/60 focused tests, 23/23 CI, 0 review threads). Central connector publication of `cbm`/`carton_dimensions_cm` remains Point 55 scope.
+ - **31–34, 36–40** — OPEN at statuses/evidence recorded in #459; no speculative strikes.
```

**Strike count line for #437 header:** update certified closure from **15/100** to **17/100** when Mission Control accepts this reconciliation.
