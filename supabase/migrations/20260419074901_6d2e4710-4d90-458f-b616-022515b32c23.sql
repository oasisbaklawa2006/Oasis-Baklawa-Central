-- Force-approve all staff/admin roles so they never see the Application Under Review screen.
-- Uses the existing is_staff_role() helper for the canonical role list.

UPDATE public.profiles p
SET is_approved = true,
    status = 'approved'
WHERE public.is_staff_role(p.role)
  AND (COALESCE(p.is_approved, false) = false OR COALESCE(p.status, '') <> 'approved');

UPDATE public.users u
SET role = upper(u.role)
WHERE u.role IS NOT NULL AND u.role <> upper(u.role);

-- Defensive: ensure any future staff insert into profiles is auto-approved
-- (the enforce_profile_approval_for_staff trigger already handles this on INSERT/UPDATE,
--  this is a one-time backfill).