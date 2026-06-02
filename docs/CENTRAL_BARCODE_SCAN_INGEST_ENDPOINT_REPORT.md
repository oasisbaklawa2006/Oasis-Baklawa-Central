# Central Barcode Scan Ingest Endpoint Report

**Status:** Implemented (Central repo) — HMAC-protected edge function for Barcode App verified scans.  
**Date:** 2026-06-02  
**Scope:** `barcode-scan-ingest` edge function, shared ingest logic, unit tests, config only. No migrations, no Golden Chain / WhatsApp / invoice changes.

---

## Endpoint

| Field | Value |
|-------|--------|
| **Function name** | `barcode-scan-ingest` |
| **Path** | `{SUPABASE_URL}/functions/v1/barcode-scan-ingest` |
| **Method** | `POST` |
| **Auth** | HMAC only (`verify_jwt = false`) |

### Required headers

| Header | Value |
|--------|--------|
| `X-Source-App` | `barcode_app` |
| `X-Idempotency-Key` | Unique key per scan submission |
| `X-Oasis-Signature` | HMAC-SHA256 hex of raw request body (optional `sha256=` prefix) |

---

## Secrets / environment variables

Set on the **Central Supabase project** (edge function secrets):

| Variable | Purpose |
|----------|---------|
| `BARCODE_APP_SCAN_SIGNING_SECRET` | Primary shared HMAC secret (must match Barcode App / oasis-trace `submit-central-scan`) |
| `CENTRAL_SCAN_SIGNING_SECRET` | Accepted alias for the same secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected by Supabase — used server-side only inside the edge function for DB insert |
| `SUPABASE_URL` | Injected by Supabase |

**Security notes**

- No frontend or Barcode App client receives the service role key.
- JWT verification is disabled; only HMAC + payload validation gate writes.
- Inserts target existing append-only table `operational_scan_records` (no schema migration).

---

## Payload contract

Both accepted scan shapes require `verification_status: "verified"` and matching CTN-SO barcodes.

### Dispatch gate

```json
{
  "source_app": "barcode_app",
  "order_id": "uuid",
  "order_number": "SO-2026-000136",
  "scan_type": "dispatch_gate",
  "verification_type": "gate_check",
  "entity_type": "order",
  "barcode_value": "CTN-SO-2026-000136",
  "expected_barcode": "CTN-SO-2026-000136",
  "verification_status": "verified",
  "scan_source": "barcode_app_gate_scan"
}
```

### Carton identity

```json
{
  "source_app": "barcode_app",
  "order_id": "uuid",
  "order_number": "SO-2026-000136",
  "scan_type": "carton",
  "verification_type": "identity_match",
  "entity_type": "order",
  "barcode_value": "CTN-SO-2026-000136",
  "expected_barcode": "CTN-SO-2026-000136",
  "verification_status": "verified",
  "scan_source": "barcode_app_carton_scan"
}
```

Optional: `barcode_app_reference`, `submitted_at`.

### Validation (reject before insert)

- HMAC signature invalid or missing
- `X-Source-App` ≠ `barcode_app`
- Missing `X-Idempotency-Key`
- `verification_status` ≠ `verified`
- `barcode_value` ≠ `expected_barcode`
- Invalid CTN-SO / SO number pattern
- Invalid `scan_type` / `verification_type` pairing
- `order_id` missing or not found in `orders`
- `order_number` does not match persisted order
- Duplicate idempotency key (see below)

---

## Idempotency

- Header `X-Idempotency-Key` is stored on `operational_scan_records.idempotency_key` (unique partial index).
- If the key already exists: **no second row**; response:

```json
{
  "ok": true,
  "duplicate": true,
  "message": "Scan already recorded"
}
```

### Success

```json
{
  "ok": true,
  "scan_id": "<uuid>",
  "reference": "<barcode_app_reference or scan_id>",
  "message": "Scan recorded"
}
```

### Failure

```json
{
  "ok": false,
  "reason": "<machine_code>",
  "message": "<human readable>"
}
```

HTTP status: `401` (HMAC), `400` (validation), `404` (order not found), `500` (unexpected).

---

## Files added

| Path | Role |
|------|------|
| `supabase/functions/barcode-scan-ingest/index.ts` | Edge HTTP handler |
| `supabase/functions/_shared/barcode-scan-ingest/types.ts` | Payload/response types |
| `supabase/functions/_shared/barcode-scan-ingest/ctnSo.ts` | CTN-SO / SO validation |
| `supabase/functions/_shared/barcode-scan-ingest/hmac.ts` | HMAC verify |
| `supabase/functions/_shared/barcode-scan-ingest/ingest.ts` | Business rules + DB insert |
| `supabase/config.toml` | `[functions.barcode-scan-ingest] verify_jwt = false` |
| `src/lib/barcode-ingest/index.ts` | Re-exports for Vitest |
| `src/lib/barcode-ingest/__tests__/barcodeScanIngest.test.ts` | Ingest unit tests |
| `src/lib/barcode-ingest/__tests__/hmac.test.ts` | HMAC unit tests |

**Migration:** None (uses existing `operational_scan_records`).

---

## Tests run

```bash
npm run typecheck
npm run build
npm test -- --run barcodeScanIngest
npm test -- --run hmac
npm test -- --run barcode
npm test -- --run scan
npm test -- --run operational
```

Coverage highlights:

- Valid `dispatch_gate` and `carton` scans
- HMAC success / bad signature / missing secret / missing signature
- Missing idempotency key
- Duplicate idempotency (no second insert)
- Barcode mismatch, order number mismatch, invalid scan type, unverified payload, missing order

---

## Staging deployment steps

1. Merge PR to `main`.
2. Set secrets on Central staging Supabase project:
   - `BARCODE_APP_SCAN_SIGNING_SECRET` (same value as Barcode App staging)
3. Deploy edge function:
   ```bash
   supabase functions deploy barcode-scan-ingest --project-ref <staging-ref>
   ```
4. Confirm `supabase/config.toml` has `verify_jwt = false` for `barcode-scan-ingest`.
5. Smoke test from Barcode App staging `submit-central-scan` (or curl with signed body):
   - Valid gate scan → `200`, row in `operational_scan_records`
   - Repeat same idempotency key → `200`, `duplicate: true`, row count unchanged
   - Wrong signature → `401`
6. Verify Central admin UI (e.g. dispatch readiness / reservation board) shows new scan hints for test order.

---

## Production go-live blockers

| Blocker | Owner |
|---------|--------|
| Production HMAC secret rotated and synced with Barcode App production | Platform / ops |
| Edge function deployed to production Central Supabase | Platform |
| End-to-end signed POST from Barcode App production `submit-central-scan` | Barcode App |
| Staging pilot: at least one real order with gate + carton scans visible in Central | Operations |
| Confirm no service role key in any client bundle | Security review |
| Production deploy window + rollback plan documented | Platform |

**Production readiness verdict:** **Not ready for production** until staging E2E with Barcode App is green and production secrets are provisioned. Code and unit tests are complete in Central; deployment and cross-app secret alignment remain.

---

## Integration boundary

```
Barcode App (oasis-trace)
  submit-central-scan edge function
    → POST {SUPABASE_URL}/functions/v1/barcode-scan-ingest
      → Central operational_scan_records (append-only)
```

Golden Chain, WhatsApp, invoices, and customer notifications are **out of scope** for this endpoint.
