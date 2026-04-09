
-- Create trigger function to notify admins on new B2B application
CREATE OR REPLACE FUNCTION public.notify_admin_new_b2b_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Insert a notification for each admin/super_admin user
  FOR admin_record IN
    SELECT id FROM public.users
    WHERE upper(role) IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 20
  LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      message,
      is_read
    ) VALUES (
      admin_record.id,
      'new_application',
      '🆕 New B2B Application: ' || COALESCE(NEW.business_name, 'Unknown') || ' — Contact: ' || COALESCE(NEW.contact_person, NEW.contact_email, 'N/A'),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Attach trigger to b2b_applications
DROP TRIGGER IF EXISTS trg_notify_admin_new_application ON public.b2b_applications;
CREATE TRIGGER trg_notify_admin_new_application
  AFTER INSERT ON public.b2b_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_b2b_application();
