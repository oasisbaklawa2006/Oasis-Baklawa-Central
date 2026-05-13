-- 1) Activate Dubai Baklawa + any approved-but-pending companies
UPDATE public.companies c
SET status = 'active'
FROM public.b2b_applications a
WHERE a.business_name = c.business_name
  AND a.status = 'approved'
  AND COALESCE(c.status,'pending') <> 'active';

-- 2) Auto-activate company when application becomes approved
CREATE OR REPLACE FUNCTION public.activate_company_on_application_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.companies
    SET status = 'active'
    WHERE business_name = NEW.business_name
      AND COALESCE(status,'pending') <> 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_company_on_approval ON public.b2b_applications;
CREATE TRIGGER trg_activate_company_on_approval
AFTER INSERT OR UPDATE OF status ON public.b2b_applications
FOR EACH ROW
EXECUTE FUNCTION public.activate_company_on_application_approval();

-- 3) Audit-log RPC for client-side cart failure diagnostics
CREATE OR REPLACE FUNCTION public.log_cart_failure(
  _company_id uuid,
  _error_message text,
  _error_code text DEFAULT NULL,
  _context jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, module_name, action_type, entity_name, entity_id,
    reason, new_value, risk_level
  ) VALUES (
    auth.uid(),
    'cart',
    'create_draft_order_failed',
    'orders',
    COALESCE(_company_id::text,'(null)'),
    _error_message,
    jsonb_build_object('error_code', _error_code, 'context', _context),
    'high'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_cart_failure(uuid, text, text, jsonb) TO authenticated;