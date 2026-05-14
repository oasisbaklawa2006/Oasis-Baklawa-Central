-- Add on_credit enum label when order_payment_status type exists (no-op otherwise).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_type WHERE typname = 'order_payment_status') THEN
    BEGIN
      ALTER TYPE order_payment_status ADD VALUE IF NOT EXISTS 'on_credit';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
