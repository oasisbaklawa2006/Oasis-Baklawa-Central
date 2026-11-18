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
4. Record: Preview deployment URL, exact head SHA, tester, UTC time.

## 1. Shadow Client queue (#673 + Core #556)
| # | Action (ADMIN) | Expected | Evidence |
|---|---|---|---|
| 1.1 | Open the unrecognised-contact packet in War Room → Shadow Client | Packet shows originating queue and contact | screenshot |
| 1.2 | Choose create client | Toast "Client queued for approval in Client Governance."; no draft order, no WhatsApp message | screenshot + `whatsapp_messages` unchanged |
| 1.3 | Repeat 1.2 (retry) | Returns the same application; exactly **one** application for the company | DB count = 1 |
| 1.4 | Edit governance notes in Client Governance, retry 1.2 | Still one application (retry identity must not depend on `admin_notes`) | DB count = 1 |
| 1.5 | Force an RPC error (e.g. non-admin) | Error toast, **no** success toast | screenshot |
| 1.6 | Non-admin identity attempts 1.2 | Denied | screenshot |
| 1.7 | Approve in Client Governance | Contact stays an **unverified candidate**; no outbound message is created | DB: no outbox/command row |

## 2. Operator handoff / Suggested Orders (#673)
| # | Action | Expected |
|---|---|---|
| 2.1 | Send a clarification | UI says provider *accepted*, never "delivered"; no delivery claim |
| 2.2 | Re-click send in same session | Blocked (volatile UI guard only — cross-session safety is NOT certified; needs Core durable event identity) |
| 2.3 | Simulate invocation/network error | Treated as ambiguous, non-retryable; no resend |

## 3. Dispatch (#676)
| # | Action | Expected |
|---|---|---|
| 3.1 | Complete gate entry/exit with dispatch proof on the Security Gate page | Gate proof succeeds independently of messaging |
| 3.2 | Observe `macro-security-gate-customer-comm` | Disabled; text "WhatsApp dispatch notice not sent: recipient consent, durable receipt and protected release are pending." |
| 3.3 | Attempt the action via any path | "Customer WhatsApp not sent: governed recipient and durable dispatch receipt are pending"; no `client_interactions` row used as dedupe; no provider call |
| 3.4 | Non-permitted role at the gate | Denied; audit trail retained |

## 4. Always
- Inspect provider timeline: **zero** outbound sends.
- Do not claim authenticated UAT passed until the evidence column is filled by a named tester.

Open decision (not resolved here): the ASM work-item ID for WA-100 and Mission Control reassignment of Core lanes.
