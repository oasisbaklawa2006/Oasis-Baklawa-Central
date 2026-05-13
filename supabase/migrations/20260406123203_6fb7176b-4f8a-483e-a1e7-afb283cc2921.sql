ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.is_staff_role(_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT upper(coalesce(_role, '')) = ANY (
    ARRAY[
      'SUPER_ADMIN',
      'ADMIN',
      'FINANCE_HEAD',
      'FINANCE_EXEC',
      'OPERATIONS_MANAGER',
      'PRODUCTION_MANAGER',
      'HOD_ARABIC',
      'HOD_FUSION',
      'HOD_CHOCOLATE',
      'HOD_BAKERY',
      'HOD_NUTS',
      'HOD_ASSEMBLY',
      'STORE_INCHARGE',
      'DISPATCH_MANAGER',
      'DISPATCH_INCHARGE',
      'SECURITY_CONTROL'
    ]
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_profile_approval_for_staff()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.role := upper(coalesce(NEW.role, NEW.role));

  IF public.is_staff_role(NEW.role) THEN
    NEW.is_approved := true;
    NEW.status := 'approved';
  ELSE
    IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
      NEW.status := CASE WHEN coalesce(NEW.is_approved, false) THEN 'approved' ELSE 'pending' END;
    ELSE
      NEW.status := lower(NEW.status);
    END IF;

    IF NEW.is_approved IS NULL THEN
      NEW.is_approved := NEW.status = 'approved';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_enforce_profile_approval_for_staff ON public.profiles;

CREATE TRIGGER trg_profiles_enforce_profile_approval_for_staff
BEFORE INSERT OR UPDATE OF role, is_approved, status
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_approval_for_staff();

UPDATE public.profiles
SET
  role = upper(role),
  is_approved = CASE
    WHEN public.is_staff_role(role) THEN true
    ELSE coalesce(is_approved, false)
  END,
  status = CASE
    WHEN public.is_staff_role(role) THEN 'approved'
    WHEN coalesce(is_approved, false) THEN 'approved'
    ELSE 'pending'
  END;