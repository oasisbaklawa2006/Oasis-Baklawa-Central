# Oasis Central — UX failure state library (MOVE 5)

**Purpose:** Define **expected**, **dangerous**, and **safest interaction** patterns for operational edge states. Pair with screenshots in `audit-artifacts/screenshots/` when reproducing.

---

## Finance

### Missing receipt

| Field | Detail |
|-------|--------|
| **Expected UX** | Inline “awaiting receipt” with upload CTA; order stays in finance-readable lane |
| **Dangerous UX** | Silent empty cell; same color as “verified” |
| **Operational consequence** | Premature release or duplicate chase |
| **Safest pattern** | Amber status chip + single primary “Upload receipt” + audit trail link |

### Failed verification

| Field | Detail |
|-------|--------|
| **Expected UX** | Reason capture; reversible state; buyer-visible message template |
| **Dangerous UX** | Toast-only error; no persisted reason |
| **Operational consequence** | Disputes; rework loops |
| **Safest pattern** | Modal with required reason + preview of buyer copy |

### Stale invoice

| Field | Detail |
|-------|--------|
| **Expected UX** | “Stale — refresh” banner; diff since load |
| **Dangerous UX** | Optimistic UI with no version guard |
| **Operational consequence** | Double payment / wrong SO state |
| **Safest pattern** | Read-only until refresh; merge conflict modal |

### Pending payment

| Field | Detail |
|-------|--------|
| **Expected UX** | Clear “on credit / pending” semantics; next action for finance vs buyer |
| **Dangerous UX** | Ambiguous “processing” spinner forever |
| **Operational consequence** | Wrong dispatch trigger |
| **Safest pattern** | Dual labels (internal vs customer) + SLA chip |

---

## Dispatch

### Partial dispatch

| Field | Detail |
|-------|--------|
| **Expected UX** | Line-level partial with remaining qty surfaced |
| **Dangerous UX** | Whole-order success toast when partial |
| **Operational consequence** | Inventory drift |
| **Safest pattern** | Summary modal listing lines before confirm |

### Missing barcode

| Field | Detail |
|-------|--------|
| **Expected UX** | Scan retry + manual override behind role gate |
| **Dangerous UX** | Infinite spinner on scanner |
| **Operational consequence** | Line stoppage |
| **Safest pattern** | Offline-friendly retry + escalate button |

### Missing DPL

| Field | Detail |
|-------|--------|
| **Expected UX** | Block dispatch with explicit missing-field list |
| **Dangerous UX** | Allow pack with hidden missing field |
| **Operational consequence** | Carrier rejects; customer delay |
| **Safest pattern** | Checklist drawer; cannot primary-submit until complete |

### Packing mismatch

| Field | Detail |
|-------|--------|
| **Expected UX** | Diff view (ordered vs scanned) |
| **Dangerous UX** | Overwrite without diff |
| **Operational consequence** | Wrong SKU shipped |
| **Safest pattern** | Two-column diff + photo capture optional |

---

## WhatsApp

### Failed classify

| Field | Detail |
|-------|--------|
| **Expected UX** | “Unclassified” bucket + quick tags |
| **Dangerous UX** | Auto-route to wrong queue silently |
| **Operational consequence** | Lost SLA |
| **Safest pattern** | Human confirm for low-confidence |

### Routing unavailable

| Field | Detail |
|-------|--------|
| **Expected UX** | Degraded read-only + banner |
| **Dangerous UX** | Empty inbox with no explanation |
| **Operational consequence** | Operators assume “no messages” |
| **Safest pattern** | Banner + retry + support link |

### Disconnected inbox

| Field | Detail |
|-------|--------|
| **Expected UX** | Offline queue indicator; unsent drafts saved |
| **Dangerous UX** | Send appears succeeded when queued failed |
| **Operational consequence** | Customer never answered |
| **Safest pattern** | Explicit send states + resend |

### Stale packet

| Field | Detail |
|-------|--------|
| **Expected UX** | Timestamp + refresh; merge on conflict |
| **Dangerous UX** | Stale thread head after background sync |
| **Operational consequence** | Wrong reply context |
| **Safest pattern** | Pull-to-refresh + “new messages” bar |

---

## Orders

### Empty cart

| Field | Detail |
|-------|--------|
| **Expected UX** | Friendly empty + CTA to catalogue |
| **Dangerous UX** | Blank white screen |
| **Operational consequence** | Drop-off |
| **Safest pattern** | Illustration + “Browse catalogue” |

### MOQ violation

| Field | Detail |
|-------|--------|
| **Expected UX** | Inline line error + how much to add |
| **Dangerous UX** | Submit blocked with generic error |
| **Operational consequence** | Support tickets |
| **Safest pattern** | Per-line MOQ math + quick add qty |

### Unavailable stock

| Field | Detail |
|-------|--------|
| **Expected UX** | Substitute suggestions or remove line CTA |
| **Dangerous UX** | Checkout succeeds then post-submit failure |
| **Operational consequence** | Ops firefight |
| **Safest pattern** | Pre-submit inventory guard |

### Expired session

| Field | Detail |
|-------|--------|
| **Expected UX** | Preserve cart draft post re-login |
| **Dangerous UX** | Hard redirect losing cart |
| **Operational consequence** | Revenue loss |
| **Safest pattern** | Re-auth modal + restore draft |

---

## Cross-links

- Triage: `docs/UX_TRIAGE_MASTER_BOARD.md`  
- Operational review: `docs/UX_OPERATIONAL_WORKFLOW_REVIEW.md`
