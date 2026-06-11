-- PR06C1b: Catalogue draft tables reconciliation + packaging product mapping FK
--
-- Context:
--   - catalogue_tag_drafts, catalogue_alias_drafts, and the four approve/reject RPCs
--     are pre-existing on production (Central DB C1a objects, never exported to repo).
--   - This migration reconciles them into git history (idempotent: CREATE IF NOT EXISTS)
--     and adds source_mapping_id on catalogue_alias_drafts so the approve RPC can
--     enforce the approve_blocked_mapping_not_finalized guard for products that
--     originated from the AI Catalogue Builder (packaging / goldware / retail_pack).
--
-- Production target : tcxvcatsqqertcnycuop
-- Repo path         : supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql
-- Safe to re-run    : YES — all DDL is CREATE IF NOT EXISTS or guarded by pg_catalog checks
--
-- Objects touched (additive / idempotent only):
--   NEW TABLE   : public.catalogue_tag_drafts     (CREATE IF NOT EXISTS)
--   NEW TABLE   : public.catalogue_alias_drafts   (CREATE IF NOT EXISTS)
--   NEW COLUMN  : public.catalogue_alias_drafts.source_mapping_id  (ALTER IF NOT EXISTS column)
--   NEW INDEXES : idx_catalogue_tag_drafts_status,
--                 idx_catalogue_tag_drafts_target_record,
--                 idx_catalogue_alias_drafts_status,
--                 idx_catalogue_alias_drafts_source_mapping
--   RLS POLICIES: internal-staff SELECT + ALL on both draft tables
--
-- Objects NOT touched:
--   products, product_tags, product_aliases, catalogue_product_mappings,
--   orders/order_items, sales_order_drafts, Golden Chain tables,
--   approve_catalogue_*_draft / reject_catalogue_*_draft RPCs (already live on prod)

-- =============================================================================
-- 1. catalogue_tag_drafts  (C1a reconcile — idempotent)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.catalogue_tag_drafts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  operation       text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending_approval',
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  target_table    text        NOT NULL DEFAULT 'product_tags',
  target_record_id uuid       NULL,
  source_app      text        NOT NULL DEFAULT 'ai_catalogue_builder',
  submitted_by    uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  submitted_at    timestamptz NULL,
  reviewed_by     uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at     timestamptz NULL,
  review_notes    text        NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_tag_drafts_status_check CHECK (
    status IN ('pending_approval', 'approved', 'rejected', 'withdrawn')
  )
);

CREATE INDEX IF NOT EXISTS idx_catalogue_tag_drafts_status
  ON public.catalogue_tag_drafts (status, submitted_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_catalogue_tag_drafts_target_record
  ON public.catalogue_tag_drafts (target_record_id)
  WHERE target_record_id IS NOT NULL;

COMMENT ON TABLE public.catalogue_tag_drafts IS
  'C1a draft queue for product_tags insert/update/delete proposals. '
  'Approved via RPC approve_catalogue_tag_draft; rejected via reject_catalogue_tag_draft.';

-- =============================================================================
-- 2. catalogue_alias_drafts  (C1a reconcile — idempotent)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.catalogue_alias_drafts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  operation       text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending_approval',
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  target_table    text        NOT NULL DEFAULT 'product_aliases',
  target_record_id uuid       NULL,
  source_app      text        NOT NULL DEFAULT 'ai_catalogue_builder',
  -- PR06C1b packaging mapping FK:
  -- Links this alias draft to the catalogue_product_mappings row that produced it.
  -- When non-null, approve_catalogue_alias_draft checks sync_status = 'synced'
  -- before proceeding; otherwise returns approve_blocked_mapping_not_finalized.
  source_mapping_id uuid      NULL
    REFERENCES public.catalogue_product_mappings (id) ON DELETE SET NULL,
  submitted_by    uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  submitted_at    timestamptz NULL,
  reviewed_by     uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at     timestamptz NULL,
  review_notes    text        NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_alias_drafts_status_check CHECK (
    status IN ('pending_approval', 'approved', 'rejected', 'withdrawn')
  )
);

CREATE INDEX IF NOT EXISTS idx_catalogue_alias_drafts_status
  ON public.catalogue_alias_drafts (status, submitted_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_catalogue_alias_drafts_source_mapping
  ON public.catalogue_alias_drafts (source_mapping_id)
  WHERE source_mapping_id IS NOT NULL;

COMMENT ON TABLE public.catalogue_alias_drafts IS
  'C1a draft queue for product_aliases proposals. source_mapping_id (PR06C1b) enforces '
  'approve_blocked_mapping_not_finalized guard for connector-sourced packaging products.';

COMMENT ON COLUMN public.catalogue_alias_drafts.source_mapping_id IS
  'FK → catalogue_product_mappings.id. Null for drafts not linked to a connector '
  'mapping (e.g. manual curator drafts). When set, approve RPC must see sync_status = synced.';

-- =============================================================================
-- 3. Backfill source_mapping_id column if table already existed from C1a
--    and the column was not added in the CREATE TABLE above (idempotent guard).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'catalogue_alias_drafts'
      AND  column_name  = 'source_mapping_id'
  ) THEN
    ALTER TABLE public.catalogue_alias_drafts
      ADD COLUMN source_mapping_id uuid NULL
      REFERENCES public.catalogue_product_mappings (id) ON DELETE SET NULL;

    COMMENT ON COLUMN public.catalogue_alias_drafts.source_mapping_id IS
      'FK → catalogue_product_mappings.id. Null for drafts not linked to a connector '
      'mapping (e.g. manual curator drafts). When set, approve RPC must see sync_status = synced.';

    CREATE INDEX IF NOT EXISTS idx_catalogue_alias_drafts_source_mapping
      ON public.catalogue_alias_drafts (source_mapping_id)
      WHERE source_mapping_id IS NOT NULL;
  END IF;
END $$;

-- =============================================================================
-- 4. RLS — catalogue_tag_drafts
-- =============================================================================

ALTER TABLE public.catalogue_tag_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  schemaname = 'public'
      AND  tablename  = 'catalogue_tag_drafts'
      AND  policyname = 'catalogue_tag_drafts_select_internal'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY catalogue_tag_drafts_select_internal
        ON public.catalogue_tag_drafts
        FOR SELECT TO authenticated
        USING (public.is_internal_staff(auth.uid()))
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  schemaname = 'public'
      AND  tablename  = 'catalogue_tag_drafts'
      AND  policyname = 'catalogue_tag_drafts_write_internal'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY catalogue_tag_drafts_write_internal
        ON public.catalogue_tag_drafts
        FOR ALL TO authenticated
        USING (public.is_internal_staff(auth.uid()))
        WITH CHECK (public.is_internal_staff(auth.uid()))
    $pol$;
  END IF;
END $$;

-- =============================================================================
-- 5. RLS — catalogue_alias_drafts
-- =============================================================================

ALTER TABLE public.catalogue_alias_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  schemaname = 'public'
      AND  tablename  = 'catalogue_alias_drafts'
      AND  policyname = 'catalogue_alias_drafts_select_internal'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY catalogue_alias_drafts_select_internal
        ON public.catalogue_alias_drafts
        FOR SELECT TO authenticated
        USING (public.is_internal_staff(auth.uid()))
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  schemaname = 'public'
      AND  tablename  = 'catalogue_alias_drafts'
      AND  policyname = 'catalogue_alias_drafts_write_internal'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY catalogue_alias_drafts_write_internal
        ON public.catalogue_alias_drafts
        FOR ALL TO authenticated
        USING (public.is_internal_staff(auth.uid()))
        WITH CHECK (public.is_internal_staff(auth.uid()))
    $pol$;
  END IF;
END $$;

-- =============================================================================
-- 6. Grant baseline privileges (idempotent — GRANT does not error on re-run)
-- =============================================================================

GRANT SELECT ON public.catalogue_tag_drafts   TO authenticated;
GRANT SELECT ON public.catalogue_alias_drafts TO authenticated;

GRANT ALL    ON public.catalogue_tag_drafts   TO service_role;
GRANT ALL    ON public.catalogue_alias_drafts TO service_role;
