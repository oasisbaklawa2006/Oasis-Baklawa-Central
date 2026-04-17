-- 1. Schema additions to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_outstanding numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rescue_payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_deadline timestamptz;

CREATE INDEX IF NOT EXISTS idx_companies_is_frozen ON public.companies(is_frozen) WHERE is_frozen = true;

-- 2. Audit table for rescue lifecycle
CREATE TABLE IF NOT EXISTS public.credit_rescue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('frozen','rescue_payment','unlocked','month_end_lock','manual_override','settlement_deadline_set')),
  amount numeric DEFAULT 0,
  outstanding_at_event numeric DEFAULT 0,
  notes text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_rescue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access to rescue events"
  ON public.credit_rescue_events FOR ALL
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Companies view own rescue events"
  ON public.credit_rescue_events FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 3. Trigger: maintain total_outstanding from orders (credit term only)
CREATE OR REPLACE FUNCTION public.update_outstanding_on_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  terms text;
  delta numeric := 0;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  SELECT payment_terms INTO terms FROM public.companies WHERE id = NEW.company_id;
  IF terms IS DISTINCT FROM 'credit' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft','cart','cancelled') THEN
      delta := COALESCE(NEW.sales_order_value, 0);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse old contribution if it was counted
    IF OLD.status NOT IN ('draft','cart','cancelled') THEN
      delta := delta - COALESCE(OLD.sales_order_value, 0);
    END IF;
    IF NEW.status NOT IN ('draft','cart','cancelled') THEN
      delta := delta + COALESCE(NEW.sales_order_value, 0);
    END IF;
  END IF;

  IF delta <> 0 THEN
    UPDATE public.companies
       SET total_outstanding = GREATEST(0, COALESCE(total_outstanding,0) + delta)
     WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outstanding_on_order ON public.orders;
CREATE TRIGGER trg_outstanding_on_order
AFTER INSERT OR UPDATE OF status, sales_order_value ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_outstanding_on_order();

-- 4. Trigger: payments reduce outstanding + auto-unlock on 70% rescue
CREATE OR REPLACE FUNCTION public.handle_credit_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  comp record;
  cumulative_rescue numeric;
  threshold numeric;
  month_end timestamptz;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO comp FROM public.companies WHERE id = NEW.company_id;
  IF comp.payment_terms IS DISTINCT FROM 'credit' THEN RETURN NEW; END IF;

  -- Reduce outstanding
  UPDATE public.companies
     SET total_outstanding = GREATEST(0, COALESCE(total_outstanding,0) - COALESCE(NEW.amount,0))
   WHERE id = NEW.company_id;

  -- Auto-unlock check: only if currently frozen and payment is rescue type
  IF comp.is_frozen AND lower(COALESCE(NEW.payment_type,'')) = 'rescue' THEN
    SELECT COALESCE(SUM(amount),0) INTO cumulative_rescue
      FROM public.order_payments
     WHERE company_id = NEW.company_id
       AND lower(payment_type) = 'rescue'
       AND created_at >= COALESCE(comp.rescue_payment_date, now() - interval '60 days');

    threshold := COALESCE(comp.total_outstanding, 0) * 0.70;
    -- Note: comp.total_outstanding is the snapshot BEFORE this payment reduced it.

    IF cumulative_rescue >= threshold THEN
      month_end := date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 month' - interval '1 second';
      UPDATE public.companies
         SET is_frozen = false,
             rescue_payment_date = now(),
             settlement_deadline = month_end
       WHERE id = NEW.company_id;

      INSERT INTO public.credit_rescue_events(company_id, event_type, amount, outstanding_at_event, notes, actor_id)
      VALUES (NEW.company_id, 'unlocked', cumulative_rescue, comp.total_outstanding,
              'Auto-unlock: 70% rescue threshold reached', NEW.created_by);
    END IF;
  END IF;

  -- Always log rescue payments
  IF lower(COALESCE(NEW.payment_type,'')) = 'rescue' THEN
    INSERT INTO public.credit_rescue_events(company_id, event_type, amount, outstanding_at_event, notes, actor_id)
    VALUES (NEW.company_id, 'rescue_payment', NEW.amount, comp.total_outstanding,
            'Rescue payment received', NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_payment ON public.order_payments;
CREATE TRIGGER trg_credit_payment
AFTER INSERT ON public.order_payments
FOR EACH ROW EXECUTE FUNCTION public.handle_credit_payment();

-- 5. Trigger: block new orders for frozen companies (defence in depth)
CREATE OR REPLACE FUNCTION public.block_orders_when_frozen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  frozen boolean;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  -- Allow draft/cart so user can browse; block real submission
  IF NEW.status IN ('draft','cart') THEN RETURN NEW; END IF;

  SELECT is_frozen INTO frozen FROM public.companies WHERE id = NEW.company_id;
  IF COALESCE(frozen,false) THEN
    RAISE EXCEPTION 'CREDIT_FROZEN: Company credit is locked. Settle outstanding balance to resume operations.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_orders_frozen ON public.orders;
CREATE TRIGGER trg_block_orders_frozen
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.block_orders_when_frozen();

-- 6. Manual unlock RPC for Finance
CREATE OR REPLACE FUNCTION public.manual_unlock_credit(_company_id uuid, _notes text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  comp record;
  month_end timestamptz;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO comp FROM public.companies WHERE id = _company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Company not found'; END IF;

  month_end := date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 month' - interval '1 second';

  UPDATE public.companies
     SET is_frozen = false,
         rescue_payment_date = now(),
         settlement_deadline = month_end
   WHERE id = _company_id;

  INSERT INTO public.credit_rescue_events(company_id, event_type, amount, outstanding_at_event, notes, actor_id)
  VALUES (_company_id, 'manual_override', 0, comp.total_outstanding,
          COALESCE(_notes,'Manual unlock by Finance'), auth.uid());

  RETURN json_build_object('ok', true, 'settlement_deadline', month_end);
END;
$$;

-- 7. Month-end lock RPC (called by cron)
CREATE OR REPLACE FUNCTION public.run_month_end_credit_lock()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  locked_count int := 0;
  c record;
BEGIN
  FOR c IN
    SELECT id, total_outstanding FROM public.companies
     WHERE payment_terms = 'credit'
       AND COALESCE(total_outstanding,0) > 0
       AND COALESCE(is_frozen,false) = false
  LOOP
    UPDATE public.companies SET is_frozen = true WHERE id = c.id;
    INSERT INTO public.credit_rescue_events(company_id, event_type, outstanding_at_event, notes)
    VALUES (c.id, 'month_end_lock', c.total_outstanding,
            'Month-End Settlement Protocol: Full balance required to resume operations.');
    locked_count := locked_count + 1;
  END LOOP;
  RETURN json_build_object('ok', true, 'locked', locked_count, 'at', now());
END;
$$;

-- 8. Allow 'rescue' as a payment_type value (no constraint exists per schema, just convention)
COMMENT ON COLUMN public.order_payments.payment_type IS 'advance | balance | rescue | refund';