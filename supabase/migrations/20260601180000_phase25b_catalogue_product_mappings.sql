-- Phase 25B: Central catalogue connector — mapping approved AI Catalogue Builder snapshots to products.
-- Oasis Central only; builder app owns authoring DB.

CREATE TABLE IF NOT EXISTS public.catalogue_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_catalogue_product_id text NOT NULL,
  central_product_id uuid NULL REFERENCES public.products (id) ON DELETE SET NULL,
  sku text NOT NULL,
  source_app text NOT NULL DEFAULT 'ai_catalogue_builder',
  source_version integer NOT NULL DEFAULT 1,
  sync_status text NOT NULL DEFAULT 'pending',
  last_synced_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_product_mappings_external_unique
    UNIQUE (source_app, external_catalogue_product_id),
  CONSTRAINT catalogue_product_mappings_sku_unique
    UNIQUE (source_app, sku),
  CONSTRAINT catalogue_product_mappings_sync_status_check CHECK (
    sync_status IN ('pending', 'synced', 'deactivated', 'error', 'skipped_stale')
  )
);

CREATE INDEX IF NOT EXISTS idx_catalogue_product_mappings_central_product
  ON public.catalogue_product_mappings (central_product_id);

CREATE INDEX IF NOT EXISTS idx_catalogue_product_mappings_sku
  ON public.catalogue_product_mappings (sku);

CREATE INDEX IF NOT EXISTS idx_catalogue_product_mappings_last_synced
  ON public.catalogue_product_mappings (last_synced_at DESC NULLS LAST);

COMMENT ON TABLE public.catalogue_product_mappings IS
  'Maps approved catalogue builder product IDs to Central products.id; idempotent sync by SKU.';

ALTER TABLE public.catalogue_product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogue_product_mappings_select_internal
  ON public.catalogue_product_mappings
  FOR SELECT
  TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY catalogue_product_mappings_write_internal
  ON public.catalogue_product_mappings
  FOR ALL
  TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));
