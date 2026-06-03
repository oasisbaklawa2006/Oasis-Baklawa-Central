# WhatsApp operator inbox — read-only guardrail audit (post–PR #66)

**Purpose:** Record **current** client-side **read vs write** posture for the operator inbox after PR **#66**, and set expectations for **future PRs**. **Documentation only.**

**Scope:** `src/components/WhatsAppInbox.tsx`, `src/components/whatsapp/*` (grep + file inspection on `main` after merge).

---

## 1. Existing `functions.invoke` calls (unchanged contract)

All invocations live in **`WhatsAppInbox.tsx`** only:

| Slug | Purpose | Notes |
|------|---------|--------|
| **`whatsapp-identify-sender`** | TOOL 2 sender identity (read-only) | WA-03A: display only; Edge SELECT on `users` / `whatsapp_contacts`; no writes. |
| **`fetchClientResolution` (client lib)** | WA-04A client resolution (read-only) | PostgREST SELECT only on `companies`, `users`, `orders`, `b2b_applications`, `shadow_clients`, `delivery_addresses`; no writes. |
| **`fetchProductResolution` (client lib)** | WA-05A product resolution (read-only) | PostgREST SELECT only on `products`, `product_aliases`; no writes. |
| **`whatsapp-operator-reply`** | Operator outbound reply | Pre–#66 TOOL 1 path; **not** read-only (Edge + DB writes). |
| **`whatsapp-classify-intent`** | TOOL 3 suggestion | Return-only Edge path per governance; **no new invoke added in #66**. |
| **`whatsapp-route-packet`** | TOOL 4 suggestion | Same as above. |

**`src/components/whatsapp/`** — **no** `supabase.functions.invoke` matches in grep (helpers are read-only or pure UI).

---

## 2. New write paths from #65 / #66

**Expected:** **none** in `src/components/whatsapp/*`.

**Postgres client usage in #66:** **`select`** / **`head: true` counts** only:

- `WhatsAppInbox.tsx` — `from("whatsapp_message_packets").select(...)` + batched `whatsapp_messages` via `fetchMessagesForPacketIdsBatch`.
- `operatorInboxMessagesBatch.ts` — paginated `.select` on `whatsapp_messages`.
- `useOperatorInboxObservability.ts` — counts and capped samples on `whatsapp_messages` / `whatsapp_message_packets`.

**No** `.insert`, `.update`, `.delete`, or `rpc(` in the grepped inbox + `whatsapp` tree.

---

## 3. New migrations / config / Edge functions

**Expected:** **none** in PR #66 for this surface — inbox work is **app** + **docs** only. (Governance docs landed with related merges; no `supabase/migrations` or `supabase/functions` edits for the inbox feature itself.)

---

## 4. Read-only analytics sources

| Source | Mechanism |
|--------|-----------|
| **Observability strip** | `useOperatorInboxObservability` — `count` head requests, capped `select` samples (`stitched_content`, `provider`), `partialErrors` aggregation. |
| **Packet list meta** | `inferPacketHealth`, `packetAgeBucket`, `inferLocalIntentFromText`, bulk filters — **pure** functions over loaded rows (`operatorInboxUtils`, `operatorInboxBulkFilter`). |
| **Thread UI** | `groupMessagesByDayWithGapMarkers`, customer activity / explanation / draft / AI panels — **in-memory** only. |
| **Persistence** | `operatorInboxUiPersistence.ts` — **localStorage** for filter/pin/bulk UI state only (no server writes). |

---

## 5. Guardrail rule for future PRs

1. **Any new `supabase.functions.invoke`** or **new PostgREST write** (`insert` / `update` / `delete` / privileged `rpc`) in the operator inbox area requires a **separate authority / security review** (JWT posture, `verify_jwt`, audit, TOOL 5 freeze — see `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` and reconciliation pack).
2. **Read-only UX** may add: keyboard shortcuts, empty states, local storage keys, derived metrics, and docs — **without** new Edge slugs or DDL.
3. **Bugfixes** that only trim `select` columns or adjust client-side sorting remain **read-only** if they do not add writes or invokes.

---

*End of guardrail audit.*
