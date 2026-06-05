-- Sprint 9.5: Customer Master Import — validation SQL only
-- Run AFTER loading workbook into customer_import_* staging tables.
-- Read-only against production master (companies, users, whatsapp_contacts).
-- Does NOT INSERT/UPDATE/DELETE companies or contacts.
-- staging first — production NOT authorized for import batches

-- =============================================================================
-- A. Batch summary
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_batch_summary AS
SELECT
  b.id AS batch_id,
  b.source_filename,
  b.status AS batch_status,
  b.loaded_at,
  (SELECT COUNT(*) FROM public.customer_import_raw r WHERE r.batch_id = b.id) AS raw_rows,
  (SELECT COUNT(*) FROM public.customer_import_company_candidates c WHERE c.batch_id = b.id) AS company_candidates,
  (SELECT COUNT(*) FROM public.customer_import_contact_candidates ct WHERE ct.batch_id = b.id) AS contact_candidates,
  (SELECT COUNT(*) FROM public.customer_import_duplicate_review d WHERE d.batch_id = b.id) AS duplicate_review_rows,
  (SELECT COUNT(*) FROM public.customer_import_company_candidates c
    WHERE c.batch_id = b.id AND c.validation_status = 'valid') AS company_valid,
  (SELECT COUNT(*) FROM public.customer_import_company_candidates c
    WHERE c.batch_id = b.id AND c.validation_status IN ('error', 'missing_required')) AS company_errors,
  (SELECT COUNT(*) FROM public.customer_import_contact_candidates ct
    WHERE ct.batch_id = b.id AND ct.validation_status = 'valid') AS contact_valid,
  (SELECT COUNT(*) FROM public.customer_import_duplicate_review d
    WHERE d.batch_id = b.id AND d.resolution_status = 'pending') AS duplicates_pending
FROM public.customer_import_batches b;

-- =============================================================================
-- B. Required field validation (company candidates)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_company_required_gaps AS
SELECT
  c.id,
  c.batch_id,
  c.source_customer_key,
  c.business_name,
  c.validation_status,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN NULLIF(trim(c.business_name), '') IS NULL THEN 'missing_business_name' END,
    CASE WHEN NULLIF(trim(c.source_customer_key), '') IS NULL THEN 'missing_source_customer_key' END,
    CASE WHEN c.payment_terms_normalized IS NULL AND NULLIF(trim(c.payment_terms_raw), '') IS NOT NULL
      THEN 'invalid_payment_terms' END,
    CASE WHEN NULLIF(trim(c.gst_number_raw), '') IS NOT NULL
      AND length(public.customer_import_normalize_gst(c.gst_number_raw)) <> 15
      THEN 'invalid_gst_format' END,
    CASE WHEN NULLIF(trim(c.phone_raw), '') IS NOT NULL
      AND public.customer_import_normalize_phone_last10(c.phone_raw) IS NULL
      THEN 'invalid_phone_format' END
  ], NULL) AS gap_codes
FROM public.customer_import_company_candidates c
WHERE c.import_action <> 'skip';

-- =============================================================================
-- C. Duplicate GST within batch
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_duplicate_gst_in_batch AS
SELECT
  c.batch_id,
  c.gst_number_normalized,
  COUNT(*) AS candidate_count,
  array_agg(c.source_customer_key ORDER BY c.source_customer_key) AS source_customer_keys,
  array_agg(c.business_name ORDER BY c.source_customer_key) AS business_names
FROM public.customer_import_company_candidates c
WHERE c.gst_number_normalized IS NOT NULL
  AND c.import_action <> 'skip'
GROUP BY c.batch_id, c.gst_number_normalized
HAVING COUNT(*) > 1;

-- =============================================================================
-- D. Duplicate phone within batch (company-level)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_duplicate_phone_in_batch AS
SELECT
  c.batch_id,
  c.phone_last10,
  COUNT(*) AS candidate_count,
  array_agg(c.source_customer_key ORDER BY c.source_customer_key) AS source_customer_keys,
  array_agg(c.business_name ORDER BY c.source_customer_key) AS business_names
FROM public.customer_import_company_candidates c
WHERE c.phone_last10 IS NOT NULL
  AND c.import_action <> 'skip'
GROUP BY c.batch_id, c.phone_last10
HAVING COUNT(*) > 1;

-- =============================================================================
-- D2. Duplicate phone within batch (company + contact, cross-table)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_duplicate_phone_any_in_batch AS
SELECT
  phones.batch_id,
  phones.phone_last10,
  COUNT(*) AS occurrence_count,
  COUNT(*) FILTER (WHERE phones.source_kind = 'company') AS company_candidate_count,
  COUNT(*) FILTER (WHERE phones.source_kind = 'contact') AS contact_candidate_count,
  array_agg(phones.source_key ORDER BY phones.source_kind, phones.source_key) AS source_keys
FROM (
  SELECT
    c.batch_id,
    c.phone_last10,
    'company'::text AS source_kind,
    c.source_customer_key AS source_key
  FROM public.customer_import_company_candidates c
  WHERE c.phone_last10 IS NOT NULL
    AND c.import_action <> 'skip'

  UNION ALL

  SELECT
    ct.batch_id,
    ct.phone_last10,
    'contact'::text AS source_kind,
    ct.source_contact_key AS source_key
  FROM public.customer_import_contact_candidates ct
  WHERE ct.phone_last10 IS NOT NULL
    AND ct.import_action <> 'skip'
) phones
GROUP BY phones.batch_id, phones.phone_last10
HAVING COUNT(*) > 1;

-- =============================================================================
-- E. Duplicate phone within batch (contact-level)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_duplicate_contact_phone_in_batch AS
SELECT
  ct.batch_id,
  ct.phone_last10,
  COUNT(*) AS contact_count,
  array_agg(ct.source_contact_key ORDER BY ct.source_contact_key) AS source_contact_keys,
  array_agg(ct.source_customer_key ORDER BY ct.source_contact_key) AS source_customer_keys
FROM public.customer_import_contact_candidates ct
WHERE ct.phone_last10 IS NOT NULL
  AND ct.import_action <> 'skip'
GROUP BY ct.batch_id, ct.phone_last10
HAVING COUNT(*) > 1;

-- =============================================================================
-- F. Cross-match: import GST vs existing companies (read-only; no overwrite)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_gst_match_existing AS
SELECT
  c.batch_id,
  c.id AS company_candidate_id,
  c.source_customer_key,
  c.business_name AS import_business_name,
  c.gst_number_normalized,
  co.id AS existing_company_id,
  co.business_name AS existing_business_name,
  co.status AS existing_status,
  CASE
    WHEN co.id IS NULL THEN 'no_match'
    WHEN c.matched_company_id IS NOT NULL AND c.matched_company_id = co.id THEN 'already_linked'
    ELSE 'conflict_existing_gst'
  END AS match_outcome
FROM public.customer_import_company_candidates c
LEFT JOIN public.companies co
  ON public.customer_import_normalize_gst(co.gst_number) = c.gst_number_normalized
WHERE c.gst_number_normalized IS NOT NULL;

-- =============================================================================
-- G. Cross-match: import phone vs existing companies / users / WA contacts
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_phone_match_existing AS
SELECT
  c.batch_id,
  c.id AS company_candidate_id,
  c.source_customer_key,
  c.phone_last10,
  co.id AS matched_company_id,
  co.business_name AS matched_company_name,
  u.id AS matched_user_id,
  wc.id AS matched_whatsapp_contact_id,
  CASE
    WHEN co.id IS NOT NULL THEN 'company_phone'
    WHEN u.id IS NOT NULL THEN 'user_phone'
    WHEN wc.id IS NOT NULL THEN 'whatsapp_contact'
    ELSE 'no_match'
  END AS match_source
FROM public.customer_import_company_candidates c
LEFT JOIN public.companies co
  ON public.customer_import_normalize_phone_last10(co.phone) = c.phone_last10
LEFT JOIN public.users u
  ON public.customer_import_normalize_phone_last10(COALESCE(u.phone, u.mobile_number)) = c.phone_last10
LEFT JOIN public.whatsapp_contacts wc
  ON public.customer_import_normalize_phone_last10(wc.phone_number) = c.phone_last10
WHERE c.phone_last10 IS NOT NULL;

-- =============================================================================
-- H. Orphan contacts (missing company candidate by key or company_name)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_orphan_contacts AS
SELECT
  ct.id,
  ct.batch_id,
  ct.source_contact_key,
  ct.source_customer_key,
  ct.company_name,
  ct.whatsapp_phone_raw,
  ct.validation_status
FROM public.customer_import_contact_candidates ct
LEFT JOIN public.customer_import_company_candidates c
  ON c.batch_id = ct.batch_id
  AND c.import_action <> 'skip'
  AND (
    c.source_customer_key = ct.source_customer_key
    OR lower(trim(c.business_name)) = lower(trim(ct.company_name))
  )
WHERE ct.import_action <> 'skip'
  AND c.id IS NULL;

-- =============================================================================
-- H2. Duplicate company name within batch
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_duplicate_name_in_batch AS
SELECT
  c.batch_id,
  lower(trim(c.business_name)) AS business_name_normalized,
  COUNT(*) AS candidate_count,
  array_agg(c.source_customer_key ORDER BY c.source_customer_key) AS source_customer_keys,
  array_agg(c.business_name ORDER BY c.source_customer_key) AS business_names
FROM public.customer_import_company_candidates c
WHERE NULLIF(trim(c.business_name), '') IS NOT NULL
  AND c.import_action <> 'skip'
GROUP BY c.batch_id, lower(trim(c.business_name))
HAVING COUNT(*) > 1;

-- =============================================================================
-- I. Duplicate review alignment (workbook vs computed)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_duplicate_review_alignment AS
SELECT
  d.batch_id,
  d.duplicate_type,
  d.duplicate_key_normalized,
  d.occurrence_count AS workbook_count,
  d.resolution_status,
  d.chosen_winner_source_key,
  CASE d.duplicate_type
    WHEN 'gst' THEN (
      SELECT g.candidate_count FROM public.v_customer_import_duplicate_gst_in_batch g
      WHERE g.batch_id = d.batch_id AND g.gst_number_normalized = d.duplicate_key_normalized
    )
    WHEN 'phone' THEN (
      SELECT p.occurrence_count FROM public.v_customer_import_duplicate_phone_any_in_batch p
      WHERE p.batch_id = d.batch_id AND p.phone_last10 = d.duplicate_key_normalized
    )
    WHEN 'name' THEN (
      SELECT n.candidate_count FROM public.v_customer_import_duplicate_name_in_batch n
      WHERE n.batch_id = d.batch_id AND n.business_name_normalized = d.duplicate_key_normalized
    )
  END AS computed_candidate_count
FROM public.customer_import_duplicate_review d;

-- =============================================================================
-- J. Client owner placeholder resolution preview (read-only)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_owner_placeholder AS
SELECT
  c.batch_id,
  c.source_customer_key,
  c.account_manager_name_raw,
  c.account_manager_email_raw,
  match.resolved_user_id,
  match.resolved_user_name,
  match.is_sales_executive,
  CASE
    WHEN match.resolved_user_id IS NOT NULL THEN 'resolved'
    WHEN NULLIF(trim(c.account_manager_name_raw), '') IS NOT NULL THEN 'unresolved_name'
    WHEN NULLIF(trim(c.account_manager_email_raw), '') IS NOT NULL THEN 'unresolved_email'
    ELSE 'missing_owner_placeholder'
  END AS owner_resolution_status
FROM public.customer_import_company_candidates c
LEFT JOIN LATERAL (
  SELECT
    u.id AS resolved_user_id,
    u.full_name AS resolved_user_name,
    u.is_sales_executive
  FROM public.users u
  WHERE lower(trim(u.email)) = lower(trim(c.account_manager_email_raw))
    OR lower(trim(u.full_name)) = lower(trim(c.account_manager_name_raw))
    OR lower(trim(u.name)) = lower(trim(c.account_manager_name_raw))
  ORDER BY
    CASE
      WHEN lower(trim(u.email)) = lower(trim(c.account_manager_email_raw)) THEN 0
      WHEN lower(trim(u.full_name)) = lower(trim(c.account_manager_name_raw)) THEN 1
      ELSE 2
    END,
    u.id
  LIMIT 1
) match ON true
WHERE c.import_action <> 'skip';

-- =============================================================================
-- K. Promotion readiness gate (staging import NOT safe until all pass)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_customer_import_promotion_readiness AS
SELECT
  b.id AS batch_id,
  b.status AS batch_status,
  EXISTS (
    SELECT 1 FROM public.v_customer_import_duplicate_gst_in_batch g
    WHERE g.batch_id = b.id
  ) AS has_unresolved_duplicate_gst_in_batch,
  EXISTS (
    SELECT 1 FROM public.v_customer_import_duplicate_phone_any_in_batch p
    WHERE p.batch_id = b.id
  ) AS has_unresolved_duplicate_phone_in_batch,
  EXISTS (
    SELECT 1 FROM public.v_customer_import_duplicate_contact_phone_in_batch cp
    WHERE cp.batch_id = b.id
  ) AS has_unresolved_duplicate_contact_phone_in_batch,
  EXISTS (
    SELECT 1 FROM public.v_customer_import_duplicate_name_in_batch n
    WHERE n.batch_id = b.id
  ) AS has_unresolved_duplicate_name_in_batch,
  EXISTS (
    SELECT 1 FROM public.v_customer_import_orphan_contacts o
    WHERE o.batch_id = b.id
  ) AS has_orphan_contacts,
  EXISTS (
    SELECT 1 FROM public.v_customer_import_company_required_gaps g
    WHERE g.batch_id = b.id AND cardinality(g.gap_codes) > 0
  ) AS has_required_field_gaps,
  EXISTS (
    SELECT 1 FROM public.customer_import_duplicate_review d
    WHERE d.batch_id = b.id AND d.resolution_status = 'pending'
  ) AS has_pending_duplicate_review,
  EXISTS (
    SELECT 1 FROM public.customer_import_company_candidates c
    WHERE c.batch_id = b.id AND c.import_action = 'review'
  ) AS has_company_rows_pending_review,
  EXISTS (
    SELECT 1 FROM public.customer_import_contact_candidates ct
    WHERE ct.batch_id = b.id AND ct.import_action = 'review'
  ) AS has_contact_rows_pending_review,
  (
    NOT EXISTS (SELECT 1 FROM public.v_customer_import_duplicate_gst_in_batch g WHERE g.batch_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM public.v_customer_import_duplicate_phone_any_in_batch p WHERE p.batch_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM public.v_customer_import_duplicate_name_in_batch n WHERE n.batch_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM public.v_customer_import_orphan_contacts o WHERE o.batch_id = b.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.v_customer_import_company_required_gaps g
      WHERE g.batch_id = b.id AND cardinality(g.gap_codes) > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_import_duplicate_review d
      WHERE d.batch_id = b.id AND d.resolution_status = 'pending'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_import_company_candidates c
      WHERE c.batch_id = b.id AND c.import_action = 'review'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_import_contact_candidates ct
      WHERE ct.batch_id = b.id AND ct.import_action = 'review'
    )
  ) AS safe_for_staging_promotion_review
FROM public.customer_import_batches b;

-- =============================================================================
-- L. One-shot validation runner (returns summary rows; read-only)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.run_customer_import_validation(p_batch_id uuid)
RETURNS TABLE (
  check_code text,
  severity text,
  row_count bigint,
  is_blocking boolean,
  detail text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_internal_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: customer import validation is restricted to internal staff';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customer_import_batches b WHERE b.id = p_batch_id) THEN
    RETURN QUERY
    SELECT 'batch_exists'::text, 'error'::text, 1::bigint, true, 'Batch not found'::text;
    RETURN;
  END IF;

  RETURN QUERY

  SELECT 'raw_rows_loaded', 'info', COUNT(*), false, 'Rows in customer_import_raw'
  FROM public.customer_import_raw r WHERE r.batch_id = p_batch_id

  UNION ALL

  SELECT 'company_candidates', 'info', COUNT(*), false, 'Rows in customer_import_company_candidates'
  FROM public.customer_import_company_candidates c WHERE c.batch_id = p_batch_id

  UNION ALL

  SELECT 'contact_candidates', 'info', COUNT(*), false, 'Rows in customer_import_contact_candidates'
  FROM public.customer_import_contact_candidates ct WHERE ct.batch_id = p_batch_id

  UNION ALL

  SELECT 'duplicate_gst_in_batch', 'error', COUNT(*), true, 'Duplicate GST groups within batch'
  FROM public.v_customer_import_duplicate_gst_in_batch g WHERE g.batch_id = p_batch_id

  UNION ALL

  SELECT 'duplicate_phone_any_in_batch', 'error', COUNT(*), true,
    'Duplicate phone groups within batch (company and/or contact rows)'
  FROM public.v_customer_import_duplicate_phone_any_in_batch p WHERE p.batch_id = p_batch_id

  UNION ALL

  SELECT 'duplicate_phone_in_batch', 'info', COUNT(*), false, 'Duplicate company-only phone groups within batch'
  FROM public.v_customer_import_duplicate_phone_in_batch p WHERE p.batch_id = p_batch_id

  UNION ALL

  SELECT 'duplicate_name_in_batch', 'error', COUNT(*), true, 'Duplicate company name groups within batch'
  FROM public.v_customer_import_duplicate_name_in_batch n WHERE n.batch_id = p_batch_id

  UNION ALL

  SELECT 'duplicate_contact_phone_in_batch', 'info', COUNT(*), false, 'Duplicate contact-only phone groups within batch'
  FROM public.v_customer_import_duplicate_contact_phone_in_batch p WHERE p.batch_id = p_batch_id

  UNION ALL

  SELECT 'orphan_contacts', 'error', COUNT(*), true, 'Contacts without matching company candidate key'
  FROM public.v_customer_import_orphan_contacts o WHERE o.batch_id = p_batch_id

  UNION ALL

  SELECT 'required_field_gaps', 'error', COUNT(*), true, 'Company candidates with required field gaps'
  FROM public.v_customer_import_company_required_gaps g
  WHERE g.batch_id = p_batch_id AND cardinality(g.gap_codes) > 0

  UNION ALL

  SELECT 'company_rows_pending_review', 'error', COUNT(*), true, 'Company candidates with import_action = review'
  FROM public.customer_import_company_candidates c
  WHERE c.batch_id = p_batch_id AND c.import_action = 'review'

  UNION ALL

  SELECT 'contact_rows_pending_review', 'error', COUNT(*), true, 'Contact candidates with import_action = review'
  FROM public.customer_import_contact_candidates ct
  WHERE ct.batch_id = p_batch_id AND ct.import_action = 'review'

  UNION ALL

  SELECT 'gst_conflicts_existing', 'warning', COUNT(*), false, 'Import GST matches different existing company'
  FROM public.v_customer_import_gst_match_existing m
  WHERE m.batch_id = p_batch_id AND m.match_outcome = 'conflict_existing_gst'

  UNION ALL

  SELECT 'duplicate_review_pending', 'error', COUNT(*), true, 'Duplicate review rows still pending'
  FROM public.customer_import_duplicate_review d
  WHERE d.batch_id = p_batch_id AND d.resolution_status = 'pending'

  UNION ALL

  SELECT 'owner_unresolved', 'warning', COUNT(*), false, 'Company rows with unresolved owner placeholder'
  FROM public.v_customer_import_owner_placeholder o
  WHERE o.batch_id = p_batch_id AND o.owner_resolution_status LIKE 'unresolved%';
END;
$$;

REVOKE ALL ON FUNCTION public.run_customer_import_validation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_customer_import_validation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_customer_import_validation(uuid) TO authenticated;

COMMENT ON FUNCTION public.run_customer_import_validation IS
  'Sprint 9.5 read-only validation summary for a customer import batch. Internal staff only; does not mutate master data.';

-- =============================================================================
-- M. Verification queries (manual / fixture checks)
-- =============================================================================
-- 1) Duplicate alignment must expose group size, not 0/1:
--    SELECT duplicate_type, workbook_count, computed_candidate_count
--    FROM public.v_customer_import_duplicate_review_alignment
--    WHERE batch_id = '<batch_id>' AND computed_candidate_count IS DISTINCT FROM workbook_count;
--
-- 2) Promotion gate must agree with validation errors (expect safe_for_staging_promotion_review = false):
--    SELECT * FROM public.v_customer_import_promotion_readiness WHERE batch_id = '<batch_id>';
--
-- 3) Missing batch must block (expect single row, row_count = 1, is_blocking = true):
--    SELECT * FROM public.run_customer_import_validation('00000000-0000-0000-0000-000000000000'::uuid);
--
-- 4) Resolved duplicate review with losers marked skip must clear duplicate gates:
--    UPDATE customer_import_company_candidates SET import_action = 'skip' WHERE ...;
--    SELECT safe_for_staging_promotion_review FROM v_customer_import_promotion_readiness WHERE batch_id = '...';
