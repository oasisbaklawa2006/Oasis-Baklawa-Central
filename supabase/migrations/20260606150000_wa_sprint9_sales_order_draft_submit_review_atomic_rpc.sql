-- Sprint 9: Atomic submit-for-review (operator sync + AI_DRAFT -> UNDER_REVIEW + audit)
-- staging first — production NOT authorized

CREATE OR REPLACE FUNCTION public.submit_sales_order_draft_for_review_atomic(
  p_draft_id uuid,
  p_operator_final_snapshot jsonb,
  p_readiness_overall_score integer,
  p_readiness_dimensions jsonb,
  p_lines jsonb,
  p_actor_id uuid,
  p_actor_name text,
  p_audit_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_line jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_whatsapp_inbox_reader(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to submit sales order drafts';
  END IF;

  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor id must match authenticated user';
  END IF;

  SELECT d.status
  INTO v_status
  FROM public.sales_order_drafts d
  WHERE d.id = p_draft_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Sales order draft not found';
  END IF;

  IF v_status <> 'AI_DRAFT' THEN
    RAISE EXCEPTION 'Submit for review only allowed from AI_DRAFT, currently %', v_status;
  END IF;

  UPDATE public.sales_order_drafts
  SET
    operator_final_snapshot = COALESCE(p_operator_final_snapshot, '{}'::jsonb),
    readiness_overall_score = COALESCE(p_readiness_overall_score, 0),
    readiness_dimensions = COALESCE(p_readiness_dimensions, '[]'::jsonb),
    status = 'UNDER_REVIEW',
    updated_by = p_actor_id
  WHERE id = p_draft_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    UPDATE public.sales_order_draft_lines
    SET
      operator_quantity = NULLIF(v_line->>'operator_quantity', '')::numeric,
      operator_line_snapshot = COALESCE(v_line->'operator_line_snapshot', '{}'::jsonb)
    WHERE draft_id = p_draft_id
      AND line_index = (v_line->>'line_index')::integer;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Draft line % not found for draft %', v_line->>'line_index', p_draft_id;
    END IF;
  END LOOP;

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
    'SUBMIT_REVIEW',
    'AI_DRAFT',
    'UNDER_REVIEW',
    p_actor_id,
    p_actor_name,
    p_audit_metadata
  );

  RETURN p_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_sales_order_draft_for_review_atomic(
  uuid, jsonb, integer, jsonb, jsonb, uuid, text, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_sales_order_draft_for_review_atomic(
  uuid, jsonb, integer, jsonb, jsonb, uuid, text, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.submit_sales_order_draft_for_review_atomic IS
  'Atomically syncs operator final, transitions AI_DRAFT to UNDER_REVIEW, and appends audit.';
