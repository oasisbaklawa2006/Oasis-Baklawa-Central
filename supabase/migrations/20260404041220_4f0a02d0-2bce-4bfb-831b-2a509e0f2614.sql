CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.users (id, email, role)
    VALUES (new.id, new.email, NULL)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping public profile creation due to strict table rules.';
  END;

  RETURN new;
END;
$$;