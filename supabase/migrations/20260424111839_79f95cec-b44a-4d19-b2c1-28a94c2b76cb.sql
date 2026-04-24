-- Link admin phone to auth user and sync profile
UPDATE auth.users
SET phone = '+919891162212',
    phone_confirmed_at = COALESCE(phone_confirmed_at, now()),
    updated_at = now()
WHERE id = 'd505bbcf-577a-4f8d-8816-2ec080b2be15';

UPDATE public.users
SET phone = '+919891162212',
    role = 'SUPER_ADMIN'
WHERE id = 'd505bbcf-577a-4f8d-8816-2ec080b2be15';