-- Ensure no existing negative values violate the constraint
UPDATE public.companies SET credit_limit = 0 WHERE credit_limit < 0;

-- Add CHECK constraint
ALTER TABLE public.companies
  ADD CONSTRAINT companies_credit_limit_non_negative CHECK (credit_limit >= 0);