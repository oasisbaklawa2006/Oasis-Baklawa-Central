# C2C — Edge contract reconciliation

**Purpose:** Map **current** `invoke` contracts as implemented in repo sources vs what the UI assumes. **No Edge edits** in this sprint.

**Sources:** `src/components/WhatsAppInbox.tsx`, `supabase/functions/whatsapp-operator-reply/index.ts`, `whatsapp-classify-intent/index.ts`, `whatsapp-route-packet/index.ts`, `supabase/config.toml`.

---

## 1. Current invoke → response contract map

### `whatsapp-operator-reply`

| Aspect | Contract |
|--------|----------|
| **Method** | POST JSON |
| **Success HTTP** | `200` with body `{ success: true, message_id?: string }` (from `sendOperatorReply` return) |
| **Failure HTTP** | `400` when `success: false`; `500` on thrown handler error |
| **Success body** | JSON `result` object; UI checks `result?.success` |
| **Failure body** | `{ success: false, error: string }` |
| **Side effects** | Inserts outbound `whatsapp_messages` row; calls `send-whatsapp`; updates same row status |

### `whatsapp-classify-intent`

| Aspect | Contract |
|--------|----------|
| **Success** | `200` `{ success: true, intent: IntentResult }` or `success: true` with synthetic intent when no rows / empty content |
| **Client errors** | `400` if `packet_id` missing |
| **Server errors** | `500` `{ success: false, error: string }` |
| **UI parsing** | Expects `body.success` and `body.intent` |

### `whatsapp-route-packet`

| Aspect | Contract |
|--------|----------|
| **Success** | `200` `{ success: true, decision: RoutingDecision }` |
| **Client errors** | `400` if `packet_id` missing |
| **Server errors** | `500` `{ success: false, error: string }` |
| **UI parsing** | Expects `body.success` and `body.decision` |
| **Intent input** | Optional `body.intent` — normalized to enum set in Edge |

---

## 2. UI assumptions currently relied upon

| Assumption | Location |
|------------|----------|
| `invokeError` message is user-displayable | `alert` / `setSuggestionsError` |
| `data` JSON matches hand-written TypeScript casts | `IntentSuggestion`, `RouteSuggestion` interfaces in `WhatsAppInbox.tsx` |
| **Reply:** `success` boolean means customer message reached provider | Does not verify provider-level idempotency |
| **Classify/route:** Stale packet guarded only by **client** `selectedPacketIdRef` | Not a server contract |
| **Route:** Prior `intentResult` object is safe to pass back | Edge normalizes `intent_type` but trusts structure for keywords/metadata |

---

## 3. Non-versioned contract risks

- **No API version field** in URL or body (`v1`, etc.).  
- **Implicit schema** for `intent` / `decision` / `metadata` — UI `JSON.stringify` display may drift from Edge additions.  
- **`verify_jwt=false`** in `config.toml` — contract is effectively “anyone who can call the function” unless external controls exist.

---

## 4. Missing typed guarantees

- No shared **OpenAPI / Zod** package between Edge and client in repo (client uses local TS types only).  
- No **runtime validation** of success payload on client beyond truthy checks.  
- No **error code enum** — strings only.

---

## 5. Retry ambiguity

- **Client:** User double-clicks send — no debounce on button beyond `replySending` state (good) but **no idempotency key** if user opens two tabs.  
- **Edge `send-whatsapp`:** Internal provider retry — ambiguous whether a **timeout** after provider accepted message could cause duplicate send on a future retry path.

---

## 6. Duplicate-send ambiguity

- **Operator path:** Two successful invocations = two DB inserts = two provider sends unless deduped externally.  
- **Automation path:** `send-whatsapp-automation` + `send-whatsapp` — separate dedupe story per `orderId` + `triggerType` (not audited in depth here).

---

## 7. Correlation-ID absence / presence

- **Not present** in inbox `invoke` bodies for the three functions.  
- **Operator-reply** logs `operator_id` to console only — no correlation id returned to client in JSON.  
- **Webhook → stitcher** uses ad-hoc `fetch` — correlation story fragmented (see live audit).

---

## 8. Recommended future contract rules (staging+)

1. **Versioned path** or `api_version` body field.  
2. **Idempotency-Key** mandatory on reply (and automation triggers).  
3. **Structured errors** `{ code, message, retryable, correlation_id }`.  
4. **JWT subject** echoed in response metadata for client reconciliation (non-sensitive).  
5. **Packet `row_version`** echoed on every mutating response.

---

## 9. Staging-only reconciliation requirements

Before changing production:

- Publish **contract table** (this doc + OpenAPI) as source of truth.  
- Add **contract tests** (staging) that validate JSON samples against schema.  
- Measure **duplicate send rate** under fault injection.  
- Align **`verify_jwt`** plan with Supabase dashboard reality (config vs deployed).

---

## 10. Explicit “NOT IMPLEMENTED YET”

- JWT enforcement at Edge gateway for operator/classify/route (config still `false`).  
- In-function JWT user extraction and RLS-scoped DB client for those handlers.  
- Idempotency store / keys.  
- Correlation id propagation.  
- OpenAPI/Zod shared package.  
- Immutable append-only audit for all attempts.  
- Versioned API surface.

This section must be cleared by **implementation PRs** explicitly approved outside the doc-only freeze.
