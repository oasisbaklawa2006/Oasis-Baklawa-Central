# PHASE 18 — Go-live command center

**Event:** Execution OS production cutover  
**Production DB:** `tcxvcatsqqertcnycuop`  
**Production app:** Vercel @ `189177dfd70407ac02b042cd11a7a5f24f846e44`  
**War room channel:** _________________________  
**Change ticket:** _________________________

---

## 1. Role roster (fill before T-24h)

| Role | Name | Phone / Slack | Backup |
|------|------|---------------|--------|
| **Engineering owner** | | | |
| **DBA owner** | | | |
| **Finance owner** | | | |
| **Dispatch owner** | | | |
| **Inventory owner** | | | |
| **Pilot coordinator** | | | |
| **Ops / change manager** | | | |
| **Executive sponsor (optional)** | | | |

---

## 2. Package index

| Package | Document |
|---------|----------|
| Migration | `PHASE_18_MIGRATION_EXECUTION_PACKAGE.md` |
| Pilot | `PHASE_18_PILOT_EXECUTION_PACKAGE.md` |
| Containment | `PHASE_18_ROUTE_CONTAINMENT_PLAN.md` |
| Reprobe SQL | `PHASE_15_5_PRODUCTION_REPROBE.md` |
| Company checklist | `PHASE_17_COMPANY_ROLLOUT_CHECKLIST.md` |

---

## 3. Deployment timeline

All times **UTC** — adjust to local war room clock.

### T-24h (day before)

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| | Confirm change ticket approved | Ops | ☐ |
| | Confirm maintenance window communicated to users | Ops | ☐ |
| | Engineering: verify Vercel prod SHA + env vars (`VITE_EXECUTION_PREVIEW_FALLBACK=false`, `VITE_STOCK_FINALIZATION_DEMO=false`) | Eng | ☐ |
| | DBA: confirm backup capability / PITR | DBA | ☐ |
| | Pilot coordinator: select 5 candidate orders (draft list) | Pilot coord | ☐ |
| | Finance/Dispatch/Inventory: confirm role holders available T0–T+4h | All owners | ☐ |
| | Distribute route containment plan; schedule 15-min briefings | Pilot coord | ☐ |
| | Clone `cutover-artifacts` folder on engineer machine | Eng | ☐ |

### T-4h

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| | `git checkout 189177dfd70407ac02b042cd11a7a5f24f846e44` | Eng | ☐ |
| | `supabase link --project-ref tcxvcatsqqertcnycuop` | Eng | ☐ |
| | `migration list --linked` → archive PRE | Eng | ☐ |
| | Final GO/NO-GO poll in war room | Ops | ☐ |

### T-1h

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| | DBA on bridge; no other DDL | DBA | ☐ |
| | Pre-deploy SQL counts run | DBA/Eng | ☐ |
| | Containment sign-off sheet complete | Pilot coord | ☐ |
| | Five-order matrix finalized (UUIDs filled) | Pilot coord | ☐ |
| | Operators confirm login + staff role | Dispatch/Finance/Inventory | ☐ |

### T0 (migration start)

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| | DBA: backup / snapshot start | DBA | ☐ |
| | DBA: backup complete — ID logged | DBA | ☐ |
| | Eng: `npx supabase db push` | Eng | ☐ |
| | War room: live narration of push log | Eng | ☐ |

### T+15m

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| | `migration list --linked` POST archived | Eng | ☐ |
| | Reprobe G1–G8 | Eng/DBA | ☐ |
| | DBA sign-off GO/NO-GO pilot | DBA | ☐ |

### T+30m

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| | UI smoke 6 boards | Eng | ☐ |
| | Screenshots to change ticket | Eng | ☐ |
| | War room: announce schema LIVE or STOP | Ops | ☐ |

### T+1h

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| | **First production order → 4B** (Order #1 only if GO) | Dispatch | ☐ |
| | Pilot coordinator monitors containment | Pilot coord | ☐ |
| | SQL after 4B (order 1) | Eng | ☐ |

### T+4h

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| | Target: orders 1–3 through 4G or documented hold | All operators | ☐ |
| | Mid-point war room: blockers? | Ops | ☐ |
| | Escalation review (E1–E7) | Pilot coord | ☐ |

### T+1 day

| Time | Activity | Owner | Status |
|------|----------|-------|--------|
| | Complete orders 4–5 if not done | Operators | ☐ |
| | Post-pilot E1–E5 | Ops | ☐ |
| | Phase 18 outcome / pilot report | Eng | ☐ |
| | Expand to 10 orders? (GO/NO-GO) | Sponsor | ☐ |
| | Lift containment for non-pilot orders (Class A rollback policy) | Ops lead | ☐ |

---

## 4. Decision log (fill live)

| Time (UTC) | Decision | By | Notes |
|------------|----------|-----|-------|
| | GO / NO-GO migrate | | |
| | GO / NO-GO pilot | | |
| | HALT pilot (Y/N) | | |
| | | | |

---

## 5. Contact escalation tree

```
Operator issue → Supervisor (Dispatch/Finance/Inventory owner)
       → Pilot coordinator
              → Engineering owner (schema/UI)
              → DBA owner (DB/RLS)
                     → Executive sponsor (halt/continue)
```

---

## 6. Status board (template)

| Workstream | Status | Blocker |
|------------|--------|---------|
| Migration | NOT STARTED / IN PROGRESS / DONE | |
| Reprobe | | |
| UI smoke | | |
| Containment | | |
| Pilot order 1 | | |
| Pilot order 2 | | |
| Pilot order 3 | | |
| Pilot order 4 | | |
| Pilot order 5 | | |

---

*End of go-live command center.*
