-- Synthetic APP-E2E Buyer certification fixture.
-- Runs only against a disposable local Core replay. Never use in production.

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_company uuid := '30000000-0000-4000-8000-000000000001'::uuid;
  v_buyer uuid := '30000000-0000-4000-8000-000000000010'::uuid;
  v_finance uuid := '30000000-0000-4000-8000-000000000020'::uuid;
  v_product uuid := '30000000-0000-4000-8000-000000000100'::uuid;
  v_order uuid := '30000000-0000-4000-8000-000000000200'::uuid;
  v_version uuid;
  v_pi_ready uuid;
  v_buyer_email text := 'synthetic.buyer.cert@oasis-disposable.test';
BEGIN
  SET LOCAL session_replication_role = replica;

  INSERT INTO public.companies (id, business_name, status, registered_address, gst_number)
  VALUES (
    v_company,
    'SYNTHETIC BUYER CERTIFICATION CO',
    'active',
    '1 Disposable Certification Lane, Test City',
    '29SYNTHETIC1Z5'
  )
  ON CONFLICT (id) DO UPDATE
  SET business_name = EXCLUDED.business_name,
      status = EXCLUDED.status,
      registered_address = EXCLUDED.registered_address,
      gst_number = EXCLUDED.gst_number;

  INSERT INTO public.users (id, email, full_name, role, department, designation, is_active, invite_status)
  VALUES (v_finance, 'synthetic.finance.cert@oasis-disposable.test', 'Synthetic Finance Cert', 'FINANCE_EXEC', 'Certification', 'Disposable finance actor', true, 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, company_id, email, role, is_approved, status)
  VALUES (v_buyer, v_company, v_buyer_email, 'b2b_buyer', true, 'approved')
  ON CONFLICT (id) DO UPDATE
  SET company_id = EXCLUDED.company_id,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      is_approved = true,
      status = 'approved';

  INSERT INTO public.users (id, email, full_name, role, department, designation, is_active, invite_status)
  VALUES (v_buyer, v_buyer_email, 'Synthetic Buyer Cert', 'b2b_buyer', 'Certification', 'Disposable buyer certification identity', true, 'active')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = EXCLUDED.role,
      is_active = true,
      invite_status = 'active';

  INSERT INTO public.products (
    id, sku, product_name, name, category, sub_category, hsn_code,
    is_active, visible_in_catalog, is_catalogue_ready, moq_value, increment_value, base_price, price_b2b
  )
  VALUES (
    v_product,
    'CERT-BUYER-GOLDEN-001',
    'Synthetic Certification Baklawa',
    'Synthetic Certification Baklawa',
    'Bakery',
    'Baklawa',
    '19059090',
    true,
    true,
    true,
    1,
    1,
    500,
    500
  )
  ON CONFLICT (id) DO UPDATE
  SET sku = EXCLUDED.sku,
      product_name = EXCLUDED.product_name,
      name = EXCLUDED.name,
      is_active = true,
      visible_in_catalog = true,
      is_catalogue_ready = true;

  INSERT INTO public.product_pricing_rules (product_id, price_channel, approval_status, base_price, calculated_price, currency, uom, gst_rate, tax_inclusive)
  VALUES (v_product, 'b2b', 'approved', 500, 500, 'INR', 'kg', 18, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.product_moq_rules (product_id, channel, moq_applicable, moq_value, increment_value, min_carton_qty)
  VALUES (v_product, 'b2b', true, 1, 1, 1)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.orders (id, company_id, status, order_origin, order_number, tracking_token)
  VALUES (v_order, v_company, 'submitted', 'CUSTOMER_APP', 'SO-CERT-PRESEED-001', md5(random()::text))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.order_items (id, order_id, product_id, quantity, pack_size, carton_type)
  SELECT gen_random_uuid(), v_order, v_product, 5, 'kg', 'carton'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.order_items WHERE order_id = v_order AND product_id = v_product
  );

  SET LOCAL session_replication_role = DEFAULT;

  PERFORM public.recalculate_customer_app_order_financials(v_order);
  v_version := public.create_sales_order_commercial_version_v1(
    v_order, 'BUYER_CERT_TEST', 'buyer-cert:preseed:1', 'buyer-cert-version-1', v_finance
  );

  SET LOCAL session_replication_role = replica;
  INSERT INTO public.sales_order_proforma_invoices (
    id, order_id, commercial_version_id, commercial_version_number, status,
    frozen_commercial_snapshot, frozen_snapshot_fingerprint, reason, source, correlation_id, idempotency_key
  )
  SELECT gen_random_uuid(), v_order, v_version, 1, 'READY_FOR_ISSUE',
    v.commercial_snapshot, v.snapshot_fingerprint, 'BUYER_CERT_READY', 'TEST', 'buyer-cert:ready', 'buyer-cert-ready-1'
  FROM public.sales_order_commercial_versions v
  WHERE v.id = v_version
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_pi_ready;

  SET LOCAL session_replication_role = DEFAULT;
END $$;
