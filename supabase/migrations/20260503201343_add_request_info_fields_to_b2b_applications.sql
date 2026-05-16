-- Additive migration: add "Request Info" tracking columns to b2b_applications.
-- These fields allow admins to request additional information from applicants
-- without rejecting the application, keeping it in pending state.
-- No existing data is affected; both columns default to NULL.

ALTER TABLE public.b2b_applications
  ADD COLUMN IF NOT EXISTS requested_info_at  timestamptz,
  ADD COLUMN IF NOT EXISTS requested_info_note text;
