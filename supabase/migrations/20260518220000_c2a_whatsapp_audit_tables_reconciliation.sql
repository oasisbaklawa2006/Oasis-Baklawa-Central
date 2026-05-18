-- C2A: Reconcile WhatsApp audit tables with production (idempotent, non-destructive).
-- Does NOT drop or recreate existing tables. Safe for environments where tables already exist.
--
-- RLS: recreates the same role-gated policies as production (user_role_map + roles.role_key pattern).
-- Explicitly: no UPDATE or DELETE policies are created for these tables (insert/select only where noted).
--
-- RLS role_key dependency (NOT seeded in this migration): policies require rows in public.roles
-- joined via public.user_role_map with role_key IN ('operations','finance','director') for SELECT,
-- and ('operations','director') for INSERT on whatsapp_override_log. Ensure these keys exist in
-- the target environment's roles catalog (e.g. production) or authenticated access will be denied.

-- =============================================================================
-- 1–2. Tables (CREATE IF NOT EXISTS — matches production column set)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_override_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL,
  operator_id uuid NOT NULL,
  operator_name character varying NOT NULL,
  previous_team character varying NULL,
  new_team character varying NOT NULL,
  assigned_to_user_id uuid NULL,
  priority character varying NOT NULL,
  reason text NOT NULL,
  created_at timestamp without time zone NULL DEFAULT now(),
  CONSTRAINT whatsapp_override_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_suggestions_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL,
  suggestion_type character varying NOT NULL,
  description text NULL,
  action text NULL,
  confidence numeric NULL,
  metadata jsonb NULL,
  created_at timestamp without time zone NULL DEFAULT now(),
  CONSTRAINT whatsapp_suggestions_log_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- 3. (Reserved) Column drift — omitted: use follow-up migrations if a
--     environment has a partial table; CREATE IF NOT EXISTS covers greenfield.
-- =============================================================================

-- =============================================================================
-- 4. Foreign keys (conrelid + conname scoped; orphan preflight; NOTICE on skip)
-- =============================================================================

DO $$
DECLARE
  rel_override constant oid := 'public.whatsapp_override_log'::regclass::oid;
  rel_suggestions constant oid := 'public.whatsapp_suggestions_log'::regclass::oid;
  orphan_count bigint;
BEGIN
  -- whatsapp_override_log.packet_id -> whatsapp_message_packets(id)
  IF to_regclass('public.whatsapp_message_packets') IS NULL THEN
    RAISE NOTICE 'Skipping whatsapp_override_log_packet_id_fkey: public.whatsapp_message_packets does not exist';
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = rel_override AND c.conname = 'whatsapp_override_log_packet_id_fkey'
  ) THEN
    PERFORM 1; -- constraint already present
  ELSE
    SELECT COUNT(*) INTO orphan_count
    FROM public.whatsapp_override_log o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.whatsapp_message_packets p WHERE p.id = o.packet_id
    );
    IF orphan_count > 0 THEN
      RAISE NOTICE 'Skipping whatsapp_override_log_packet_id_fkey: % row(s) in whatsapp_override_log reference missing whatsapp_message_packets.id', orphan_count;
    ELSE
      ALTER TABLE public.whatsapp_override_log
        ADD CONSTRAINT whatsapp_override_log_packet_id_fkey
        FOREIGN KEY (packet_id) REFERENCES public.whatsapp_message_packets (id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- whatsapp_suggestions_log.packet_id -> whatsapp_message_packets(id)
  IF to_regclass('public.whatsapp_message_packets') IS NULL THEN
    RAISE NOTICE 'Skipping whatsapp_suggestions_log_packet_id_fkey: public.whatsapp_message_packets does not exist';
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = rel_suggestions AND c.conname = 'whatsapp_suggestions_log_packet_id_fkey'
  ) THEN
    PERFORM 1; -- constraint already present
  ELSE
    SELECT COUNT(*) INTO orphan_count
    FROM public.whatsapp_suggestions_log s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.whatsapp_message_packets p WHERE p.id = s.packet_id
    );
    IF orphan_count > 0 THEN
      RAISE NOTICE 'Skipping whatsapp_suggestions_log_packet_id_fkey: % row(s) in whatsapp_suggestions_log reference missing whatsapp_message_packets.id', orphan_count;
    ELSE
      ALTER TABLE public.whatsapp_suggestions_log
        ADD CONSTRAINT whatsapp_suggestions_log_packet_id_fkey
        FOREIGN KEY (packet_id) REFERENCES public.whatsapp_message_packets (id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- whatsapp_override_log.operator_id -> users(id)
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'Skipping whatsapp_override_log_operator_id_fkey: public.users does not exist';
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = rel_override AND c.conname = 'whatsapp_override_log_operator_id_fkey'
  ) THEN
    PERFORM 1; -- constraint already present
  ELSE
    SELECT COUNT(*) INTO orphan_count
    FROM public.whatsapp_override_log o
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = o.operator_id);
    IF orphan_count > 0 THEN
      RAISE NOTICE 'Skipping whatsapp_override_log_operator_id_fkey: % row(s) in whatsapp_override_log reference missing users.id', orphan_count;
    ELSE
      ALTER TABLE public.whatsapp_override_log
        ADD CONSTRAINT whatsapp_override_log_operator_id_fkey
        FOREIGN KEY (operator_id) REFERENCES public.users (id) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 5. Indexes (IF NOT EXISTS)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_override_log_created
  ON public.whatsapp_override_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_override_log_operator
  ON public.whatsapp_override_log (operator_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_override_log_packet
  ON public.whatsapp_override_log (packet_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_suggestions_created
  ON public.whatsapp_suggestions_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_suggestions_packet
  ON public.whatsapp_suggestions_log (packet_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_suggestions_type
  ON public.whatsapp_suggestions_log (suggestion_type);

-- =============================================================================
-- 9. Priority CHECK (override log) — Sprint C2 route semantics; add if missing
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.whatsapp_override_log'::regclass
      AND conname = 'whatsapp_override_log_priority_check'
  ) THEN
    ALTER TABLE public.whatsapp_override_log
      ADD CONSTRAINT whatsapp_override_log_priority_check
      CHECK (lower(priority::text) = ANY (ARRAY['high'::text, 'normal'::text, 'low'::text]));
  END IF;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'whatsapp_override_log_priority_check not added: existing rows violate high/normal/low (case-insensitive).';
  WHEN duplicate_object THEN
    NULL;
END $$;

-- =============================================================================
-- 6–7. RLS + policies (same EXISTS pattern as production: user_role_map + roles)
-- Requires role_key values operations, finance, director (SELECT) and operations, director (INSERT
-- on override_log only) — see header comment; do not seed here.
-- No UPDATE or DELETE policies for authenticated on these tables.
-- suggestions_log: SELECT only for authenticated; no INSERT policy (service_role / future work).
-- =============================================================================

ALTER TABLE public.whatsapp_override_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_suggestions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS override_log_view ON public.whatsapp_override_log;
DROP POLICY IF EXISTS override_log_insert ON public.whatsapp_override_log;
DROP POLICY IF EXISTS suggestions_log_view ON public.whatsapp_suggestions_log;

CREATE POLICY override_log_view
  ON public.whatsapp_override_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_role_map urm
      JOIN public.roles r ON r.id = urm.role_id
      WHERE urm.user_id = auth.uid()
        AND r.role_key = ANY (ARRAY['operations'::text, 'finance'::text, 'director'::text])
    )
  );

CREATE POLICY override_log_insert
  ON public.whatsapp_override_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_role_map urm
      JOIN public.roles r ON r.id = urm.role_id
      WHERE urm.user_id = auth.uid()
        AND r.role_key = ANY (ARRAY['operations'::text, 'director'::text])
    )
  );

CREATE POLICY suggestions_log_view
  ON public.whatsapp_suggestions_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_role_map urm
      JOIN public.roles r ON r.id = urm.role_id
      WHERE urm.user_id = auth.uid()
        AND r.role_key = ANY (ARRAY['operations'::text, 'finance'::text, 'director'::text])
    )
  );

COMMENT ON TABLE public.whatsapp_override_log IS
  'C2A audit: manual packet/team overrides. RLS: SELECT (operations/finance/director), INSERT (operations/director). No UPDATE/DELETE policies on this table.';

COMMENT ON TABLE public.whatsapp_suggestions_log IS
  'C2A audit: optional persisted suggestions. RLS: SELECT (operations/finance/director) only for authenticated; no INSERT/UPDATE/DELETE policies for authenticated.';
