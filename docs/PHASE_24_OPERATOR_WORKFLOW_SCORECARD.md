# PHASE 24 — Operator Workflow Scorecard

**Date:** 2026-06-01  
**Scoring:** 0–100 per dimension (higher = better, except typing burden where higher = *less* typing required)  
**Sources:** `origin/main` governance components, legacy admin pages in workspace, PHASE 23B pilot outcomes.

---

## Scoring legend

| Dimension | Meaning |
|-----------|---------|
| Human clarity | Plain language, obvious next step, minimal jargon |
| Click efficiency | Few clicks to complete role task |
| Typing burden | 100 = no typing; 0 = heavy mandatory typing |
| Automation level | System infers stage, refs, qty, refresh |
| Error clarity | Actionable messages, loading/success states |
| Mobile usability | Phone/tablet at gate and floor |
| Mistake-proofing | Idempotency, order scope, legacy lockout |
| Rollout readiness | Safe for trained floor staff without SQL |

---

## Per-module scores

### Governed chain (production `main`)

| Module | Route | Human clarity | Click efficiency | Typing burden | Automation | Error clarity | Mobile | Mistake-proof | Rollout ready | **Avg** |
|--------|-------|---------------|------------------|---------------|------------|---------------|--------|---------------|---------------|---------|
| Dispatch readiness | `/admin/dispatch-readiness` | 42 | 38 | 25 | 35 | 40 | 35 | 45 | 35 | **37** |
| Finance governance | `/admin/finance-governance` | 48 | 55 | 70 | 50 | 48 | 40 | 50 | 40 | **50** |
| Dispatch completion | `/admin/dispatch-completion` | 45 | 42 | 40 | 45 | 45 | 35 | 48 | 38 | **42** |
| Dispatch finalization | `/admin/dispatch-finalization` | 40 | 45 | 55 | 42 | 42 | 30 | 35 | 32 | **40** |
| Reservation board | `/admin/reservation-board` | 38 | 35 | 45 | 48 | 44 | 30 | 42 | 30 | **39** |
| Stock finalization | `/admin/stock-finalization` | 35 | 40 | 50 | 40 | 38 | 25 | 30 | 28 | **36** |
| **Six-board chain total** | 6 routes | **41** | **42** | **48** | **43** | **43** | **33** | **42** | **34** | **41** |

### Target wizard (branch only)

| Module | Route | Human clarity | Click efficiency | Typing burden | Automation | Error clarity | Mobile | Mistake-proof | Rollout ready | **Avg** |
|--------|-------|---------------|------------------|---------------|------------|---------------|--------|---------------|---------------|---------|
| Golden Chain Operator | `/admin/golden-chain-operator` | 72 | 78 | 85 | 70 | 62 | 55 | 65 | 55 | **68** |

*Wizard scores assume merge + P0 fixes from roadmap; current branch still shows technical blockers in dev mode.*

### Legacy / parallel (operator risk)

| Module | Route | Human clarity | Click efficiency | Typing burden | Automation | Error clarity | Mobile | Mistake-proof | Rollout ready | **Avg** |
|--------|-------|---------------|------------------|---------------|------------|---------------|--------|---------------|---------------|---------|
| Order pipeline | `/admin/order-management` | 50 | 60 | 75 | 30 | 50 | 45 | **15** | **20** | **38** |
| Packing & dispatch | `/admin/packing-dispatch` | 52 | 50 | 40 | 35 | 48 | 40 | **18** | **25** | **38** |
| Dispatch management | `/admin/dispatch-mgmt` | 48 | 55 | 60 | 40 | 45 | 50 | 35 | 35 | **46** |
| Finance release board | `/admin/finance-board` | 58 | 62 | 65 | 45 | 55 | 45 | 50 | 45 | **53** |
| Security gate | `/security-gate` | 62 | 70 | 90 | 55 | 58 | **75** | 50 | 50 | **64** |
| Factory inventory | `/admin/inventory` | 45 | 50 | 50 | 35 | 42 | 40 | 40 | 40 | **43** |
| Admin operations | `/admin/operations` | 55 | 52 | 55 | 40 | 50 | 42 | 45 | 48 | **48** |

---

## Workflow scorecards (end-to-end)

### W1 — Dispatch readiness only (4B)

| Metric | Score | Notes |
|--------|-------|-------|
| Human clarity | 42 | Shows `gate_eligible`, dimension badges, table names in amber banner |
| Click efficiency | 38 | 3 evidence buttons + review + navigation |
| Typing burden | 25 | 3 manual ref fields typical |
| Time to train | 45 min | Engineering terms in help text |

### W2 — Finance release (4C)

| Metric | Score | Notes |
|--------|-------|-------|
| Human clarity | 48 | Better labels than 4B; still “commercial release” |
| Click efficiency | 55 | Fewer actions per order |
| Typing burden | 70 | Mostly confirm; reject needs reason |

### W3 — Dispatch completion (4D)

| Metric | Score | Notes |
|--------|-------|-------|
| Human clarity | 45 | Attestation language |
| Click efficiency | 42 | Multiple evidence types |
| Typing burden | 40 | Attestation / reason fields |

### W4 — Dispatch finalization (4E)

| Metric | Score | Notes |
|--------|-------|-------|
| Human clarity | 40 | finalize / publish / reversal |
| Click efficiency | 45 | Single finalize if staff know prerequisites |
| Mistake-proofing | 35 | Duplicate finalize observed (SO-113) |

### W5 — Reservation (4F)

| Metric | Score | Notes |
|--------|-------|-------|
| Human clarity | 38 | Lifecycle reference accordion confuses |
| Click efficiency | 35 | Order + line + location + qty + submit |
| Typing burden | 45 | Qty/scan/seed fields |

### W6 — Stock finalization (4G)

| Metric | Score | Notes |
|--------|-------|-------|
| Human clarity | 35 | Technical blockers list |
| Click efficiency | 40 | Toggle + finalize |
| Mistake-proofing | 30 | Wrong order row (SO-114) |

### W7 — Security gate scan

| Metric | Score | Notes |
|--------|-------|-------|
| Human clarity | 62 | Large success/error states |
| Mobile | 75 | Scanner-first |
| Mistake-proofing | 50 | Can dispatch order outside 4E lineage |

### W8 — Complete order 4B→4G (six-board)

| Dimension | Score |
|-----------|-------|
| Human clarity | **38** |
| Click efficiency | **32** |
| Typing burden | **22** |
| Automation level | **35** |
| Error clarity | **40** |
| Mobile usability | **30** |
| Mistake-proofing | **28** |
| Rollout readiness | **25** |
| **Composite** | **31** |

### W9 — Complete order 4B→4G (target wizard)

| Dimension | Target score |
|-----------|--------------|
| Human clarity | **85** |
| Click efficiency | **88** |
| Typing burden | **95** |
| Automation level | **90** |
| Error clarity | **85** |
| Mobile usability | **75** |
| Mistake-proofing | **88** |
| Rollout readiness | **85** |
| **Composite target** | **86** |

---

## Click & typing worksheet (one order, six-board)

| Stage | Page switches | Clicks | Typed fields | Decisions |
|-------|---------------|--------|--------------|-----------|
| 4B | 1 | 14 | 3 | Which evidence missing |
| 4C | 1 | 6 | 0–1 | Release vs hold |
| 4D | 1 | 10 | 1 | Attest |
| 4E | 1 | 7 | 0–1 | Finalize |
| 4F | 1 | 12 | 2–3 | Line, qty, location |
| 4G | 1 | 8 | 0–1 | Override |
| **Total** | **6** | **57** | **6–9** | **6+** |

**Wizard target:** 0–1 switches · 7 clicks · 0 typed · 1 decision per step (confirm).

---

## Role × module access matrix (recommended)

| Module | Dispatch | Finance | Stock | Supervisor | Security | CMD |
|--------|----------|---------|-------|------------|----------|-----|
| Golden chain wizard | ● | ○ (finance step) | ○ (stock steps) | ● | ○ | ● |
| Dispatch readiness | ○ | — | — | ● | — | ● |
| Finance governance | — | ● | — | ● | — | ● |
| Dispatch completion | ○ | — | — | ● | — | ● |
| Dispatch finalization | ○ | — | — | ● | — | ● |
| Reservation / stock | — | — | ● | ● | — | ● |
| Security gate | — | — | — | ○ | ● | ○ |
| Order mgmt dispatch buttons | — | — | — | ● (read) | — | ● |

● = primary · ○ = step-only when wizard routes by role · — = hide

---

## Training burden summary

| Path | Can use without training? | Training time | Who can run alone? |
|------|---------------------------|---------------|------------------|
| Six-board 4B→4G | No | 60–90 min | Supervisor + engineer backup |
| Wizard (post-P0) | Almost | 10–15 min | Dispatch + finance + stock各自的 step |
| Legacy order mgmt dispatch | Appears yes | **Harmful** | Should be **nobody** (disabled) |
| SQL fallback | No | Engineering only | DBA / agent only |

---

## Pilot anomaly impact on scores

| Anomaly | Modules penalized |
|---------|-------------------|
| Duplicate 4E finalize (113) | Dispatch finalization mistake-proofing −15 |
| 4G selector stuck (114) | Stock finalization rollout −20 |
| Reservation drift (112) | Stock + reservation automation −10 |
| Full SQL blitz (115–116) | All six-board rollout scores capped at 35 |

---

*Companion: `PHASE_24_HUMAN_EASE_UI_AUDIT.md`, `PHASE_24_GOLDEN_CHAIN_OPERATOR_WIZARD_SPEC.md`, `PHASE_24_UI_FIX_ROADMAP.md`.*
