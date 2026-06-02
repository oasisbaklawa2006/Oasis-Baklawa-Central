# WhatsApp WA-02B Governance Hardening

**PR:** WA-02B — Freeze ownership writes + disable Pipeline C auto-order  
**Date:** 2026-06-02  
**Related:** `docs/WHATSAPP_IDENTITY_OWNERSHIP_ARCHITECTURE.md` (PR-WA-02A)

---

## Summary

Minimal governance patch applied before further WhatsApp automation. Two risky webhook behaviors are **disabled by default** via explicit environment flags.

---

## 1. Client ownership mutation frozen

**Business rule:** `companies.account_manager_id` (Client Owner) must only change through a future explicit managerial approval workflow — never from webhook, parser, or AI automation.

**Changes in `supabase/functions/whatsapp-webhook/index.ts`:**

| Location | Previous behavior | WA-02B behavior (default) |
|----------|-------------------|---------------------------|
| Staff re-wire (employee mentions client name) | Set in-memory owner to sender; `UPDATE companies.account_manager_id` if null | Read existing `account_manager_id` only; **no DB write** |
| Sales exec proxy path | Auto-assign sender as `account_manager_id` when null | **Skipped**; logs `[WA-GOV]` message |

**Flag:** `ENABLE_WA_WEBHOOK_OWNER_REASSIGNMENT`  
**Default:** `false` (unset env = disabled)  
**Enable only when:** Explicit non-production waiver with written approval — **not for production**.

---

## 2. Pipeline C auto-order gated

**Business rule:** Inbound WhatsApp must capture messages and feed intelligence paths (buffer, stitcher, Banyan) without creating or mutating governed orders automatically.

**Gated paths (when flag false):**

- `aiParseOrder` → draft / clarification order insert & update
- Held-order clarification resolve (`resolveHeldOrderConfirm`, `resolveHeldOrderHighConfParse`)
- Context stitch `orders.company_id` retarget
- Stale draft auto-cancel maintenance
- Auto PI / order-value updates tied to Pipeline C

**Preserved (unchanged):**

- `debug_webhooks` ingest + WAMID dedup
- `whatsapp_buffer` insert (Banyan path)
- `whatsapp_messages` + stitcher trigger
- `client_interactions` timeline logging
- Shadow company **creation** (intake, not order)
- Intent classification + non-order acknowledgements
- Ledger dispute keyword path (separate from Pipeline C orders)

**Flag:** `ENABLE_WA_WEBHOOK_AUTO_ORDER_WRITES`  
**Default:** `false`  
**Authoritative order promotion remains:** War Room / `admin-create-draft` / human-reviewed `suggested_orders` flow.

---

## 3. Configuration

Shared module: `supabase/functions/_shared/wa-governance/flags.ts`  
App/tests re-export: `src/config/waFlags.ts`

| Environment variable | Default | Meaning |
|---------------------|---------|---------|
| `ENABLE_WA_WEBHOOK_AUTO_ORDER_WRITES` | false | Allow Pipeline C order writes from webhook |
| `ENABLE_WA_WEBHOOK_OWNER_REASSIGNMENT` | false | Allow webhook to mutate `account_manager_id` |

Only `"true"`, `"1"`, or `"yes"` (case-insensitive) enables a flag.

---

## 4. Future ownership transfer

Ownership changes require (not implemented in WA-02B):

1. Manager-initiated request with reason  
2. Approval by sales head / admin  
3. Append-only `company_ownership_history` audit row  
4. Then update `companies.account_manager_id`

Until that workflow exists, **both flags must remain false in production**.

---

## 5. Remaining RED paths (not in scope for WA-02B)

| Path | Risk |
|------|------|
| `CentralOrderPool` direct `orders` insert | Bypasses `admin-create-draft` |
| War Room client-side `orders` / `companies` writes | Ungoverned PostgREST mutations |
| `whatsapp-operator-reply` / `send-whatsapp` | No JWT idempotency |
| All WA Edge `verify_jwt = false` | Ingress trust model |
| Ledger dispute auto-insert from webhook | Finance write without human confirm |

---

*End of WA-02B governance note.*
