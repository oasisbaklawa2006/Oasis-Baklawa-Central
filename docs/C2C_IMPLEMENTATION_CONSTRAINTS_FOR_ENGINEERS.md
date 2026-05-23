# C2C — Implementation constraints for engineers (hard charter)

**Authority:** This document binds **future** implementation work for the C2C / WhatsApp authority track. It does not change runtime today.  

**Rule:** **Any implementation violating these constraints must be rejected** in code review and, if merged accidentally, reverted under the execution freeze manifest.

---

## What future engineers MAY do

- Add **types**, **docs**, and **tests** that do not hit real providers or production databases without GO.  
- Add **mock** and **stub** modules that are **not** imported from production code paths until approved.  
- Extend **observability** types and read-only helpers that perform **no** mutations.  
- Introduce **feature flags** only as **constants defaulting to false**, wired behind explicit, reviewed call sites after thaw.

---

## What future engineers MUST NOT do

- **Migrations** or **Supabase CLI** operations outside an explicitly authorized thaw window with DBA review.  
- **Edge edits** or **new** `functions.invoke` without manifest + security review.  
- **Direct** `.insert` / `.update` / `.delete` / `.rpc` from new C2C pilot code **without** RLS proof and idempotency design.  
- **TOOL 5** implementation without a separate signed charter.  
- **Production** behavior changes under the guise of “small fixes” bundled with C2C work.

---

## Forbidden shortcuts

- “**Temporary**” `verify_jwt = false` “just for testing” on write paths.  
- **`as any`** to bypass types for security-sensitive calls.  
- **Copy-paste** service role key into client or into staging `.env` shared with prod.  
- **Feature flag default true** for anything touching sends, queues, retries, finance, or dispatch.

---

## Forbidden “temporary” bypasses

- `@ts-ignore` on auth or idempotency checks.  
- **Kill switch** commented out “until Monday.”  
- **Gating** only in UI with no server enforcement.

---

## Forbidden direct writes

- Client-side writes to **authority** tables from new pilot code without server-mediated command pattern.  
- Edge handlers that use **service role** without verified actor binding for operator-class actions.

---

## Forbidden localStorage trust

- Storing **idempotency keys**, **JWTs**, or **secrets** in `localStorage`.  
- Treating **saved views** or **notes** as authoritative for server decisions.

---

## Forbidden browser queues

- **notification_outbox**-style processing from arbitrary browser tabs for pilot-class traffic.  
- **setInterval** “worker” that mutates queue state without leases.

---

## Forbidden client retries

- Unbounded **retry loops** on `invoke` without classification and idempotency keys.  
- **Automatic** resend on any 5xx without dedupe token.

---

## Mandatory (when implementation begins)

| Requirement | Meaning |
|-------------|---------|
| **JWT validation** | Every write-adjacent ingress must verify caller identity or use an approved non-JWT control with evidence. |
| **Audit** | Append-only audit for pilot mutations; no silent delete. |
| **Idempotency** | Server-side store; client keys alone are insufficient. |
| **Replay protection** | Replayed requests cannot create duplicate logical sends. |
| **Rollback proof** | Drill log exists before widening scope. |
| **Observability proof** | Dashboards + alerts for duplicate send and auth anomalies before widening scope. |

---

## Review bar

- PRs touching C2C execution surfaces require **Security** + **Tech lead** approval minimum.  
- Any single reviewer **cannot** waive mandatory items alone (see governance approval model).

---

## Cross-links

- `C2C_EXECUTION_FREEZE_MANIFEST.md`  
- `C2C_GOVERNANCE_APPROVAL_MODEL.md`  
- `C2C_PRE_IMPLEMENTATION_EVIDENCE_REQUIREMENTS.md`  
- `src/config/c2cExecutionFlags.ts`
