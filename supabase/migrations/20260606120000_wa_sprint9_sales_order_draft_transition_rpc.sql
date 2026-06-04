-- Sprint 9: Atomic sales order draft status transition + audit (staging first — production NOT authorized)
-- Ensures status change and audit log insert succeed or fail together.

CREATE OR REPLACE FUNCTION public.transition_sales_order_draft_status(
  p_draft_id uuid,
  p_expected_status text,
  p_next_status text,
  p_action text,
  p_actor_id uuid,
  p_actor_name text,
  p_review_notes text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL,
  p_approver_id uuid DEFAULT NULL,
  p_approver_name text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_whatsapp_inbox_reader(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to transition sales order drafts';
  END IF;

  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor id must match authenticated user';
  END IF;

  UPDATE public.sales_order_drafts
  SET
    status = p_next_status,
    updated_by = p_actor_id,
    review_notes = COALESCE(p_review_notes, review_notes),
    rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
    approver_id = COALESCE(p_approver_id, approver_id),
    approver_name = COALESCE(p_approver_name, approver_name)
  WHERE id = p_draft_id
    AND status = p_expected_status
  RETURNING id INTO v_draft_id;

  IF v_draft_id IS NULL THEN
    RAISE EXCEPTION 'Concurrent or stale transition: draft is no longer %', p_expected_status;
  END IF;

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
    p_action,
    p_expected_status,
    p_next_status,
    p_actor_id,
    p_actor_name,
    p_metadata
  );

  RETURN v_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_sales_order_draft_status(
  uuid, text, text, text, uuid, text, text, text, uuid, text, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.transition_sales_order_draft_status(
  uuid, text, text, text, uuid, text, text, text, uuid, text, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.transition_sales_order_draft_status IS
  'Atomically transitions sales_order_drafts status and appends audit log row.';
