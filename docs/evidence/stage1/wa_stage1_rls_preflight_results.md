# WA Stage-1 RLS Preflight Results

**Captured:** 2026-06-04T03:27:25Z (UTC)  
**Project:** tcxvcatsqqertcnycuop (staging)  
**Migration (not applied):** `supabase/migrations/20260604120000_wa_stage1_inbox_reader_rls.sql`  
**Option:** A only  
**Production:** NOT touched

---

## P0 — Environment

| Field | Value |
|-------|-------|
| db | postgres |
| db_user | postgres |
| captured_at | 2026-06-04 03:27:25.759952+00 |

---

## P1 — Data baseline

| Metric | Result | Expected | Pass |
|--------|--------|----------|------|
| open_packet_count | **15** | >= 1 (baseline 15) | ✅ |
| total_messages | **18** | ~18 | ✅ |
| packet_linked_messages | **17** | ~17 | ✅ |

---

## P2 — Legacy role_key gap

| Check | Result | Expected | Pass |
|-------|--------|----------|------|
| roles with operations/finance/director | **0 rows** | 0 | ✅ |
| users_with_legacy_packet_keys | **0** | 0 | ✅ |

---

## P3 — Existing policies (before apply)

| tablename | policyname | cmd |
|-----------|------------|-----|
| whatsapp_message_packets | whatsapp_packets_insert | INSERT |
| whatsapp_message_packets | whatsapp_packets_no_delete | DELETE |
| whatsapp_message_packets | whatsapp_packets_update | UPDATE |
| whatsapp_message_packets | whatsapp_packets_view | SELECT |
| whatsapp_messages | whatsapp_messages_finance_ops | SELECT |

**Note:** No policies on `whatsapp_contacts` (RLS on, 0 SELECT for inbox embed — confirms secondary blocker).

**Inbox reader policies present:** 0 (expected)

---

## P4 — Test account role resolution (Option A simulation)

| email | resolved_role | would_be_inbox_reader_option_a |
|-------|---------------|--------------------------------|
| admin@oasisbaklawa.com | SUPER_ADMIN | **true** |
| dispatch@oasisbaklawa.com | DISPATCH_MANAGER | **false** |
| finance@oasisbaklawa.com | FINANCE_HEAD | **false** |

All match Option A expectations.

---

## P6 — Idempotency / drift guard

| Check | Result | Expected | Pass |
|-------|--------|----------|------|
| is_whatsapp_inbox_reader exists | **false** | false | ✅ |
| inbox_policies_already_present | **0** | 0 | ✅ |
| legacy whatsapp_packets_view | **1** (via P7) | 1 | ✅ |

---

## Preflight verdict

**PASS — ready for staging apply pending human GO.**

- Data present (15 open packets).
- Root cause preconditions confirmed (legacy keys absent, 0 users).
- Migration objects not yet deployed (clean apply).
- admin@ would become inbox reader under Option A; finance@ and dispatch@ would remain at 0 visible packets.

**Not executed:** P5 JWT simulation (requires SQL Editor "Run as user").

**Not executed:** Migration DDL (awaiting GO).
