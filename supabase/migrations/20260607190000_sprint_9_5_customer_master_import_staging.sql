-- Sprint 9.5: Customer Master Import Foundation (staging tables only)
-- staging first — production NOT authorized
-- Does NOT import into companies, delivery_addresses, whatsapp_contacts, or users.
-- Does NOT create orders. Does NOT overwrite existing customer data.

-- =============================================================================
-- 0. Batch registry (one row per Excel workbook load attempt)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customer_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_filename text NOT NULL DEFAULT 'oasis_customer_master_audit_import_plan.xlsx',
  source_original_filename text NULL DEFAULT 'Copy of Party (1).xlsx',
  source_environment text NOT NULL DEFAULT 'staging'
    CHECK (source_environment IN ('staging', 'production')),
  status text NOT NULL DEFAULT 'loaded'
    CHECK (status IN ('loaded', 'validated', 'approved', 'promoted', 'rejected', 'archived')),
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  central_mapping jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  loaded_by uuid NULL,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_import_batches_staging_only
    CHECK (source_environment = 'staging')
);

CREATE INDEX IF NOT EXISTS idx_customer_import_batches_status
  ON public.customer_import_batches (status, loaded_at DESC);

-- =============================================================================
-- 1. Raw landing (all workbook tabs, unmodified row JSON)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customer_import_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.customer_import_batches (id) ON DELETE CASCADE,
  source_tab text NOT NULL
    CHECK (source_tab IN (
      'Customer Master Candidate',
      'Contact WhatsApp Candidate',
      'Duplicate Phone Review',
      'Duplicate GST Review',
      'Central Mapping'
    )),
  source_row_number integer NOT NULL CHECK (source_row_number > 0),
  row_json jsonb NOT NULL,
  row_hash text NOT NULL,
  parse_errors text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, source_tab, source_row_number),
  UNIQUE (batch_id, row_hash)
);

CREATE INDEX IF NOT EXISTS idx_customer_import_raw_batch_tab
  ON public.customer_import_raw (batch_id, source_tab, source_row_number);

-- =============================================================================
-- 2. Company / party master candidates (Customer Master Candidate tab)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customer_import_company_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.customer_import_batches (id) ON DELETE CASCADE,
  raw_id uuid NULL REFERENCES public.customer_import_raw (id) ON DELETE SET NULL,

  -- Source identity (from Excel; never overwrites production keys)
  source_customer_key text NOT NULL,
  business_name text NOT NULL,
  trade_name text NULL,
  gst_number_raw text NULL,
  gst_number_normalized text NULL,
  registered_address text NULL,
  city text NULL,
  state text NULL,
  pincode text NULL,
  phone_raw text NULL,
  phone_last10 text NULL,
  payment_terms_raw text NULL,
  payment_terms_normalized text NULL
    CHECK (payment_terms_normalized IS NULL OR payment_terms_normalized IN ('prepaid', 'credit')),
  fssai_number text NULL,
  website text NULL,
  price_tier text NULL,
  status_candidate text NULL,

  -- Client owner placeholder (resolved in promotion phase, not import)
  account_manager_name_raw text NULL,
  account_manager_email_raw text NULL,
  account_manager_id uuid NULL,

  -- Read-only match to existing production/staging master (link only, no UPDATE)
  matched_company_id uuid NULL,
  match_method text NULL
    CHECK (match_method IS NULL OR match_method IN (
      'gst_exact', 'phone_last10', 'business_name', 'manual', 'none', 'new'
    )),
  match_confidence numeric NULL,

  validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN (
      'pending', 'valid', 'warning', 'error',
      'duplicate_gst_in_batch', 'duplicate_gst_existing',
      'duplicate_phone_in_batch', 'duplicate_phone_existing',
      'missing_required', 'review_required'
    )),
  import_action text NOT NULL DEFAULT 'review'
    CHECK (import_action IN ('create_new', 'link_existing', 'skip', 'review')),

  validation_messages text[] NOT NULL DEFAULT '{}',
  review_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (batch_id, source_customer_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_import_company_batch_status
  ON public.customer_import_company_candidates (batch_id, validation_status);

CREATE INDEX IF NOT EXISTS idx_customer_import_company_gst
  ON public.customer_import_company_candidates (batch_id, gst_number_normalized)
  WHERE gst_number_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_import_company_phone
  ON public.customer_import_company_candidates (batch_id, phone_last10)
  WHERE phone_last10 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_import_company_matched
  ON public.customer_import_company_candidates (matched_company_id)
  WHERE matched_company_id IS NOT NULL;

-- =============================================================================
-- 3. Contact / WhatsApp candidates (Contact WhatsApp Candidate tab)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customer_import_contact_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.customer_import_batches (id) ON DELETE CASCADE,
  raw_id uuid NULL REFERENCES public.customer_import_raw (id) ON DELETE SET NULL,

  source_contact_key text NOT NULL,
  source_customer_key text NOT NULL,
  company_candidate_id uuid NULL
    REFERENCES public.customer_import_company_candidates (id) ON DELETE SET NULL,

  contact_name text NULL,
  whatsapp_phone_raw text NOT NULL,
  whatsapp_phone_normalized text NULL,
  phone_last10 text NULL,
  contact_role text NULL,
  is_primary boolean NOT NULL DEFAULT false,

  -- Read-only matches (link only)
  matched_company_id uuid NULL,
  matched_whatsapp_contact_id uuid NULL,
  matched_user_id uuid NULL,
  match_method text NULL
    CHECK (match_method IS NULL OR match_method IN (
      'phone_last10', 'whatsapp_contact', 'user_phone', 'manual', 'none', 'new'
    )),

  validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN (
      'pending', 'valid', 'warning', 'error',
      'duplicate_phone_in_batch', 'duplicate_phone_existing',
      'orphan_customer_key', 'missing_phone', 'review_required'
    )),
  import_action text NOT NULL DEFAULT 'review'
    CHECK (import_action IN ('create_new', 'link_existing', 'skip', 'review')),

  validation_messages text[] NOT NULL DEFAULT '{}',
  review_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (batch_id, source_contact_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_import_contact_batch_status
  ON public.customer_import_contact_candidates (batch_id, validation_status);

CREATE INDEX IF NOT EXISTS idx_customer_import_contact_phone
  ON public.customer_import_contact_candidates (batch_id, phone_last10)
  WHERE phone_last10 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_import_contact_company_key
  ON public.customer_import_contact_candidates (batch_id, source_customer_key);

-- =============================================================================
-- 4. Duplicate review queue (Duplicate Phone / GST Review tabs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customer_import_duplicate_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.customer_import_batches (id) ON DELETE CASCADE,
  raw_id uuid NULL REFERENCES public.customer_import_raw (id) ON DELETE SET NULL,

  duplicate_type text NOT NULL CHECK (duplicate_type IN ('phone', 'gst')),
  duplicate_key_raw text NOT NULL,
  duplicate_key_normalized text NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 0 CHECK (occurrence_count >= 0),

  candidate_source_keys text[] NOT NULL DEFAULT '{}',
  candidate_details jsonb NOT NULL DEFAULT '[]'::jsonb,

  recommended_action_raw text NULL,
  resolution_status text NOT NULL DEFAULT 'pending'
    CHECK (resolution_status IN ('pending', 'keep_one', 'merge', 'skip_all', 'resolved')),
  chosen_winner_source_key text NULL,
  reviewer_notes text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (batch_id, duplicate_type, duplicate_key_normalized)
);

CREATE INDEX IF NOT EXISTS idx_customer_import_duplicate_batch
  ON public.customer_import_duplicate_review (batch_id, duplicate_type, resolution_status);

-- =============================================================================
-- 5. Normalization helpers (used by validation SQL; no data mutation)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.customer_import_normalize_gst(p_gst text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(upper(regexp_replace(trim(COALESCE(p_gst, '')), '[^0-9A-Z]', '', 'g')), '');
$$;

CREATE OR REPLACE FUNCTION public.customer_import_normalize_phone_last10(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(d) >= 10 THEN right(d, 10)
    ELSE NULL
  END
  FROM (SELECT regexp_replace(trim(COALESCE(p_phone, '')), '\D', '', 'g') AS d) s;
$$;

CREATE OR REPLACE FUNCTION public.customer_import_normalize_payment_terms(p_terms text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(COALESCE(p_terms, ''))) IN ('credit', 'cr', 'net', 'net30', 'net 30') THEN 'credit'
    WHEN lower(trim(COALESCE(p_terms, ''))) IN ('prepaid', 'prepaid', 'advance', 'cod', 'cash', 'upi', '') THEN 'prepaid'
    WHEN lower(trim(COALESCE(p_terms, ''))) LIKE '%credit%' THEN 'credit'
    ELSE NULL
  END;
$$;

-- =============================================================================
-- 6. updated_at triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION public.customer_import_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_import_batches_updated_at ON public.customer_import_batches;
CREATE TRIGGER trg_customer_import_batches_updated_at
  BEFORE UPDATE ON public.customer_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.customer_import_set_updated_at();

DROP TRIGGER IF EXISTS trg_customer_import_company_updated_at ON public.customer_import_company_candidates;
CREATE TRIGGER trg_customer_import_company_updated_at
  BEFORE UPDATE ON public.customer_import_company_candidates
  FOR EACH ROW EXECUTE FUNCTION public.customer_import_set_updated_at();

DROP TRIGGER IF EXISTS trg_customer_import_contact_updated_at ON public.customer_import_contact_candidates;
CREATE TRIGGER trg_customer_import_contact_updated_at
  BEFORE UPDATE ON public.customer_import_contact_candidates
  FOR EACH ROW EXECUTE FUNCTION public.customer_import_set_updated_at();

DROP TRIGGER IF EXISTS trg_customer_import_duplicate_updated_at ON public.customer_import_duplicate_review;
CREATE TRIGGER trg_customer_import_duplicate_updated_at
  BEFORE UPDATE ON public.customer_import_duplicate_review
  FOR EACH ROW EXECUTE FUNCTION public.customer_import_set_updated_at();

-- =============================================================================
-- 7. RLS — staging import tables; no buyer access; no auto-promotion
-- =============================================================================
ALTER TABLE public.customer_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_import_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_import_company_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_import_contact_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_import_duplicate_review ENABLE ROW LEVEL SECURITY;

-- Service role (ETL scripts) full access
CREATE POLICY customer_import_batches_service_all
  ON public.customer_import_batches FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY customer_import_raw_service_all
  ON public.customer_import_raw FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY customer_import_company_service_all
  ON public.customer_import_company_candidates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY customer_import_contact_service_all
  ON public.customer_import_contact_candidates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY customer_import_duplicate_service_all
  ON public.customer_import_duplicate_review FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Internal staff read-only (audit / review UI future)
CREATE POLICY customer_import_batches_staff_select
  ON public.customer_import_batches FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY customer_import_raw_staff_select
  ON public.customer_import_raw FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY customer_import_company_staff_select
  ON public.customer_import_company_candidates FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY customer_import_contact_staff_select
  ON public.customer_import_contact_candidates FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY customer_import_duplicate_staff_select
  ON public.customer_import_duplicate_review FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

REVOKE ALL ON TABLE public.customer_import_batches FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_import_raw FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_import_company_candidates FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_import_contact_candidates FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_import_duplicate_review FROM PUBLIC;

GRANT SELECT ON TABLE public.customer_import_batches TO authenticated;
GRANT SELECT ON TABLE public.customer_import_raw TO authenticated;
GRANT SELECT ON TABLE public.customer_import_company_candidates TO authenticated;
GRANT SELECT ON TABLE public.customer_import_contact_candidates TO authenticated;
GRANT SELECT ON TABLE public.customer_import_duplicate_review TO authenticated;

GRANT ALL ON TABLE public.customer_import_batches TO service_role;
GRANT ALL ON TABLE public.customer_import_raw TO service_role;
GRANT ALL ON TABLE public.customer_import_company_candidates TO service_role;
GRANT ALL ON TABLE public.customer_import_contact_candidates TO service_role;
GRANT ALL ON TABLE public.customer_import_duplicate_review TO service_role;

COMMENT ON TABLE public.customer_import_batches IS
  'Sprint 9.5 staging-only registry for oasis_customer_master_audit_import_plan.xlsx loads.';

COMMENT ON TABLE public.customer_import_raw IS
  'Unmodified workbook rows as JSON. Source tabs match Excel audit workbook.';

COMMENT ON TABLE public.customer_import_company_candidates IS
  'Parsed company/party candidates. matched_company_id is read-only link; never overwrites companies.';

COMMENT ON TABLE public.customer_import_contact_candidates IS
  'Parsed WhatsApp/contact candidates. Links to company candidates by source_customer_key.';

COMMENT ON TABLE public.customer_import_duplicate_review IS
  'Human review queue for duplicate phone/GST groups from audit workbook.';
