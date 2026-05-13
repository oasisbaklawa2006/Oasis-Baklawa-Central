-- 1. Strip phone from any duplicate auth users that aren't the master admin
UPDATE auth.users
SET phone = NULL
WHERE phone LIKE '%9891162212%'
  AND email <> 'admin@oasisbaklawa.com';

-- 2. Weld the phone to the master admin auth user
UPDATE auth.users
SET phone = '+919891162212',
    phone_confirmed_at = now()
WHERE email = 'admin@oasisbaklawa.com';

-- 3. Mirror it on the public profile + ensure admin role
UPDATE public.users
SET phone = '+919891162212',
    role = 'admin'
WHERE email = 'admin@oasisbaklawa.com';