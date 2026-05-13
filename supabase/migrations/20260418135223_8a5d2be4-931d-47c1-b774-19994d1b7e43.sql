
-- 1) Backfill missing public.users row for the approved Dubai Baklawa buyer
INSERT INTO public.users (id, email, role, company_id)
VALUES (
  '0da8b5fa-96c8-4a5c-9f8b-8b29518103a8',
  'myramutreja@gmail.com',
  'b2b_buyer',
  '3a82d962-4a96-46ab-b1e8-93938a5e5e6a'
)
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    role = COALESCE(NULLIF(public.users.role,''), EXCLUDED.role);

-- 2) General backfill: any approved b2b_application whose user has no users row OR null company_id
INSERT INTO public.users (id, email, role, company_id)
SELECT DISTINCT ON (a.user_id)
  a.user_id,
  COALESCE(a.contact_email, ''),
  'b2b_buyer',
  c.id
FROM public.b2b_applications a
JOIN public.companies c ON c.business_name = a.business_name
WHERE a.status = 'approved'
  AND a.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.user_id)
ON CONFLICT (id) DO NOTHING;

UPDATE public.users u
SET company_id = c.id
FROM public.b2b_applications a
JOIN public.companies c ON c.business_name = a.business_name
WHERE a.status = 'approved'
  AND a.user_id = u.id
  AND u.company_id IS NULL;

-- 3) Trigger: when a b2b_application transitions to 'approved', ensure user row exists & company_id is linked
CREATE OR REPLACE FUNCTION public.link_buyer_on_application_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resolved_company_id uuid;
BEGIN
  IF NEW.status <> 'approved' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO resolved_company_id
  FROM public.companies
  WHERE business_name = NEW.business_name
  LIMIT 1;

  IF resolved_company_id IS NULL THEN
    INSERT INTO public.companies (business_name, gst_number, phone, registered_address, status)
    VALUES (NEW.business_name, NEW.gst_number, NEW.contact_phone, NEW.registered_address, 'active')
    RETURNING id INTO resolved_company_id;
  END IF;

  INSERT INTO public.users (id, email, role, company_id)
  VALUES (NEW.user_id, NEW.contact_email, 'b2b_buyer', resolved_company_id)
  ON CONFLICT (id) DO UPDATE
    SET company_id = COALESCE(public.users.company_id, EXCLUDED.company_id),
        role = COALESCE(NULLIF(public.users.role, ''), EXCLUDED.role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_buyer_on_approval ON public.b2b_applications;
CREATE TRIGGER trg_link_buyer_on_approval
AFTER INSERT OR UPDATE OF status ON public.b2b_applications
FOR EACH ROW
EXECUTE FUNCTION public.link_buyer_on_application_approval();
