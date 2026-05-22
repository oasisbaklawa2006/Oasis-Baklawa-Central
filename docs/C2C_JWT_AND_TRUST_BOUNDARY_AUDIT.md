# C2C — JWT and trust boundary audit

**Scope:** Read-only review of `supabase/config.toml`, Edge handler patterns (service role vs user JWT), and representative client assumptions. No configuration or code changes in this sprint.

---

## 1. Current JWT posture by Edge function

`supabase/config.toml` explicitly sets **`verify_jwt = false`** for:

| Function | `verify_jwt` in repo config |
|----------|----------------------------|
| `notify-event` | false |
| `whatsapp-otp` | false |
| `public-order-tracking` | false |
| `whatsapp-webhook` | false |
| `whatsapp-message-stitcher` | false |
| `banyan-central-parser` | false |
| `generate-bi-monthly-ledger` | false |
| `generate-rescue-ledger` | false |
| `oasis-ai-chat` | false |
| `msg91-otp` | false |
| `msg91-webhook` | false |
| `validate-user` | false |
| `send-whatsapp` | false |
| `send-whatsapp-automation` | false |
| `whatsapp-operator-reply` | false |
| `whatsapp-identify-sender` | false |
| `whatsapp-classify-intent` | false |
| `whatsapp-route-packet` | false |

**Functions present on disk but not listed above** (e.g. `send-email`, `admin-create-draft`, `generate-product-attributes`): Supabase projects typically **default `verify_jwt` to true** when omitted — confirm in deployment dashboard / generated remote config. This doc treats them as **“verify JWT unless proven otherwise”** pending ops confirmation.

---

## 2. `verify_jwt` findings (risk framing)

- **Broad `verify_jwt = false` on WhatsApp + notify + public tracking + AI + ledger generators** means the **platform anon/service invocation surface** is larger than a JWT-first model would allow.
- Practical protection often shifts to:
  - **Shared secrets** in webhook signatures (where implemented per handler)
  - **Network allowlists** (WAF / Supabase dashboard settings — out of repo scope)
  - **Body-only trust** (dangerous for operator/commerce actions)
- **C2C operator paths** (`whatsapp-operator-reply`, classify, route, `send-whatsapp`) are all `verify_jwt = false` while the **dashboard client still sends a user session** on `invoke`. That session is **not enforced as authoritative identity** at the Edge gate when JWT verification is off; the handler must validate or the trust model is “anyone with anon key + URL can POST”.

---

## 3. Client-trust assumptions

- **`supabase.functions.invoke` from browser:** Sends the user’s JWT when Supabase client attaches the session — **but** Edge with `verify_jwt = false` may **ignore** it unless code calls `createClient` with the Authorization header and checks claims (many handlers use **service role** only).
- **PostgREST writes from `src`:** Trust **`auth.uid()` in RLS** as the real authority boundary for table mutations (correct when policies are tight).
- **localStorage:**
  - Supabase session persisted in `localStorage` (`integrations/supabase/client.ts` uses `storage: localStorage`).
  - Operator inbox persists **filters, notes, saved views** in `localStorage` (UX only — must never be treated as authority for server actions).
  - Impersonation marker `impersonated_client` — high trust UX; server must still enforce company scoping.

---

## 4. Dangerous trust patterns (observed classes)

| Pattern | Example / symptom |
|---------|-------------------|
| Service-role Edge with no JWT gate | Full DB power on every successful request |
| `operator_id` in JSON body | Spoofable if endpoint is reachable without strong auth |
| Client-driven queue processing | `processOutboxQueue` runs in browser with session — not a hardened worker identity |
| Webhook parsers | Must rely on signature verification + idempotency — needs per-file proof |
| Public tracking + OTP functions | Intended anonymous; must be strictly rate-limited and minimal in data returned |

---

## 5. Missing actor validation

- Edge functions using **only** `SUPABASE_SERVICE_ROLE_KEY` **without** binding action to `auth.getUser()` / JWT claims → **no cryptographic actor** on that hop.
- Admin pages often pass `user?.id` into inserts — **good for intent**, but **insufficient** if Edge bypasses DB RLS entirely.

---

## 6. Missing ownership validation

- Operator reply accepts `packet_id`, `contact_id`, `phone_number` from client — **must** validate that the packet is open, contact matches packet, and phone matches contact **before** send (service role can skip RLS if used incorrectly).
- Outbox rows do not carry explicit **tenant / actor** provenance in the helper reviewed — attribution gaps for forensics.

---

## 7. Missing replay protection

- No **nonce / request signature** on operator `invoke` bodies.
- No **server-side dedupe window** keyed by `(operator_id, packet_id, content_hash, minute_bucket)` for replies.
- Webhooks and cron HTTP triggers need **event-id dedupe** tables (not verified globally in this sprint).

---

## 8. Missing request signing

- No HMAC or signed payload pattern between dashboard and Edge for high-risk actions.
- Internal `fetch` from `whatsapp-operator-reply` to `send-whatsapp` uses **service role bearer** — correct for intra-project trust, but reinforces that **outer** boundary must be tight.

---

## 9. Safe read-only assumptions (today)

- **Packet list + stitched read model** in `WhatsAppInbox` driven by PostgREST `select` under user session — safe **assuming** RLS restricts operator read scope appropriately.
- **Suggestion-only** classify/route responses kept in React state without persisting routing decisions — lower blast radius than auto-write routing.

---

## 10. Unsafe write-era assumptions (if carried forward unchanged)

- “Edge URL secrecy == security”
- “Console-logged `operator_id` == audit”
- “UI disables double-submit == idempotency”
- “Service role in Edge == simpler == safe” (without compensating controls)

---

## 11. Requirements before staging writes

1. **Per-function JWT policy decision** — for each write-capable function: `verify_jwt = true` **or** non-JWT alternative with **mTLS / signed webhook / HMAC** and rate limits documented.
2. **Actor binding** — map every mutation to `actor_id` from verified JWT (or worker identity), not free-form JSON.
3. **Ownership checks** — packet/contact/phone coherence enforced server-side.
4. **Idempotency** — mandatory keys for outbound messages and finance-adjacent actions.
5. **Outbox redesign** — server-side worker with row leases; remove multi-tab duplicate send race.
6. **Correlation IDs** — end-to-end tracing from UI click → Edge → provider → DB row.

---

## 12. Requirements before production writes (C2C-hardened rollout)

All staging requirements, plus:

- **SLO-backed observability** (metrics, alerts, dead-letter queues).
- **Game-day tabletops** executed against `C2C_FAILURE_SCENARIO_TABLETOP.md` with signed sign-off.
- **Rollback drills** — feature flags / kill switches for WA send and finance mutations.
- **Policy proofs** — exported RLS tests or formal review artifacts for tables touched by new paths.
- **Pen-test / abuse case** pass for anonymous Edge surfaces still required (`public-order-tracking`, `msg91-*`, `whatsapp-webhook`).

---

## References in repo

- `supabase/config.toml` — explicit `verify_jwt` map
- `supabase/functions/whatsapp-operator-reply/index.ts` — service role + internal `send-whatsapp` fetch
- `src/integrations/supabase/client.ts` — `localStorage` session adapter
- `src/components/whatsapp/*Persistence*.ts`, `operatorInboxLocalNotes.ts` — local-only state
