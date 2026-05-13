-- 1. Add payment_terms to companies (preserve existing credit_limit)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT 'prepaid';

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_payment_terms_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_payment_terms_check
  CHECK (payment_terms IN ('prepaid','credit'));

-- Backfill: existing allow_credit=true rows -> 'credit'
UPDATE public.companies
  SET payment_terms = 'credit'
  WHERE allow_credit = true AND payment_terms = 'prepaid';

-- 2. Bi-monthly ledgers
CREATE TABLE IF NOT EXISTS public.bi_monthly_ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  pdf_url text,
  status text NOT NULL DEFAULT 'sent',
  whatsapp_message_id text,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bi_monthly_ledgers
  DROP CONSTRAINT IF EXISTS bi_monthly_ledgers_status_check;
ALTER TABLE public.bi_monthly_ledgers
  ADD CONSTRAINT bi_monthly_ledgers_status_check
  CHECK (status IN ('draft','sent','matched','disputed','resolved'));

CREATE INDEX IF NOT EXISTS idx_bml_company ON public.bi_monthly_ledgers(company_id);
CREATE INDEX IF NOT EXISTS idx_bml_period ON public.bi_monthly_ledgers(period_start, period_end);

ALTER TABLE public.bi_monthly_ledgers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access bi_monthly_ledgers"
  ON public.bi_monthly_ledgers FOR ALL TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Buyers read own company ledgers"
  ON public.bi_monthly_ledgers FOR SELECT TO authenticated
  USING (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1));

-- 3. Ledger disputes
CREATE TABLE IF NOT EXISTS public.ledger_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid NOT NULL REFERENCES public.bi_monthly_ledgers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  raised_via text NOT NULL DEFAULT 'whatsapp',
  description text,
  status text NOT NULL DEFAULT 'open',
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ledger_disputes
  DROP CONSTRAINT IF EXISTS ledger_disputes_status_check;
ALTER TABLE public.ledger_disputes
  ADD CONSTRAINT ledger_disputes_status_check
  CHECK (status IN ('open','investigating','resolved'));

CREATE INDEX IF NOT EXISTS idx_ld_ledger ON public.ledger_disputes(ledger_id);
CREATE INDEX IF NOT EXISTS idx_ld_status ON public.ledger_disputes(status);

ALTER TABLE public.ledger_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access ledger_disputes"
  ON public.ledger_disputes FOR ALL TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Buyers read own company disputes"
  ON public.ledger_disputes FOR SELECT TO authenticated
  USING (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1));

CREATE POLICY "Buyers raise own company disputes"
  ON public.ledger_disputes FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1));