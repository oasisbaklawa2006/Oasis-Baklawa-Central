-- Phase 2D/2E: Governed Sales Order Draft → live order promotion + observability.
-- Phase 2D: Atomic human-triggered promotion RPC (APPROVED_FOR_SO only).
-- Phase 2E: Append-only promotion lineage + operator observability views.
-- Staging first — production apply requires explicit deployment sign-off.

-- =============================================================================
-- Phase 2E — promotion lineage (append-only observability)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_order_draft_promotion_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.sales_order_drafts (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  packet_id uuid NOT NULL,
  extraction_request_key text NOT NULL,
  company_id uuid NULL,
  promotion_type text NOT NULL DEFAULT 'manual_promote'
    CHECK (promotion_type IN ('manual_promote', 'idempotent_replay')),
  line_count integer NOT NULL DEFAULT 0,
  actor_id uuid NULL,
  actor_name text NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sod_promotion_lineage_draft
  ON public.sales_order_draft_promotion_lineage (draft_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sod_promotion_lineage_order
  ON public.sales_order_draft_promotion_lineage (order_id);

CREATE INDEX IF NOT EXISTS idx_sod_promotion_lineage_correlation
  ON public.sales_order_draft_promotion_lineage (correlation_id);

CREATE OR REPLACE FUNCTION public.sales_order_draft_promotion_lineage_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'sales_order_draft_promotion_lineage is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_sod_promotion_lineage_no_update ON public.sales_order_draft_promotion_lineage;
CREATE TRIGGER trg_sod_promotion_lineage_no_update
  BEFORE UPDATE ON public.sales_order_draft_promotion_lineage
  FOR EACH ROW EXECUTE FUNCTION public.sales_order_draft_promotion_lineage_immutable();

DROP TRIGGER IF EXISTS trg_sod_promotion_lineage_no_delete ON public.sales_order_draft_promotion_lineage;
CREATE TRIGGER trg_sod_promotion_lineage_no_delete
  BEFORE DELETE ON public.sales_order_draft_promotion_lineage
  FOR EACH ROW EXECUTE FUNCTION public.sales_order_draft_promotion_lineage_immutable();

ALTER TABLE public.sales_order_draft_promotion_lineage ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE, DELETE ON public.sales_order_draft_promotion_lineage FROM authenticated;
REVOKE UPDATE, DELETE ON public.sales_order_draft_promotion_lineage FROM anon;

DROP POLICY IF EXISTS sod_promotion_lineage_service_role ON public.sales_order_draft_promotion_lineage;
CREATE POLICY sod_promotion_lineage_service_role
  ON public.sales_order_draft_promotion_lineage FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sod_promotion_lineage_inbox_reader_select ON public.sales_order_draft_promotion_lineage;
CREATE POLICY sod_promotion_lineage_inbox_reader_select
  ON public.sales_order_draft_promotion_lineage FOR SELECT TO authenticated
  USING (public.is_whatsapp_inbox_reader(auth.uid()));

DROP POLICY IF EXISTS sod_promotion_lineage_inbox_reader_insert ON public.sales_order_draft_promotion_lineage;
CREATE POLICY sod_promotion_lineage_inbox_reader_insert
  ON public.sales_order_draft_promotion_lineage FOR INSERT TO authenticated
  WITH CHECK (public.is_whatsapp_inbox_reader(auth.uid()));

COMMENT ON TABLE public.sales_order_draft_promotion_lineage IS
  'Phase 2E: Append-only lineage for governed sales order draft → order promotions.';

-- =============================================================================
-- Phase 2E — observability views
-- =============================================================================
CREATE OR REPLACE VIEW public.v_sales_order_draft_promotion_queue AS
SELECT
  d.id AS draft_id,
  d.packet_id,
  d.extraction_request_key,
  d.company_id,
  d.company_name,
  d.status,
  d.approver_id,
  d.approver_name,
  d.readiness_overall_score,
  d.promoted_order_id,
  d.created_at,
  d.updated_at,
  COUNT(l.id) FILTER (
    WHERE l.product_id IS NOT NULL
      AND COALESCE(l.operator_quantity, l.normalized_quantity, l.raw_quantity, 0) > 0
  ) AS promotable_line_count
FROM public.sales_order_drafts d
LEFT JOIN public.sales_order_draft_lines l ON l.draft_id = d.id
WHERE d.status = 'APPROVED_FOR_SO'
  AND d.promoted_order_id IS NULL
GROUP BY d.id;

CREATE OR REPLACE VIEW public.v_sales_order_draft_promotion_history AS
SELECT
  pl.id AS lineage_id,
  pl.draft_id,
  pl.order_id,
  pl.packet_id,
  pl.extraction_request_key,
  pl.company_id,
  pl.promotion_type,
  pl.line_count,
  pl.actor_id,
  pl.actor_name,
  pl.correlation_id,
  pl.metadata,
  pl.created_at AS promoted_at,
  d.status AS draft_status,
  d.company_name,
  o.order_number,
  o.status AS order_status
FROM public.sales_order_draft_promotion_lineage pl
JOIN public.sales_order_drafts d ON d.id = pl.draft_id
LEFT JOIN public.orders o ON o.id = pl.order_id;

COMMENT ON VIEW public.v_sales_order_draft_promotion_queue IS
  'Phase 2E: APPROVED_FOR_SO drafts awaiting human promotion to live orders.';

COMMENT ON VIEW public.v_sales_order_draft_promotion_history IS
  'Phase 2E: Promotion lineage joined to draft header and live order reference.';

-- =============================================================================
-- Phase 2D — atomic promotion RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.promote_sales_order_draft_to_order_atomic(
  p_draft_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.sales_order_drafts%ROWTYPE;
  v_order_id uuid;
  v_line_count integer := 0;
  v_total_weight numeric := 0;
  v_min_confidence numeric := 1;
  v_correlation_id text;
  v_line record;
  v_qty numeric;
  v_weight numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_whatsapp_inbox_reader(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to promote sales order drafts';
  END IF;

  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor id must match authenticated user';
  END IF;

  SELECT *
  INTO v_draft
  FROM public.sales_order_drafts d
  WHERE d.id = p_draft_id
  FOR UPDATE;

  IF v_draft.id IS NULL THEN
    RAISE EXCEPTION 'Sales order draft not found';
  END IF;

  IF v_draft.promoted_order_id IS NOT NULL THEN
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
      'PROMOTE_IDEMPOTENT',
      v_draft.status,
      v_draft.status,
      p_actor_id,
      p_actor_name,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'orderId', v_draft.promoted_order_id,
        'idempotent', true
      )
    );

    RETURN v_draft.promoted_order_id;
  END IF;

  IF v_draft.status <> 'APPROVED_FOR_SO' THEN
    RAISE EXCEPTION 'Promotion only allowed from APPROVED_FOR_SO, currently %', v_draft.status;
  END IF;

  IF v_draft.company_id IS NULL THEN
    RAISE EXCEPTION 'Draft company_id is required before promotion';
  END IF;

  PERFORM public.validate_sales_order_draft_readiness(v_draft.readiness_dimensions);

  SELECT COUNT(*)
  INTO v_line_count
  FROM public.sales_order_draft_lines l
  WHERE l.draft_id = p_draft_id
    AND l.product_id IS NOT NULL
    AND COALESCE(l.operator_quantity, l.normalized_quantity, l.raw_quantity, 0) > 0;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'At least one promotable line with product_id and quantity is required';
  END IF;

  v_correlation_id := COALESCE(
    NULLIF(p_metadata->>'correlationId', ''),
    v_draft.extraction_request_key,
    p_draft_id::text
  );

  INSERT INTO public.orders (
    company_id,
    status,
    dispatch_urgency,
    tracking_token,
    parser_confidence,
    needs_clarification,
    is_duplicate
  ) VALUES (
    v_draft.company_id,
    'draft',
    'standard',
    encode(gen_random_bytes(16), 'hex'),
    NULL,
    false,
    false
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN
    SELECT
      l.product_id,
      l.product_name,
      l.operator_quantity,
      l.normalized_quantity,
      l.normalized_unit,
      l.raw_quantity,
      l.product_confidence,
      l.quantity_confidence,
      p.weight_per_box_kg,
      p.grams_per_piece,
      p.category
    FROM public.sales_order_draft_lines l
    LEFT JOIN public.products p ON p.id = l.product_id
    WHERE l.draft_id = p_draft_id
      AND l.product_id IS NOT NULL
    ORDER BY l.line_index
  LOOP
    v_qty := COALESCE(v_line.operator_quantity, v_line.normalized_quantity, v_line.raw_quantity, 0);
    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_weight := NULL;
    IF v_line.weight_per_box_kg IS NOT NULL AND v_line.normalized_unit ILIKE 'box%' THEN
      v_weight := v_qty * v_line.weight_per_box_kg;
    ELSIF v_line.grams_per_piece IS NOT NULL AND v_line.normalized_unit ILIKE 'pc%' THEN
      v_weight := (v_qty * v_line.grams_per_piece) / 1000;
    ELSIF v_line.normalized_unit ILIKE 'kg%' THEN
      v_weight := v_qty;
    END IF;

    IF v_weight IS NOT NULL AND v_weight > 0 THEN
      v_total_weight := v_total_weight + v_weight;
    END IF;

    IF v_line.product_confidence IS NOT NULL THEN
      v_min_confidence := LEAST(v_min_confidence, v_line.product_confidence);
    END IF;
    IF v_line.quantity_confidence IS NOT NULL THEN
      v_min_confidence := LEAST(v_min_confidence, v_line.quantity_confidence);
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      weight_kg,
      notes
    ) VALUES (
      v_order_id,
      v_line.product_id,
      v_qty,
      v_weight,
      left(COALESCE(v_line.product_name, ''), 200)
    );
  END LOOP;

  UPDATE public.orders
  SET
    total_weight_kg = NULLIF(v_total_weight, 0),
    parser_confidence = CASE WHEN v_min_confidence < 1 THEN v_min_confidence ELSE NULL END
  WHERE id = v_order_id;

  UPDATE public.sales_order_drafts
  SET
    promoted_order_id = v_order_id,
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
    'PROMOTE',
    'APPROVED_FOR_SO',
    'APPROVED_FOR_SO',
    p_actor_id,
    p_actor_name,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'orderId', v_order_id,
      'lineCount', v_line_count,
      'correlationId', v_correlation_id
    )
  );

  INSERT INTO public.sales_order_draft_promotion_lineage (
    draft_id,
    order_id,
    packet_id,
    extraction_request_key,
    company_id,
    promotion_type,
    line_count,
    actor_id,
    actor_name,
    correlation_id,
    metadata
  ) VALUES (
    p_draft_id,
    v_order_id,
    v_draft.packet_id,
    v_draft.extraction_request_key,
    v_draft.company_id,
    'manual_promote',
    v_line_count,
    p_actor_id,
    p_actor_name,
    v_correlation_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_sales_order_draft_to_order_atomic(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_sales_order_draft_to_order_atomic(uuid, uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.promote_sales_order_draft_to_order_atomic IS
  'Phase 2D: Atomically promotes APPROVED_FOR_SO draft to live orders + order_items; idempotent when promoted_order_id is set.';
