-- Additive migration: adds soft-delete timestamp to public.users.
-- When an employee is archived, deleted_at is written to this column.
-- No existing data is affected; the column defaults to NULL.
-- Callers should filter WHERE deleted_at IS NULL for active-user queries.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
