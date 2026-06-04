-- Sprint 9: Server-side extraction version + persisted readiness enforcement on approve
-- staging first — production NOT authorized

DROP FUNCTION IF EXISTS public.approve_sales_order_draft_for_so_atomic(
  uuid, uuid, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.approve_sales_order_draft_for_so_atomic(
  p_draft_id uuid,
  p_expected_extraction_request_key text,
  p_actor_id uuid,
  p_actor_name text,
  p_review_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_extraction_request_key text;
  v_readiness_dimensions jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_whatsapp_inbox_reader(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to approve sales order drafts';
  END IF;

  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor id must match authenticated user';
  END IF;

  IF NULLIF(trim(p_expected_extraction_request_key), '') IS NULL THEN
    RAISE EXCEPTION 'Expected extraction request key is required';
  END IF;

  SELECT d.status, d.extraction_request_key, d.readiness_dimensions
  INTO v_status, v_extraction_request_key, v_readiness_dimensions
  FROM public.sales_order_drafts d
  WHERE d.id = p_draft_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Sales order draft not found';
  END IF;

  IF v_status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION 'Approve for SO only allowed from UNDER_REVIEW, currently %', v_status;
  END IF;

  IF NULLIF(trim(v_extraction_request_key), '') IS NULL THEN
    RAISE EXCEPTION 'Draft extraction request key is missing';
  END IF;

  IF v_extraction_request_key IS DISTINCT FROM trim(p_expected_extraction_request_key) THEN
    RAISE EXCEPTION 'Extraction version mismatch for draft %', p_draft_id;
  END IF;

  -- Server-owned readiness: validate persisted dimensions only (never client metadata).
  PERFORM public.validate_sales_order_draft_readiness(v_readiness_dimensions);

  UPDATE public.sales_order_drafts
  SET
    status = 'APPROVED_FOR_SO',
    approver_id = p_actor_id,
    approver_name = p_actor_name,
    review_notes = COALESCE(p_review_notes, review_notes),
    updated_by = p_actor_id
  WHERE id = p_draft_id;

  INSERT INTO public.sales_order_draft_audit_log (
    draft_id,
    action,
    from_status,
    to_status,
    actor_id,
    actor_name,
    metadata
  ) VALUES (
    p_draft_id,
    'APPROVE',
    'UNDER_REVIEW',
    'APPROVED_FOR_SO',
    p_actor_id,
    p_actor_name,
    p_metadata
  );

  RETURN p_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_sales_order_draft_for_so_atomic(
  uuid, text, uuid, text, text, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.approve_sales_order_draft_for_so_atomic(
  uuid, text, uuid, text, text, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.approve_sales_order_draft_for_so_atomic IS
  'Atomically validates extraction version and persisted readiness, approves draft for SO, and appends audit row.';
