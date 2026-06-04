# Stage-1 temporary evidence account (STAGING ONLY)

**Project:** `tcxvcatsqqertcnycuop`  
**Purpose:** Complete WhatsApp Stage-1 inbox evidence (E4, E5, packet visibility) under Option A RLS  
**Production:** NOT created — staging only

**Credential storage:** Password is [REDACTED] in git. Active staging credential is held outside the repository (agent artifacts vault only), rotated after accidental doc commit.

---

## Account

| Field | Value |
|-------|--------|
| Email | `support.stage1@oasisbaklawa.com` |
| Password | [REDACTED] *(rotated; stored outside git — staging secrets vault only)* |
| User ID | `6a8c0e1f-3289-44c7-bf67-2a52820dc297` |
| Role | `SUPPORT_EXECUTIVE` |

---

## Mappings (verified 2026-06-04)

| Layer | Value |
|-------|--------|
| `public.users.role` | `SUPPORT_EXECUTIVE` |
| `public.profiles.role` | `SUPPORT_EXECUTIVE` |
| `public.profiles.is_approved` | `true` |
| `public.profiles.status` | `approved` |
| `public.user_role_map` | `support_executive` → role id `affb208f-d49f-407f-a9d9-cf9821d1af6c` |
| `get_user_role()` | `SUPPORT_EXECUTIVE` |
| `is_whatsapp_inbox_reader()` | **true** |

---

## Visibility (post Option A RLS)

| Check | Result |
|-------|--------|
| SQL policy-visible open packets | **15** |
| PostgREST JWT (`whatsapp_message_packets?status=eq.open`) | **15** |
| Browser `/admin/operator-inbox` | **15 shown · 15 loaded (open)** |

---

## Auth notes

Initial SQL insert required empty-string auth token fields (`confirmation_token`, `recovery_token`, `email_change`) — NULL values caused GoTrue login error.

---

## Disable recommendation

**Yes — disable after Stage-1 evidence sign-off.**

Suggested staging cleanup (human/DBA):

```sql
-- Staging only — run after evidence complete
UPDATE auth.users
SET banned_until = '2099-01-01'::timestamptz
WHERE email = 'support.stage1@oasisbaklawa.com';

-- Or delete account + mappings if full removal preferred
```

Do **not** replicate this account on production.

---

## Evidence captured with this account

| Artifact | Item |
|----------|------|
| `visibility-full-inbox-with-packets.png` | Full inbox with 15 packets |
| `queue-disabled-governance-bar.png` | E4 |
| `audit-readonly-label.png` | E5 |
