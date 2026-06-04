# WA Stage-1 RLS — Post-Apply Verification (Staging)

**Applied:** 2026-06-04 (Phase 6)  
**Re-verified:** 2026-06-04 (Phase 6 repeat — migration already on staging; apply skipped idempotently)  
**Project:** `tcxvcatsqqertcnycuop` (staging only)  
**Migration name (remote):** `wa_stage1_inbox_reader_rls`  
**Remote version:** `20260604034227`  
**Repo migration file:** `supabase/migrations/20260604120000_wa_stage1_inbox_reader_rls.sql`  
**Option:** A (`SUPER_ADMIN`, `ADMIN`, `SUPPORT_EXECUTIVE`)  
**Production:** NOT touched

---

## Preflight (re-run before apply)

| Check | Result | Expected | Pass |
|-------|--------|----------|------|
| open_packets | 15 | >= 1 | ✅ |
| legacy_role_keys | 0 | 0 | ✅ |
| inbox_policies_present (pre) | 0 | 0 | ✅ |
| inbox_fn_present (pre) | false | false | ✅ |
| legacy_packet_view_policy | 1 | 1 | ✅ |
| admin@ would_be_reader | true | true | ✅ |
| finance@ would_be_reader | false | false | ✅ |
| dispatch@ would_be_reader | false | false | ✅ |

**Verdict:** Preflight matched — apply authorized.

---

## V1 — Objects created

| Object | Result |
|--------|--------|
| `is_whatsapp_inbox_reader(_user_id uuid)` | ✅ present |
| `whatsapp_packets_inbox_reader_select` | ✅ SELECT on `whatsapp_message_packets` |
| `whatsapp_contacts_inbox_reader_select` | ✅ SELECT on `whatsapp_contacts` |
| `whatsapp_messages_inbox_thread_select` | ✅ SELECT on `whatsapp_messages` |

---

## V2 — Role gate (post-apply)

| email | resolved_role | is_inbox_reader |
|-------|---------------|-----------------|
| admin@oasisbaklawa.com | SUPER_ADMIN | **true** |
| finance@oasisbaklawa.com | FINANCE_HEAD | **false** |
| dispatch@oasisbaklawa.com | DISPATCH_MANAGER | **false** |

---

## V3 — Policy-level packet visibility (SQL)

Simulated via `is_whatsapp_inbox_reader(user_id)` on open packets:

| User | visible_open_packets |
|------|----------------------|
| admin@ (`d505bbcf-…`) | **15** |
| finance@ (`2500b6da-…`) | **0** |
| dispatch@ (`fcb7e045-…`) | **0** |

---

## V4 — Embed path (admin reader)

Sample rows (packet + contact join):

| id | status | phone_number | customer_name |
|----|--------|--------------|---------------|
| 089b36d8-… | open | 919976543210 | Test Customer |
| 5d5faba4-… | open | 919891162212 | null |
| 0c2e1840-… | open | 919891162212 | null |

Contact embed path unblocked for inbox readers.

---

## V5 — Legacy policy retained

| Check | Result |
|-------|--------|
| `whatsapp_packets_view` present | **1** |

---

## V6 — No inbox write policies

Inbox-reader INSERT/UPDATE/DELETE policies: **0 rows**

---

## Browser verification

| Account | UI open packets | Expected | Pass | Artifact |
|---------|-----------------|----------|------|----------|
| dispatch@ | **0** | 0 | ✅ | `rls-post-apply-dispatch-inbox.png` |
| finance@ | **0** | 0 | ✅ | `rls-post-apply-finance-inbox.png` |
| admin@ | **blocked** (login failed) | 15 | ⚠️ | `rls-post-apply-admin-inbox-BLOCKED.txt` |

**Admin browser blocker:** Password not documented in repo; multiple attempts failed (400 from Supabase Auth). SQL verification confirms admin@ would see **15** open packets under Option A.

---

## Overall verdict

**Staging apply: SUCCESS**

- Migration applied to staging only.
- Option A RLS behavior confirmed for finance@ and dispatch@ in browser.
- admin@ packet visibility confirmed via SQL policy simulation (15 open).
- Production not authorized and not modified.
