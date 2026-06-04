-- Sprint 9: Atomic approve/reject + server-side readiness validation
-- staging first — production NOT authorized

CREATE OR REPLACE FUNCTION public.validate_sales_order_draft_readiness(p_dimensions jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key text;
  v_dim jsonb;
  v_required text[] := ARRAY['client', 'product', 'quantity', 'address', 'payment_terms'];
  v_min_score constant integer := 40;
BEGIN
  FOREACH v_key IN ARRAY v_required
  LOOP
    SELECT elem
    INTO v_dim
    FROM jsonb_array_elements(COALESCE(p_dimensions, '[]'::jsonb)) AS elem
    WHERE elem->>'dimension' = v_key
    LIMIT 1;

    IF v_dim IS NULL THEN
      RAISE EXCEPTION 'Missing readiness dimension: %', v_key;
    END IF;

    IF COALESCE(v_dim->>'status', 'missing') = 'missing'
      OR COALESCE((v_dim->>'score')::integer, 0) < v_min_score THEN
      RAISE EXCEPTION '% is not ready (% — %)', v_key, v_dim->>'score', v_dim->>'status';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_sales_order_draft_for_so_atomic(
  p_draft_id uuid,
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
  v_readiness_dimensions jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_whatsapp_inbox_reader(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to approve sales order drafts';
  END IF;

  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor id must match authenticated user';
  END IF;

  SELECT d.status, d.readiness_dimensions
  INTO v_status, v_readiness_dimensions
  FROM public.sales_order_drafts d
  WHERE d.id = p_draft_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Sales order draft not found';
  END IF;

  IF v_status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION 'Approve for SO only allowed from UNDER_REVIEW, currently %', v_status;
  END IF;

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

CREATE OR REPLACE FUNCTION public.reject_sales_order_draft_atomic(
  p_draft_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_rejection_reason text,
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
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_whatsapp_inbox_reader(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to reject sales order drafts';
  END IF;

  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor id must match authenticated user';
  END IF;

  IF NULLIF(trim(p_rejection_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT d.status
  INTO v_status
  FROM public.sales_order_drafts d
  WHERE d.id = p_draft_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Sales order draft not found';
  END IF;

  IF v_status NOT IN ('AI_DRAFT', 'UNDER_REVIEW') THEN
    RAISE EXCEPTION 'Reject not allowed from terminal status %', v_status;
  END IF;

  UPDATE public.sales_order_drafts
  SET
    status = 'REJECTED',
    rejection_reason = trim(p_rejection_reason),
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
    'REJECT',
    v_status,
    'REJECTED',
    p_actor_id,
    p_actor_name,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('rejectionReason', trim(p_rejection_reason))
  );

  RETURN p_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_sales_order_draft_readiness(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_sales_order_draft_readiness(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_sales_order_draft_for_so_atomic(uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sales_order_draft_for_so_atomic(uuid, uuid, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_sales_order_draft_atomic(uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_sales_order_draft_atomic(uuid, uuid, text, text, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.validate_sales_order_draft_readiness IS
  'Validates all five readiness dimensions meet minimum approval threshold.';

COMMENT ON FUNCTION public.approve_sales_order_draft_for_so_atomic IS
  'Atomically validates readiness, approves draft for SO, and appends audit row.';

COMMENT ON FUNCTION public.reject_sales_order_draft_atomic IS
  'Atomically rejects draft with reason and appends audit row.';
