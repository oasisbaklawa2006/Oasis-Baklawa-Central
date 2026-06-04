-- Sprint 9: Atomic sales order draft create (header + lines + audit)
-- staging first — production NOT authorized

CREATE OR REPLACE FUNCTION public.create_sales_order_draft_atomic(
  p_header jsonb,
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
  v_packet_id uuid;
  v_draft_id uuid;
  v_line jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_whatsapp_inbox_reader(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to create sales order drafts';
  END IF;

  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor id must match authenticated user';
  END IF;

  v_packet_id := (p_header->>'packet_id')::uuid;

  IF EXISTS (
    SELECT 1
    FROM public.sales_order_drafts d
    WHERE d.packet_id = v_packet_id
      AND d.status <> 'REJECTED'
  ) THEN
    RAISE EXCEPTION 'Active sales order draft already exists for packet';
  END IF;

  INSERT INTO public.sales_order_drafts (
    packet_id,
    extraction_request_key,
    status,
    client_owner_id,
    client_owner_name,
    order_creator_id,
    order_creator_name,
    order_handler_id,
    order_handler_name,
    approver_id,
    approver_name,
    company_id,
    company_name,
    readiness_overall_score,
    readiness_dimensions,
    original_whatsapp_text,
    ai_draft_snapshot,
    operator_final_snapshot,
    created_by,
    updated_by
  ) VALUES (
    v_packet_id,
    p_header->>'extraction_request_key',
    COALESCE(p_header->>'status', 'AI_DRAFT'),
    NULLIF(p_header->>'client_owner_id', '')::uuid,
    p_header->>'client_owner_name',
    NULLIF(p_header->>'order_creator_id', '')::uuid,
    p_header->>'order_creator_name',
    NULLIF(p_header->>'order_handler_id', '')::uuid,
    p_header->>'order_handler_name',
    NULLIF(p_header->>'approver_id', '')::uuid,
    p_header->>'approver_name',
    NULLIF(p_header->>'company_id', '')::uuid,
    p_header->>'company_name',
    COALESCE((p_header->>'readiness_overall_score')::integer, 0),
    COALESCE(p_header->'readiness_dimensions', '[]'::jsonb),
    COALESCE(p_header->>'original_whatsapp_text', ''),
    COALESCE(p_header->'ai_draft_snapshot', '{}'::jsonb),
    COALESCE(p_header->'operator_final_snapshot', '{}'::jsonb),
    p_actor_id,
    p_actor_id
  )
  RETURNING id INTO v_draft_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    INSERT INTO public.sales_order_draft_lines (
      draft_id,
      line_index,
      product_id,
      product_name,
      sku,
      raw_quantity,
      raw_unit,
      normalized_quantity,
      normalized_unit,
      operator_quantity,
      original_text_span,
      conversion_explanation,
      product_confidence,
      quantity_confidence,
      ai_line_snapshot,
      operator_line_snapshot
    ) VALUES (
      v_draft_id,
      (v_line->>'line_index')::integer,
      NULLIF(v_line->>'product_id', '')::uuid,
      COALESCE(v_line->>'product_name', ''),
      v_line->>'sku',
      COALESCE((v_line->>'raw_quantity')::numeric, 0),
      v_line->>'raw_unit',
      NULLIF(v_line->>'normalized_quantity', '')::numeric,
      v_line->>'normalized_unit',
      NULLIF(v_line->>'operator_quantity', '')::numeric,
      v_line->>'original_text_span',
      v_line->>'conversion_explanation',
      NULLIF(v_line->>'product_confidence', '')::numeric,
      NULLIF(v_line->>'quantity_confidence', '')::numeric,
      COALESCE(v_line->'ai_line_snapshot', '{}'::jsonb),
      COALESCE(v_line->'operator_line_snapshot', '{}'::jsonb)
    );
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
    v_draft_id,
    'CREATE',
    NULL,
    'AI_DRAFT',
    p_actor_id,
    p_actor_name,
    p_audit_metadata
  );

  RETURN v_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sales_order_draft_atomic(jsonb, jsonb, uuid, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_sales_order_draft_atomic(jsonb, jsonb, uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_sales_order_draft_atomic IS
  'Atomically creates sales_order_drafts header, lines, and CREATE audit row.';
