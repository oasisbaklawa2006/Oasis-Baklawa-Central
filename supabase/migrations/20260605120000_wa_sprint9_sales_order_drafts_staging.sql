-- WA Sprint 9: Sales Order Draft persistence (staging first — production NOT authorized)
-- Controlled handoff from WhatsApp draft extraction → reviewable sales_order_drafts.
-- Explicitly does NOT create live orders, production allocation, dispatch, finance, or invoices.

-- =============================================================================
-- 1. sales_order_drafts (header)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL,
  extraction_request_key text NOT NULL,
  status text NOT NULL DEFAULT 'AI_DRAFT'
    CHECK (status IN ('AI_DRAFT', 'UNDER_REVIEW', 'APPROVED_FOR_SO', 'REJECTED')),

  -- Governance slots (preserved from WA extraction; approver set on human approval)
  client_owner_id uuid NULL,
  client_owner_name text NULL,
  order_creator_id uuid NULL,
  order_creator_name text NULL,
  order_handler_id uuid NULL,
  order_handler_name text NULL,
  approver_id uuid NULL,
  approver_name text NULL,

  -- Client projection
  company_id uuid NULL,
  company_name text NULL,

  -- Readiness snapshot at last material change
  readiness_overall_score integer NOT NULL DEFAULT 0,
  readiness_dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Three-way comparison snapshots (immutable originals + operator final)
  original_whatsapp_text text NOT NULL DEFAULT '',
  ai_draft_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  operator_final_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Workflow metadata
  review_notes text NULL,
  rejection_reason text NULL,
  promoted_order_id uuid NULL,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_order_drafts_packet
  ON public.sales_order_drafts (packet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_order_drafts_status
  ON public.sales_order_drafts (status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_order_drafts_packet_active
  ON public.sales_order_drafts (packet_id)
  WHERE status IN ('AI_DRAFT', 'UNDER_REVIEW', 'APPROVED_FOR_SO');

-- =============================================================================
-- 2. sales_order_draft_lines
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_order_draft_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.sales_order_drafts (id) ON DELETE CASCADE,
  line_index integer NOT NULL,
  product_id uuid NULL,
  product_name text NOT NULL DEFAULT '',
  sku text NULL,
  raw_quantity numeric NOT NULL DEFAULT 0,
  raw_unit text NULL,
  normalized_quantity numeric NULL,
  normalized_unit text NULL,
  operator_quantity numeric NULL,
  original_text_span text NULL,
  conversion_explanation text NULL,
  product_confidence numeric NULL,
  quantity_confidence numeric NULL,
  ai_line_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  operator_line_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_order_draft_lines_draft_line_unique UNIQUE (draft_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_sales_order_draft_lines_draft
  ON public.sales_order_draft_lines (draft_id, line_index);

-- =============================================================================
-- 3. sales_order_draft_audit_log (append-only)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_order_draft_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.sales_order_drafts (id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text NULL,
  to_status text NULL,
  actor_id uuid NULL,
  actor_name text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_order_draft_audit_draft
  ON public.sales_order_draft_audit_log (draft_id, created_at DESC);

-- =============================================================================
-- 4. Foreign keys (conditional — skip if orphans or missing parents)
-- =============================================================================
DO $$
DECLARE
  rel_drafts constant oid := 'public.sales_order_drafts'::regclass::oid;
  orphan_count bigint;
BEGIN
  IF to_regclass('public.whatsapp_message_packets') IS NULL THEN
    RAISE NOTICE 'Skipping sales_order_drafts_packet_id_fkey: whatsapp_message_packets missing';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = rel_drafts AND c.conname = 'sales_order_drafts_packet_id_fkey'
  ) THEN
    SELECT COUNT(*) INTO orphan_count
    FROM public.sales_order_drafts d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.whatsapp_message_packets p WHERE p.id = d.packet_id
    );
    IF orphan_count = 0 THEN
      ALTER TABLE public.sales_order_drafts
        ADD CONSTRAINT sales_order_drafts_packet_id_fkey
        FOREIGN KEY (packet_id) REFERENCES public.whatsapp_message_packets (id) ON DELETE CASCADE;
    ELSE
      RAISE NOTICE 'Skipping sales_order_drafts_packet_id_fkey: % orphan row(s)', orphan_count;
    END IF;
  END IF;

  IF to_regclass('public.companies') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = rel_drafts AND c.conname = 'sales_order_drafts_company_id_fkey'
     ) THEN
    ALTER TABLE public.sales_order_drafts
      ADD CONSTRAINT sales_order_drafts_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.orders') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = rel_drafts AND c.conname = 'sales_order_drafts_promoted_order_id_fkey'
     ) THEN
    ALTER TABLE public.sales_order_drafts
      ADD CONSTRAINT sales_order_drafts_promoted_order_id_fkey
      FOREIGN KEY (promoted_order_id) REFERENCES public.orders (id) ON DELETE SET NULL;
  END IF;
END $$;

-- =============================================================================
-- 5. updated_at triggers
-- =============================================================================
DROP TRIGGER IF EXISTS trg_sales_order_drafts_touch ON public.sales_order_drafts;
CREATE TRIGGER trg_sales_order_drafts_touch
  BEFORE UPDATE ON public.sales_order_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_sales_order_draft_lines_touch ON public.sales_order_draft_lines;
CREATE TRIGGER trg_sales_order_draft_lines_touch
  BEFORE UPDATE ON public.sales_order_draft_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- 5b. Immutable field guard (post-create governance + original snapshots)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_sales_order_draft_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.original_whatsapp_text IS DISTINCT FROM OLD.original_whatsapp_text THEN
    RAISE EXCEPTION 'sales_order_drafts.original_whatsapp_text is immutable after create';
  END IF;

  IF NEW.ai_draft_snapshot IS DISTINCT FROM OLD.ai_draft_snapshot THEN
    RAISE EXCEPTION 'sales_order_drafts.ai_draft_snapshot is immutable after create';
  END IF;

  IF NEW.client_owner_id IS DISTINCT FROM OLD.client_owner_id THEN
    RAISE EXCEPTION 'sales_order_drafts.client_owner_id is immutable after create';
  END IF;

  IF NEW.client_owner_name IS DISTINCT FROM OLD.client_owner_name THEN
    RAISE EXCEPTION 'sales_order_drafts.client_owner_name is immutable after create';
  END IF;

  IF NEW.order_creator_id IS DISTINCT FROM OLD.order_creator_id THEN
    RAISE EXCEPTION 'sales_order_drafts.order_creator_id is immutable after create';
  END IF;

  IF NEW.order_creator_name IS DISTINCT FROM OLD.order_creator_name THEN
    RAISE EXCEPTION 'sales_order_drafts.order_creator_name is immutable after create';
  END IF;

  IF NEW.order_handler_id IS DISTINCT FROM OLD.order_handler_id THEN
    RAISE EXCEPTION 'sales_order_drafts.order_handler_id is immutable after create';
  END IF;

  IF NEW.order_handler_name IS DISTINCT FROM OLD.order_handler_name THEN
    RAISE EXCEPTION 'sales_order_drafts.order_handler_name is immutable after create';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_order_drafts_immutable_fields ON public.sales_order_drafts;
CREATE TRIGGER trg_sales_order_drafts_immutable_fields
  BEFORE UPDATE ON public.sales_order_drafts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sales_order_draft_immutable_fields();

-- =============================================================================
-- 6. RLS — inbox readers may manage drafts; no DELETE; audit log insert-only
-- =============================================================================
ALTER TABLE public.sales_order_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_draft_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_draft_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_order_drafts_service_role ON public.sales_order_drafts;
CREATE POLICY sales_order_drafts_service_role
  ON public.sales_order_drafts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_order_drafts_inbox_reader_select ON public.sales_order_drafts;
CREATE POLICY sales_order_drafts_inbox_reader_select
  ON public.sales_order_drafts FOR SELECT TO authenticated
  USING (public.is_whatsapp_inbox_reader(auth.uid()));

DROP POLICY IF EXISTS sales_order_drafts_inbox_reader_insert ON public.sales_order_drafts;
CREATE POLICY sales_order_drafts_inbox_reader_insert
  ON public.sales_order_drafts FOR INSERT TO authenticated
  WITH CHECK (public.is_whatsapp_inbox_reader(auth.uid()));

DROP POLICY IF EXISTS sales_order_drafts_inbox_reader_update ON public.sales_order_drafts;
CREATE POLICY sales_order_drafts_inbox_reader_update
  ON public.sales_order_drafts FOR UPDATE TO authenticated
  USING (public.is_whatsapp_inbox_reader(auth.uid()))
  WITH CHECK (public.is_whatsapp_inbox_reader(auth.uid()));

DROP POLICY IF EXISTS sales_order_draft_lines_service_role ON public.sales_order_draft_lines;
CREATE POLICY sales_order_draft_lines_service_role
  ON public.sales_order_draft_lines FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_order_draft_lines_inbox_reader_select ON public.sales_order_draft_lines;
CREATE POLICY sales_order_draft_lines_inbox_reader_select
  ON public.sales_order_draft_lines FOR SELECT TO authenticated
  USING (
    public.is_whatsapp_inbox_reader(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.sales_order_drafts d
      WHERE d.id = sales_order_draft_lines.draft_id
    )
  );

DROP POLICY IF EXISTS sales_order_draft_lines_inbox_reader_insert ON public.sales_order_draft_lines;
CREATE POLICY sales_order_draft_lines_inbox_reader_insert
  ON public.sales_order_draft_lines FOR INSERT TO authenticated
  WITH CHECK (
    public.is_whatsapp_inbox_reader(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.sales_order_drafts d
      WHERE d.id = sales_order_draft_lines.draft_id
    )
  );

DROP POLICY IF EXISTS sales_order_draft_lines_inbox_reader_update ON public.sales_order_draft_lines;
CREATE POLICY sales_order_draft_lines_inbox_reader_update
  ON public.sales_order_draft_lines FOR UPDATE TO authenticated
  USING (
    public.is_whatsapp_inbox_reader(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.sales_order_drafts d
      WHERE d.id = sales_order_draft_lines.draft_id
    )
  )
  WITH CHECK (
    public.is_whatsapp_inbox_reader(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.sales_order_drafts d
      WHERE d.id = sales_order_draft_lines.draft_id
    )
  );

DROP POLICY IF EXISTS sales_order_draft_audit_service_role ON public.sales_order_draft_audit_log;
CREATE POLICY sales_order_draft_audit_service_role
  ON public.sales_order_draft_audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_order_draft_audit_inbox_reader_select ON public.sales_order_draft_audit_log;
CREATE POLICY sales_order_draft_audit_inbox_reader_select
  ON public.sales_order_draft_audit_log FOR SELECT TO authenticated
  USING (public.is_whatsapp_inbox_reader(auth.uid()));

DROP POLICY IF EXISTS sales_order_draft_audit_inbox_reader_insert ON public.sales_order_draft_audit_log;
CREATE POLICY sales_order_draft_audit_inbox_reader_insert
  ON public.sales_order_draft_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_whatsapp_inbox_reader(auth.uid()));

COMMENT ON TABLE public.sales_order_drafts IS
  'Sprint 9: Reviewable Sales Order Drafts from WhatsApp extraction. Does NOT create live orders.';

COMMENT ON TABLE public.sales_order_draft_audit_log IS
  'Append-only audit trail for sales order draft workflow transitions.';
