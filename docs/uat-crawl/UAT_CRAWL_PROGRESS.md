# UAT Crawl Progress Summary

**Last updated:** 2026-09-06 (post-merge targeted proofs)  
**Branch / PR:** `cursor/physical-uat-readiness-matrix-e763` → **#462**  
**Current main (HELD):** `64a107dfc167be76673a3d18f177a72472dcb241` (#491) — **NOT deployed on Vercel**  
**Mode:** Read-only evidence — **no remediation** in this programme.

## Release hold lifted — targeted post-merge proofs

Full **131-surface current-main rebaseline HELD** until trusted Vercel deploy exists for `64a107df`. No ace340fe / 67b3d1cc substitution.

### FAST PATH A — #493 security (`8f042fa`)

| Field | Value |
|---|---|
| Merge SHA | `3bebf39c7327ed28951d4ad68a8db4c19e0f6717` |
| GitHub deployment ID | **6289603800** |
| Vercel deployment | `BCyAHAee6qn7rg2Cjop91pYaGK93` |
| Verified preview URL | `https://oasis-baklawa-central-omgfjj6e3-oasisbaklawa2006-6222s-projects.vercel.app` |
| Label | **#493 security regression ONLY — NOT current-main certification** |
| Sequence | UAT-005 first → UAT-006–010 if PASS |

### FAST PATH B — #491 KPI (`efd1419`)

| Field | Value |
|---|---|
| Merge on main | `64a107dfc167be76673a3d18f177a72472dcb241` |
| GitHub deployment ID | **6289622998** |
| Verified preview URL | `https://oasis-baklawa-central-adpz5kw86-oasisbaklawa2006-6222s-projects.vercel.app` |
| Target | FAIL-485-001 KPI convergence on **synthetic fixture only** |
| Blocker if absent | `TEST_SALES_*` or cert pending fixture `dc370b46` |

### Evidence paths (append-only)

- `docs/uat-crawl/UAT_POST_MERGE_493_PROOF.jsonl`
- `docs/uat-crawl/UAT_POST_MERGE_493_SUMMARY.json`
- `docs/uat-crawl/UAT_POST_MERGE_491_PROOF.jsonl`
- `docs/uat-crawl/UAT_POST_MERGE_491_SUMMARY.json`
- `uat-evidence/screenshots/post-merge-491-kpi/`

### Prior evidence preserved

Ace340fe-era **80/131** authenticated crawl + all pre-fix/post-fix tranche screenshots unchanged.

## Blocked secret names (values never logged)

| Secret | Blocks |
|---|---|
| `TEST_SALES_*` | FAST PATH B, post-fix-483, buyer-mobile, lane1 sales |
| `TEST_DISPATCH_*` / `TEST_ASSEMBLY_*` | FAST PATH A AI-UAT |
| `TEST_BUYER_*` | buyer-mobile |
| Trusted deploy for `64a107df` | full 131-surface rebaseline |
