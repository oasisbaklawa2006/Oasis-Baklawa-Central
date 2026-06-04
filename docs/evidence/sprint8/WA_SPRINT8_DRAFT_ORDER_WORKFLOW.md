# Sprint 8 — Draft Order Read-Only Workflow

**Environment:** Staging recommended — https://cursor-central-vercel.app/admin/operator-inbox  
**Account:** Inbox reader role (e.g. `SUPPORT_EXECUTIVE`)  
**Date:** 2026-06-04

---

## Workflow steps

1. **Open operator inbox** — select an open packet with inbound order-like text.  
2. **Wait for resolution chain** — WA-03A → WA-04A → WA-05A → WA-06A panels load in sticky header.  
3. **Scroll insights column** — locate **Draft order extraction** panel (teal border, below “Draft order hints”).  
4. **Review draft projection:**
   - Client from WA-04A  
   - Product lines from WA-05A + WA-06A  
   - Readiness scores (5 dimensions)  
   - Original text excerpt + conversion explanation  
   - Governance slots (owner, creator, handler)  
5. **Optional local workflow (no server writes):**
   - **Edit (local)** — change line quantities  
   - **Approve (local)** / **Reject (local)** — records decision in browser localStorage  
   - **Reset local** — clears local state  
6. **Verify forbidden paths:** No new rows in `orders` / `order_items`; governance bar “Approve Draft” still disabled.

---

## Pass criteria

| Check | Expected |
|-------|----------|
| Panel appears after packet select | Yes, when resolution upstream runs |
| Panel copy | “read-only · not persisted to orders” |
| Line items | At least one when product + quantity resolve |
| Readiness dimensions | 5 rows when extraction ready |
| Local approve | Badge “Local decision: approved”; no SO created |
| DB unchanged | No insert to orders tables |

---

## Screenshot checklist (staging)

Capture when authorized on staging:

| File | Content |
|------|---------|
| `draft-order-panel-ready.png` | Full panel with lines + readiness |
| `draft-order-readiness-scores.png` | Five dimension scores visible |
| `draft-order-local-approve.png` | Local approve badge after click |
| `draft-order-edit-local.png` | Edit mode with quantity input |

**Note:** Screenshots not captured in CI — attach to `docs/evidence/sprint8/` during staging session.

---

## Validation commands

```bash
npm run typecheck
npx vitest run src/lib/wa-governance/tests/draftOrderExtraction.test.ts
npx vitest run src/lib/wa-governance/tests/operatorInboxStage1Guard.test.ts
```

---

*Sprint 8 stops at draft generation — no live business transactions.*
