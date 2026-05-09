-- Phase 4.3: GSTIN verification attestations (server-written) + application columns filled by trigger.

-- Applicant-facing verification records (writes via Edge Function service role only)
CREATE TABLE public.gstin_verification_attestations (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  gstin text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  registration_status text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, gstin)
);

CREATE INDEX IF NOT EXISTS idx_gstin_attestations_user ON public.gstin_verification_attestations (user_id);

ALTER TABLE public.gstin_verification_attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own GSTIN attestations"
  ON public.gstin_verification_attestations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff read all GSTIN attestations"
  ON public.gstin_verification_attestations
  FOR SELECT
  TO authenticated
  USING (public.is_internal_staff(auth.uid()));

-- Columns copied onto b2b_applications at insert time (applicant flow only; see trigger)
ALTER TABLE public.b2b_applications
  ADD COLUMN IF NOT EXISTS gstin_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS gstin_registration_status text,
  ADD COLUMN IF NOT EXISTS gstin_verification_snapshot jsonb;

COMMENT ON COLUMN public.b2b_applications.gstin_verified_at IS 'Set from gstin_verification_attestations on applicant insert';
COMMENT ON COLUMN public.b2b_applications.gstin_registration_status IS 'active | unverified_offline | etc.; see attestation';
COMMENT ON COLUMN public.b2b_applications.gstin_verification_snapshot IS 'Minimal JSON snapshot from verification provider (server-attested)';

CREATE OR REPLACE FUNCTION public.b2b_applications_apply_gstin_attestation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  att RECORD;
  gst text;
BEGIN
  gst := upper(trim(COALESCE(NEW.gst_number, '')));

  -- Internal / staff-created rows: no applicant linkage or no GST — skip
  IF NEW.user_id IS NULL OR gst = '' THEN
    RETURN NEW;
  END IF;

  IF public.is_internal_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT a.registration_status, a.verified_at, a.snapshot
  INTO att
  FROM public.gstin_verification_attestations a
  WHERE a.user_id = NEW.user_id AND a.gstin = gst;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GSTIN must be verified before submitting your application';
  END IF;

  IF att.registration_status IN ('cancelled', 'suspended', 'invalid') THEN
    RAISE EXCEPTION 'GST registration status "%" is not eligible for onboarding', att.registration_status;
  END IF;

  IF att.registration_status NOT IN ('active', 'unverified_offline') THEN
    RAISE EXCEPTION 'GST registration could not be confirmed. Verify again or contact support.';
  END IF;

  NEW.gstin_verified_at := att.verified_at;
  NEW.gstin_registration_status := att.registration_status;
  NEW.gstin_verification_snapshot := att.snapshot;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_b2b_applications_gstin_attestation ON public.b2b_applications;
CREATE TRIGGER trg_b2b_applications_gstin_attestation
  BEFORE INSERT ON public.b2b_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.b2b_applications_apply_gstin_attestation();
