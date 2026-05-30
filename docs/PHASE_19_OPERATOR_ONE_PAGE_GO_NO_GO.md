# Production migration — one-page GO / NO-GO

**Project:** `tcxvcatsqqertcnycuop` · **App SHA:** `189177dfd70407ac02b042cd11a7a5f24f846e44`  
**Action:** `npx supabase db push` → **19** migrations (**9** = Execution OS)

---

## Before T0 — all must be YES

| ☐ | Gate |
|---|------|
| ☐ | Change ticket approved; window started |
| ☐ | War room live |
| ☐ | DBA backup/PITR done — ID: __________ |
| ☐ | `migration list --linked` → **19** local-only, **0** remote-only |
| ☐ | Repo at `189177dfd70407ac02b042cd11a7a5f24f846e44` |
| ☐ | No other DDL on production |
| ☐ | Eng lead signed RLS migration risk (`20260508155100`) |

---

## T0 — run only this

```bash
npx supabase@latest link --project-ref tcxvcatsqqertcnycuop
npx supabase@latest migration list --linked   # save PRE
npx supabase@latest db push                   # 19 migrations
npx supabase@latest migration list --linked   # save POST
```

---

## STOP immediately if

- `db push` fails  
- Any pilot table still missing after push  
- `orders` / `order_status_history` counts dropped  
- Mass login/RLS failure after push  
- Anyone suggests `migration repair` or manual SQL DDL  

---

## GO after push if

| ☐ | Check |
|---|--------|
| ☐ | `db push` exit 0 |
| ☐ | POST list: all **19** on Remote |
| ☐ | Reprobe G1–G8 PASS (`PHASE_15_5`) |
| ☐ | `/admin/dispatch-readiness` opens — no schema error |
| ☐ | DBA + Eng sign migration package |

---

## Do NOT (manual forbidden)

- Run CREATE/ALTER in SQL editor for Execution OS tables  
- `migration repair` without DBA written plan  
- `db pull` on production  
- Start pilot 4B before reprobe + containment sign-off  
- Manual INSERT into governance tables  

---

## First 4B — extra gates (after migration GO)

| ☐ | Pilot order UUID in matrix |
| ☐ | Dispatch operator staff + role OK |
| ☐ | Finance-board / finance routes avoided for pilot |
| ☐ | Pilot coordinator on bridge |

---

## Signatures (migration only)

| DBA | Eng lead | Ops |
|-----|----------|-----|
| GO / NO-GO | GO / NO-GO | GO / NO-GO |

**Full pack:** `docs/PHASE_19_PRODUCTION_MIGRATION_APPROVAL.md`
