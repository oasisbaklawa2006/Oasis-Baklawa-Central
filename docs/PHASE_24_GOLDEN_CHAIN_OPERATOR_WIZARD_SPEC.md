# PHASE 24 — Golden Chain Operator Wizard Specification

**Route:** `/admin/golden-chain-operator`  
**Status:** Implemented on branch `origin/cursor/golden-chain-operator-wizard-3acf` — **not on `main`** at audit time  
**Goal:** One surface for SO-2026-style orders through 4B→4G without staff knowing stage codes, SQL, or evidence schema.

---

## 1. Problem statement

Production pilot proved the **data plane** works; the **UI plane** failed staff rollout:

- Six URLs, six mental models, six places to pick the wrong order.
- Mandatory typing for evidence refs staff do not have at hand.
- Legacy pages still mark orders `dispatched` without lineage.
- Stock finalization used wrong order context (SO-114).
- Duplicate finalize (SO-113).

The wizard collapses the chain into: **search order → read plain status → one primary button → auto-advance**.

---

## 2. User personas

| Persona | Wizard behavior |
|---------|-----------------|
| Dispatch operator | Sees 4B, 4D steps; finance/stock steps shown as “waiting on …” |
| Finance | Deep-link or role filter shows 4C only |
| Stock / store | 4F, 4G only when dispatch locked |
| Supervisor | All steps + override affordances |
| Security | Stays on `/security-gate`; wizard **reads** scans, does not replace gate UX |

---

## 3. Screen layout (single page)

```
┌─────────────────────────────────────────────────────────────┐
│ Golden Chain — Dispatch & Stock          [role badge]        │
├─────────────────────────────────────────────────────────────┤
│ 🔍 Search SO-2026-_______  [Recent ▼]                        │
├─────────────────────────────────────────────────────────────┤
│ SO-2026-000115 · Acme Foods · Dispatched (in progress)       │
│ Progress: ●●●○○○  Step 4 of 6 — Complete packing proof      │
│ Waiting on: Dispatch operator (you)                           │
├─────────────────────────────────────────────────────────────┤
│ What's blocking you (0)                                       │
│  (plain list, no table names)                                 │
├─────────────────────────────────────────────────────────────┤
│ [ Complete next step ]  (primary, sticky bottom on mobile)    │
│ [ View details ▾ ]  optional accordion — technical audit      │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Order search / select

- Search by **order_number** (SO-2026-NNNNNN), company name, last 4 of UUID.
- Recent orders: last 10 touched by this device/user.
- **Never** auto-select `liveRows[0]` without user confirmation (fixes 4G bug class).

### 3.2 Progress strip

Visual steps (staff labels):

| Internal stage | Staff label |
|----------------|-------------|
| `4b_readiness` | Packing proof |
| `4c_finance` | Finance approval |
| `4d_completion` | Dispatch check |
| `4e_dispatch_finalization` | Lock dispatch |
| `4f_reservation` | Hold stock |
| `4g_stock` | Deduct stock |
| `complete` | Done |

Completed steps: collapsed checkmarks. Current: expanded. Future: greyed.

### 3.3 Single primary CTA

- Label derived from stage, e.g. “Record packing proof and continue”, “Approve for dispatch (finance)”, “Deduct stock”.
- Disabled with **inline** reason list (max 3 bullets, plain language).
- Loading spinner on button; success toast with **next step name**.

### 3.4 “Who must act next”

Rule engine:

| Stage incomplete | Owner label |
|------------------|-------------|
| 4B | Dispatch / packing |
| 4C | Finance |
| 4D | Dispatch supervisor |
| 4E | Dispatch manager |
| 4F | Store / inventory |
| 4G | Store / inventory |
| complete | — |

If current user’s role cannot execute, CTA hidden; show “Ask [role] to complete [step]”.

---

## 4. Stage behavior (functional spec)

### 4.1 Stage detection

Use `loadGoldenChainOrderState(supabase, orderId)` (branch lib) — derive:

- `stage` enum
- `cta` string
- `blockers[]` human strings
- `evidenceRefs` auto-filled
- flags: `dispatchAlreadyFinalized`, reservation status, scan presence

**Auto-skip:** If 4B evidence verified in DB, do not show 4B CTA; advance projection to 4C.

### 4.2 Stage 4B — Packing proof

**Primary action (one click):**

1. Insert packing_photo, document_placeholder, gate_scan evidence with **auto refs**:
   - `packingPhotoRef`: `AUTO-PACK-{order_number}` or media vault ID after photo capture
   - `documentPlaceholderRef`: `AUTO-DOC-{order_number}`
   - `gateScanRef`: latest verified `operational_scan_records.barcode_value` for order (gate or carton)
2. Call `reviewReadiness`.

**Typing:** None. **Exception:** supervisor override reason (optional field, collapsed).

**Preconditions shown if missing:**

- “Carton not scanned — scan at Security Gate first.”
- “Finance payment not verified — send to Finance board.”

### 4.3 Stage 4C — Finance

**Primary action:** `commercialRelease` with amount from order.

**Typing:** None for approve; reject requires reason (finance only).

**Role gate:** FINANCE_HEAD, FINANCE_EXEC, SUPER_ADMIN.

### 4.4 Stage 4D — Dispatch check

**Primary action:** completion review + attestation bundle (same as board, one button).

**Typing:** None default; attestation reason auto: `Operator confirmed dispatch check`.

### 4.5 Stage 4E — Lock dispatch

**Primary action:** `finalizeDispatch` with:

- `transporterReference` from gate scan or packing dispatch fields
- `finalizeReason`: fixed staff-safe string (not shown as field)
- **Idempotency:** if finalize lineage exists → CTA = “Already locked” disabled; show lineage timestamp

**Critical:** Server-side or client guard from `dispatchFinalizeGuardMessage` — prevent duplicate finalize (SO-113).

### 4.6 Stage 4F — Hold stock

**Primary action:** `createAndReserveInventoryForOrder` per line:

- `locationCode`: default `WH-MAIN` (site policy table later)
- `reserveQty`: order line quantity
- SKU from line

**Typing:** None. **Optional advanced:** change location (supervisor dropdown).

**Skip if:** active reservation `reserved` or `fulfilled` for line.

### 4.7 Stage 4G — Deduct stock

**Primary action:** `finalizeConsumption` via stock service:

- Bind **selected order only** (never `liveRows[0]`)
- Pass `dispatchLineageId`, `scanReference`, reservation IDs from state loader
- On success: **set reservation fulfilled** (`fulfilled_qty`, `reservation_status`) — fix SO-112 class drift

**Override:** SUPER_ADMIN only; requires `overrideReason` textarea (only exception typing on happy path policy).

**Hide:** Orders already consumption-finalized.

### 4.8 Complete

- Show green summary: stock deducted, dispatch locked, who completed when (from evidence timestamps).
- Link “Print dispatch summary” (future) — not required for P0.

---

## 5. Auto-generation rules

| Field | Rule |
|-------|------|
| `correlationId` | `wizard-{stage}-{orderId}-{iso}` — never shown |
| Packing photo ref | `AUTO-PACK-{order_number}` until camera upload wired |
| Document ref | `AUTO-DOC-{order_number}` |
| Gate scan ref | Newest verified scan for `order_id` |
| Transporter ref | `{gateScan} / {courier}` or gate only |
| Reserve qty | `sum(order_items.quantity)` per SKU line |
| Location | `WH-MAIN` or company default warehouse |
| Override reason | Only if policy `requiresStockOverrideReason(role)` |

---

## 6. Error & success copy (wizard)

| Code / condition | User message |
|------------------|--------------|
| Network fail | “Connection lost. Your progress was not saved. Try again.” |
| Readiness service down | “Packing proof service unavailable. Call supervisor.” |
| Duplicate finalize | “This order was already dispatch-locked at {time}.” |
| No scan | “Scan carton at Security Gate before continuing.” |
| Insufficient stock | “Not enough {SKU} at {location}. Available: {n}.” |
| Wrong role | “Finance must approve this order. Notify {finance contact}.” |
| Success 4B→4C | “Packing proof saved. Next: Finance approval.” |

No bare “Unknown”. Map `ReservationError` codes to table above.

---

## 7. Non-functional requirements

| Requirement | Detail |
|-------------|--------|
| Idempotency | All stages safe to retry; 4E/4G double-click no-op |
| Auto-refresh | After write, `reloadOrder(orderId)`; no manual page reload |
| Performance | Order load &lt; 2s P95 on production |
| Offline | Disable CTA; show offline banner |
| Audit | All writes keep `metadata.source = 'golden_chain_operator_wizard'` |
| Feature flag | `VITE_GOLDEN_CHAIN_WIZARD_ENABLED` default true on prod after pilot |
| Legacy lock | When flag on, disable dispatch status buttons elsewhere |

---

## 8. Navigation & rollout

### 8.1 Sidebar

- **Operators:** single item “Dispatch & Stock (guided)” → wizard route.
- **Supervisors:** wizard + “Advanced boards” collapsed group (six boards).

### 8.2 Role routing

On login, `DISPATCH_INCHARGE` with order in 4B queue → optional redirect to wizard with `?order=`.

### 8.3 Migration from six-board

| Phase | Behavior |
|-------|----------|
| P0 | Wizard on for pilot users; boards hidden from dispatch roles |
| P1 | Wizard default; boards supervisor-only |
| P2 | Deprecate boards from nav; retain deep links for audit |

---

## 9. Acceptance criteria (UAT)

1. SO-2026-000117 (new pilot) completes 4B→4G with **≤8 clicks**, **0 typed fields**, **1 URL**.
2. No duplicate `finalize` lineage on double-click.
3. 4G always uses selected order; stock decreases match reservation qty.
4. Reservation → `fulfilled` after 4G.
5. Order Management cannot set `dispatched` when wizard flag enabled (403 or disabled button + explanation).
6. Security gate scan auto-fills 4B gate evidence on wizard refresh.
7. Finance-only user can complete 4C from wizard without seeing stock fields.

---

## 10. Gap list vs existing branch implementation

| Spec item | Branch status |
|-----------|---------------|
| Order search | Present (`searchGoldenChainOrders`) |
| Stage derivation | Present (`loadGoldenChainOrderState`) |
| One-click 4B bundle | Present in `runPrimaryAction` |
| 4F auto-reserve | Partial — verify line iteration |
| 4G order scope | **Verify** not using first row only |
| Idempotent 4E | Partial — `dispatchFinalizeGuardMessage` |
| Role-based CTA hide | **Needs** UI pass |
| Legacy route lock | **Not implemented** |
| Human blocker copy | **Needs** mapper from technical strings |
| Mobile sticky CTA | **Needs** CSS |
| Merge to main | **Pending** |

---

## 11. Out of scope (PHASE 24)

- Schema migrations
- New evidence types
- Buyer-facing tracking changes
- WhatsApp notifications on stage complete (P2)

---

*Implementation track: merge `cursor/golden-chain-operator-wizard-3acf` → apply `PHASE_24_UI_FIX_ROADMAP.md` P0 items → UAT on SO-2026-000117+.*
