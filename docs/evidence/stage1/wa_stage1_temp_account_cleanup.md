# Stage-1 temp account cleanup (staging only)

**When:** After Stage-1 evidence sign-off is complete  
**Project:** `tcxvcatsqqertcnycuop` (staging only)  
**Account:** `support.stage1@oasisbaklawa.com`

---

## Recommended action — disable login

Run in Supabase SQL Editor on **staging only**:

```sql
UPDATE auth.users
SET banned_until = '2099-01-01'::timestamptz
WHERE email = 'support.stage1@oasisbaklawa.com';
```

This preserves audit history while blocking further sign-in.

---

## Optional — full removal (staging only)

If complete deletion is preferred after artifacts are archived:

1. Delete `public.user_role_map` rows for user id `6a8c0e1f-3289-44c7-bf67-2a52820dc297`
2. Delete `public.profiles` / `public.users` rows
3. Delete `auth.identities` and `auth.users` rows

**Do not run on production.**
