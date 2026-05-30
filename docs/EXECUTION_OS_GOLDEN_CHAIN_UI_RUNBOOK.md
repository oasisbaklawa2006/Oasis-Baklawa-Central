# Execution OS — Golden chain UI runbook (staging)

**Staging Supabase project:** `aruyieslaxjhnamlstpx` (do not run governed writes against production).

**Env for preview cards when live tables are empty:**

- `VITE_EXECUTION_PREVIEW_FALLBACK=true`
- Optional demo stock: `VITE_STOCK_FINALIZATION_DEMO=true`

---

## Operator sequence (UI only)

| Step | Route | Primary action | Table(s) written |
|------|--------|----------------|------------------|
| 1 | `/admin/dispatch-readiness` | Record `packing_photo`, `document_placeholder`, `gate_scan` evidence; then `manual_readiness_review` | `dispatch_readiness_evidence` |
| 2 | `/admin/finance-governance` | **Start finance review** (`credit_review` / pending); then **Record commercial release** when eligible | `finance_review_evidence` |
| 3 | `/admin/dispatch-completion` | **Review completion**; **Attest completion** when eligible | `dispatch_completion_evidence` |
| 4 | `/admin/dispatch-finalization` | **Finalize dispatch** when references + prerequisites show green | `dispatch_release_lineage`, `orders.status → dispatched` |
| 5 | `/admin/stock-finalization` | **Finalize consumption** on dispatched orders | `inventory_movements`, `stock_consumption_lineage`, balance updates |

Scans from `/admin/execution/dispatch` or barcode surfaces may satisfy gate/carton signals; governance boards still show fused read-model prerequisites.

---

## Step 1 — Dispatch readiness (`/admin/dispatch-readiness`)

1. Open board; confirm live orders or enable preview fallback.
2. Per order card, use **Record packing photo**, **Record document placeholder**, **Record gate scan** (optional ref in input; appends verified evidence).
3. Confirm prerequisite checklist turns green for packing, document, gate scan.
4. When projection reaches `ready_for_review` / `gate_eligible`, click **Record readiness review**.
5. **Pass:** `dispatch_readiness_evidence` rows for each type; no `orders.status` change.

---

## Step 2 — Finance governance (`/admin/finance-governance`)

1. **Start finance review** — writes `credit_review` / `pending` (separate from release).
2. Complete 4B gate eligibility + reservations (read model shows blockers if not).
3. When release projection is `commercially_released` and button enables, **Record commercial release**.
4. **Pass:** `finance_review_evidence` contains both `credit_review` and `commercial_release`; dispatch finance signal becomes `ready` in downstream boards.

---

## Step 3 — Dispatch completion (`/admin/dispatch-completion`)

1. Review **Completion review prerequisites** checklist on card.
2. Resolve any **Missing fusion signals** / **Completion blockers** (finance, readiness, security gate, manifest).
3. **Review completion (evidence)** then **Attest completion** when status is `completion_eligible`.
4. **Pass:** `completion_attested` evidence; order status remains not `dispatched` until step 4.

---

## Step 4 — Dispatch finalization (`/admin/dispatch-finalization`)

1. Inspect **Handoff references**: gate, completion, transporter (fused from evidence + lineage).
2. Read **Action blocked** list if finalize disabled.
3. When `canFinalize`, run **Finalize dispatch (governed)**.
4. **Pass:** `dispatch_release_lineage` append; `orders.status = dispatched`.

---

## Step 5 — Stock finalization (`/admin/stock-finalization`)

1. Order must appear with `status = dispatched`.
2. Card shows **Dispatch lineage linkage** (`dispatch_lineage_id`, gate/scan refs) and **Reservation linkage** list.
3. Resolve **Exact blockers** until **Finalize consumption** enables.
4. **Pass:** governed stock movement + consumption lineage; no silent balance adjust.

---

## Forbidden (all steps)

- Payment capture, invoice generation, e-way API, mark-dispatched bypass, stock deduction outside 4G service paths.

---

## Regression commands (local)

```bash
npm run typecheck
npm test -- --run src/lib/execution-read-models src/lib/finance-governance/__tests__/financeGovernanceService.test.ts
```
