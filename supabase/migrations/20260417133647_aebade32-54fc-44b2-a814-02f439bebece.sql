-- Drop existing functions to allow signature/return-type changes
DROP FUNCTION IF EXISTS public.manual_unlock_credit(uuid, text);
DROP FUNCTION IF EXISTS public.run_month_end_credit_lock();

-- Guard trigger: block manual changes to is_frozen
CREATE OR REPLACE FUNCTION public.guard_companies_is_frozen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_frozen IS NOT DISTINCT FROM OLD.is_frozen THEN
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.system_credit_op', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'is_frozen is system-managed. Manual override disabled (automated credit governance).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_is_frozen_manual ON public.companies;
CREATE TRIGGER guard_is_frozen_manual
BEFORE UPDATE OF is_frozen ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.guard_companies_is_frozen();

-- Payment-driven auto-unlock with mandatory audit trail
CREATE OR REPLACE FUNCTION public.handle_credit_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comp record;
  cumulative_rescue numeric;
  month_end timestamptz;
BEGIN
  IF NEW.payment_type IS DISTINCT FROM 'rescue' THEN
    RETURN NEW;
  END IF;

  SELECT id, is_frozen, total_outstanding INTO comp
  FROM public.companies WHERE id = NEW.company_id FOR UPDATE;

  IF NOT FOUND OR NOT comp.is_frozen THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO cumulative_rescue
  FROM public.order_payments
  WHERE company_id = NEW.company_id
    AND payment_type = 'rescue'
    AND created_at >= COALESCE((SELECT rescue_payment_date FROM public.companies WHERE id = NEW.company_id), '1970-01-01'::timestamptz);

  IF cumulative_rescue >= (comp.total_outstanding * 0.70) THEN
    month_end := (date_trunc('month', now()) + interval '1 month' - interval '1 second');

    PERFORM set_config('app.system_credit_op', 'on', true);
    UPDATE public.companies
    SET is_frozen = false,
        rescue_payment_date = COALESCE(rescue_payment_date, now()),
        settlement_deadline = month_end
    WHERE id = NEW.company_id;
    PERFORM set_config('app.system_credit_op', 'off', true);

    INSERT INTO public.audit_logs (
      action_type, module_name, entity_name, entity_id, actor_id, reason, new_value, risk_level
    ) VALUES (
      'CREDIT_UNFREEZE_AUTO', 'credit_governance', 'companies', NEW.company_id::text, NULL,
      'Automated unlock: 70% rescue threshold reached',
      jsonb_build_object(
        'transaction_id', NEW.id,
        'reference_no', NEW.reference_no,
        'rescue_amount', NEW.amount,
        'cumulative_rescue', cumulative_rescue,
        'outstanding_at_unlock', comp.total_outstanding,
        'settlement_deadline', month_end
      ),
      'high'
    );

    INSERT INTO public.credit_rescue_events (
      company_id, event_type, amount, outstanding_at_event, notes, actor_id
    ) VALUES (
      NEW.company_id, 'auto_unlock', NEW.amount, comp.total_outstanding,
      'Auto-unlock via payment ' || NEW.id::text, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Month-end automated lock with audit trail
CREATE OR REPLACE FUNCTION public.run_month_end_credit_lock()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  locked_count int := 0;
BEGIN
  PERFORM set_config('app.system_credit_op', 'on', true);

  FOR c IN
    SELECT id, total_outstanding FROM public.companies
    WHERE payment_terms = 'credit' AND total_outstanding > 0 AND is_frozen = false
  LOOP
    UPDATE public.companies
    SET is_frozen = true, rescue_payment_date = NULL, settlement_deadline = NULL
    WHERE id = c.id;

    INSERT INTO public.audit_logs (
      action_type, module_name, entity_name, entity_id, reason, new_value, risk_level
    ) VALUES (
      'CREDIT_FREEZE_MONTH_END', 'credit_governance', 'companies', c.id::text,
      'Month-end automated freeze: outstanding > 0',
      jsonb_build_object('outstanding', c.total_outstanding, 'locked_at', now()),
      'high'
    );

    INSERT INTO public.credit_rescue_events (
      company_id, event_type, outstanding_at_event, notes
    ) VALUES (c.id, 'month_end_lock', c.total_outstanding, 'Automated month-end lock');

    locked_count := locked_count + 1;
  END LOOP;

  PERFORM set_config('app.system_credit_op', 'off', true);
  RETURN jsonb_build_object('locked', locked_count, 'ran_at', now());
END;
$$;