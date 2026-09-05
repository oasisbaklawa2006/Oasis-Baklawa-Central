# External physical evidence — post-#483 buyer approval (iPhone)

**Source:** Operator-supplied physical iPhone screen recording (external to repo; not committed here).  
**Maps to:** UAT-0018, UAT-0020, FAIL-481-001/002, FAIL-UX-481-001/002, **FAIL-485-001** (new).  
**Deploy baseline:** main `ace340fe1d122a4cce5d7bb61cd237ed7ba1c894` (#483 merged, Vercel SUCCESS).

## Observed (physical recording — pre-governed-crawl)

| Step | Observation | Prior FAIL-ID disposition |
|---|---|---|
| Pricing Slab dropdown | Visible above sheet | FAIL-481-001 / FAIL-UX-481-001 — **provisional PASS** pending governed re-crawl |
| B2B slab | Selectable | Same |
| Account Manager | Selectable with options | FAIL-481-002 / FAIL-UX-481-002 — **provisional PASS** pending governed re-crawl |
| Approve & Activate | Enabled; operator completed approval | Functional overlay chain appears fixed on production |
| Success toast | Shown | — |
| Pending list | Empty after approval | — |
| **Pending Review KPI (top)** | Still shows **1** while list empty | **FAIL-485-001** — KPI stale |
| **Recently Approved** | Appears unchanged | Must truth-check — routed to Central **#485** |

## Governance rule

Physical recording alone does **not** close UAT FAIL-IDs. Governed authenticated re-crawl on deployed main must reproduce S0–S3 evidence in `post-fix-483/` before FAIL-481-* / FAIL-UX-481-* are marked **CLOSED** in the master ledger.

**FAIL-485-001** remains **OPEN** — repair authority Central issue **#485**; UAT programme read-only.

## Governed crawl target

`npm run test:uat-post-fix-483` / GHA `uat-crawl-evidence.yml` with `TEST_SALES_*` on production deploy URL.
