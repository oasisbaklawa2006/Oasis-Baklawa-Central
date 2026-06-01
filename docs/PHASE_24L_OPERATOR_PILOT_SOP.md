# Phase 24L — Golden Chain Operator Pilot (Staff SOP)

**For:** Dispatch, finance, and inventory staff in the limited pilot  
**Tool:** Admin → **Golden Chain Operator** (`/admin/golden-chain-operator`)  
**Do not use:** Old six-board pages or order-pipeline status buttons unless your supervisor explicitly tells you to.

---

## Before you start

1. Sign in with your normal Oasis admin account.
2. Open **Golden Chain Operator** from the left menu (Operations section).
3. If you do not see it, tell your supervisor — do not guess another screen.
4. Confirm the order number on screen matches the paper or WhatsApp reference **before** every click.

---

## How to work an order (every time)

### 1. Search the order

- Type the sales order number (for example `SO-2026-000136`) or part of the customer name in the search box.
- Pick the correct row from the list. Read the company name and status line twice.
- If two orders look similar, stop and ask a supervisor.

### 2. Read the stage strip

The coloured steps across the top show where the order is:

| Step | Plain meaning | Who usually acts |
|------|----------------|------------------|
| Prepare evidence | Packing photos, documents, gate/carton scans recorded | Dispatch / packing |
| Finance | Commercial release — payment and accounts rules cleared | Finance |
| Readiness | Formal readiness review passed | Dispatch supervisor |
| Completion | Dispatch completion attested | Dispatch supervisor |
| Finalize | Dispatch locked in the system | Dispatch manager |
| Reserve | Stock reserved for this order | Store / inventory |
| Stock | Stock deducted after dispatch | Store / inventory |
| Done | Order finished on the golden chain | No one |

Only steps up to the current one are “done”. The big button is always **one** next action.

### 3. Click the next action

- Press the main button (for example **Prepare dispatch evidence**, **Complete finance release**, **Finalize dispatch**).
- Wait for the green success message. Do not double-click.
- If the button is greyed out, read the yellow/red blocker text on the card — it tells you what is missing.

### 4. Move to the next order

- Use search again for the next SO.
- Do not leave half-finished orders unless your supervisor assigns a handover.

---

## What each stage means (short)

- **Prepare evidence** — Proof that packing and gate scans are on file. Dispatch fills packing proof and scan references.
- **Finance** — Finance confirms the order is commercially released (advance / payment rules satisfied).
- **Readiness** — Governed readiness check before completion.
- **Completion** — Supervisor attests dispatch is complete in the business sense.
- **Finalize dispatch** — System records dispatch finalization (cannot skip; duplicate finalize is blocked).
- **Reserve stock** — Inventory reserves quantity for this order after dispatch is finalized.
- **Stock / finalize stock** — Inventory deducts stock and completes consumption; reservations should show fulfilled when done.
- **Done** — No further golden-chain action on this order.

---

## If you are blocked

| Situation | What to do |
|-----------|------------|
| Button disabled with a message | Read the message; fix only what your role is allowed to fix |
| “Dispatch already finalized” | Continue with **Reserve stock** — do not try old finalize screens |
| “Needs supervisor review” / inconsistent state | Stop. Do not change order status elsewhere. Call supervisor |
| Search finds no order | Check SO spelling; ask supervisor if order is not cleared for dispatch |
| Error toast after click | Note exact text + SO + time. Do not repeat blindly. Call supervisor |
| Role denied / inventory message | Your login cannot do that step — hand to store lead or supervisor |
| Page stuck on old button after success | Wait 10 seconds and refresh once; if still wrong, call supervisor with SO number |

---

## When to call finance

Call finance (or use your team channel) when:

- The stage strip shows **Finance** and you are not a finance user.
- Blockers mention payment, advance, commercial release, or accounts release.
- Payment status is not cleared and dispatch is waiting on money rules.
- You are dispatch and the order should be finance-clear but the wizard still asks for finance.

Finance staff: work **only** in Golden Chain Operator for release during this pilot — not the old finance governance audit board unless supervisor says otherwise.

---

## When to call inventory / supervisor

Call inventory or your supervisor when:

- Stage is **Reserve** or **Stock** and you cannot reserve or finalize.
- Message says stock unavailable, balance short, or override reason required.
- Scanner or gate scan references do not match what was physically scanned.
- Reservation exists but stock step will not complete.
- You need a stock override reason typed in the wizard.

Call **supervisor** (not inventory alone) when:

- “Inconsistent state” or duplicate finalize warnings appear.
- You are unsure which order is selected.
- Any instruction conflicts with this SOP.

---

## Never use old boards (unless supervisor says so)

During Phase 24L pilot, **do not** use these as your main workflow:

- Dispatch readiness / completion / finalization **(audit)** boards  
- Reservation board **(audit)**  
- Stock finalization **(audit)** board  
- Finance governance **(audit)** board  
- **Order Pipeline** or **Packing & Dispatch** status changes for golden-chain steps  
- **Dispatch** (`dispatch-mgmt`) legacy screen for finalize/reserve/stock  

Supervisors and operations managers may use audit boards for investigation. Floor operators use **Golden Chain Operator** only.

---

## Pilot reference orders (training)

These orders passed full wizard UAT in Phase 24K (for supervisor demos only — do not re-run on live customer orders without approval):

- SO-2026-000136  
- SO-2026-000137  
- SO-2026-000138  

---

## Quick checklist (per order)

- [ ] Correct SO selected  
- [ ] One next action clicked  
- [ ] Success toast seen  
- [ ] Stage strip moved forward  
- [ ] Escalated if blocked more than 5 minutes  

---

*Version: Phase 24L — 2026-06-01. Questions: operations supervisor.*
