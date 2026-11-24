# WA-100 Central — Authenticated Preview Acceptance Runbook (no-send)

Status: **PREPARED, NOT EXECUTED.** Nothing here is evidence that UAT passed.
Covers Central #673 (Shadow Client / Operator handoff) and #676 (dispatch safeguards).
Backend authority: Core #556 (queue RPC), #550 (notification command, no-send).

## 0. Preconditions (all mandatory — stop if any fails)
1. Preview is bound to an **owner-approved isolated Core project** with no real customer data
   (e.g. the `oasis-wa100-uat` branch). On 17 Nov the Central Preview was proven to target LIVE Core;
   re-verify by reading the compiled public JS of the exact Preview deployment and confirming the
   Supabase origin is the isolated project. **If it is the production origin, do not run any step.**
2. Isolated project has Core #556 migrations `20261118082500` and `20261118083000` applied
   (forward-only; do not replay #550's `20261118110900` verbatim on the UAT project — its
   manually-applied IDs are out of canonical order).
3. Fixtures: one ADMIN test identity, one non-admin (denied-role) identity, one shadow-client
   WhatsApp packet with a dummy number. Dummy data only; provider transport disabled.
4. Record: Preview deployment URL, exact head SHA, tester, UTC time. The recorded head must contain **both**
   #673 (Shadow Client / Operator handoff) and #676 (dispatch safeguards, merged as `6178c9e4`). Prove both with
   `git merge-base --is-ancestor <#673 head> <Preview head>` and `git merge-base --is-ancestor 6178c9e41a8af3d1f5c58d5d1763efc1aeebd8c7 <Preview head>`,
   and record both results. A head that contains only one of them tests a different implementation: do not run any row.

## 1. Shadow Client queue (#673 + Core #556)
Exact wording below is taken from `ShadowClientSection.tsx` at the #673 head (`0b505d78` when this was written).
It is **not** present on Central `main` until #673 merges, and it is a different surface from the War Room order card
(`WarRoomOrderCard.tsx` shows `Client queued for governance approval. Complete activation in Client Governance.`).
Run these rows only on a Preview built from a head that contains both #673 and #676 (precondition 4), and record that head SHA.
| # | Action (ADMIN) | Expected | Evidence |
|---|---|---|---|
| 1.1 | Open the unrecognised-contact packet in War Room → Shadow Client | Packet shows originating queue and contact | screenshot |
| 1.2 | Choose create client | Success toast `Client queued for approval in Client Governance.` followed by info toast `No sales-order draft was created. No WhatsApp message was sent.` No draft order, no WhatsApp message | screenshot of both toasts + `whatsapp_messages` unchanged |
| 1.3 | Repeat 1.2 (retry) | Returns the same application; exactly **one** application for the company | DB count = 1 |
| 1.4 | Edit governance notes in Client Governance, retry 1.2 | Still one application (retry identity must not depend on `admin_notes`) | DB count = 1 |
| 1.5 | Force an RPC error (e.g. non-admin) | Error toast `Operation failed: <message>`, **no** success toast | screenshot |
| 1.6 | Non-admin identity attempts 1.2 | Denied | screenshot |
| 1.7 | Approve in Client Governance | Contact stays an **unverified candidate**; no outbound message is created | DB: no outbox/command row |

## 2. Operator handoff / Suggested Orders (#673)
| # | Action | Expected | Evidence |
|---|---|---|---|
| 2.1 | Send a clarification with provider transport **disabled** (precondition 3) | Failure toast `WhatsApp send failed: <error>` (send-whatsapp returns its provider status when 400 or above, otherwise 502). No "accepted" and no "delivered" wording anywhere, and the suggestion is not marked sent | screenshot of the failure toast + provider timeline showing **zero** outbound sends |
| 2.1a | Provider-**accepted** path (`Provider accepted the clarification; suggestion updated. Delivery is not yet confirmed.`) | Cannot occur with transport disabled. Verify only in a separately owner-approved provider sandbox; never delivery wording | record `NOT RUN - requires approved sandbox` (reference the approval if run). It never counts as passed in this no-send runbook |
| 2.2 | Re-click send in same session | Blocked (volatile UI guard only — cross-session safety is NOT certified; needs Core durable event identity) | screenshot of the blocked state |
| 2.3 | Simulate invocation/network error | Warning toast `WhatsApp acceptance is unconfirmed. Do not resend until the provider timeline is reconciled.`; treated as ambiguous and non-retryable; no resend | screenshot of the error state + provider timeline showing no second send |

## 3. Dispatch (#676)
The customer-communication button is disabled while `DISPATCH_WHATSAPP_COMMISSIONED` is `false`, so rows 3.2 and 3.3
are verified by observation and by the code path, not by clicking a live send.

| # | Action | Expected | Evidence |
|---|---|---|---|
| 3.1 | Complete gate entry/exit with dispatch proof on the Security Gate page | Gate proof succeeds independently of messaging | screenshot of `Gate-exit proof recorded` panel + proof id |
| 3.2 | After the proof is frozen, observe `macro-security-gate-customer-comm` in the "Ticket-window handoff" panel | Button is **disabled**. The amber paragraph above it reads `WhatsApp dispatch notice not sent: recipient consent, durable receipt and protected release are pending. Physical gate proof remains independently valid.` (shown only after a proof exists; before that the panel shows `Freeze final dispatch proof to load the canonical invoice-based deadline.`) | screenshot of the disabled button and paragraph |
| 3.3 | **Eligible** order only: frozen gate-exit dispatch proof, final invoice present, complaint window anchored to the final invoice date and open (prove with a read-only `finance_exit_facts` read for the fixture order). No UI path is clickable, so evidence is the exact source line plus the unit test `src/lib/order-authority/__tests__/dispatchCustomerCommunicationClient.test.ts` run at the Preview head (it asserts the `Customer WhatsApp not sent` prefix with mocked facts, not the full string) | `recordGovernedCustomerDispatchCommunication` throws `Customer WhatsApp not sent: governed recipient and durable dispatch receipt are pending` (`DispatchCustomerCommunicationError`) from `src/lib/order-authority/dispatchCustomerCommunicationClient.ts`. No `client_interactions` row used as dedupe; no provider call | the read-only eligibility facts + unit test output at the recorded head + provider timeline showing zero calls. An eligibility error is **not** evidence for this row |
| 3.3a | **Ineligible** orders, one per reason (separate from 3.3) | The call throws that reason instead: `Finance exit facts are not loaded`, `Immutable gate-exit dispatch proof must be frozen first`, `Final invoice must exist before customer dispatch communication`, `Complaint window must be anchored to final invoice date`, or `Complaint window is not open — cannot complete governed dispatch communication`. No provider call | one captured error per reason + provider timeline showing zero calls |
| 3.4 | Non-permitted role at the gate | Denied; audit trail retained | screenshot + audit row reference |

## 4. Always
- Inspect provider timeline: **zero** outbound sends.
- Every row in sections 1, 2 and 3 has an evidence column. UAT may be claimed as passed only when **every** row of
  **every** section has its evidence recorded by a named tester, with the Preview URL, head SHA and UTC time from section 0.
  A section with any empty evidence cell is not passed; do not report partial sections as passed.
- Rows that need a separately approved environment (2.1a) are reported as `NOT RUN`, never as passed, and do not
  count toward the no-send pass.

Open decision (not resolved here): the ASM work-item ID for WA-100 and Mission Control reassignment of Core lanes.
