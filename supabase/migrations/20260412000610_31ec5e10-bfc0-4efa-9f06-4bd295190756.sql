
-- =============================================
-- 1. ORDER_ITEMS — Remove overly permissive policies
-- =============================================
DROP POLICY IF EXISTS "Secure insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Secure read order items" ON public.order_items;
DROP POLICY IF EXISTS "Secure update order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can add order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can read order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view order items of their company" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_policy" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_policy" ON public.order_items;
DROP POLICY IF EXISTS "Companies can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Internal staff can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Manage Own Order Items" ON public.order_items;
DROP POLICY IF EXISTS "Users can delete order items from their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can update order items for their orders" ON public.order_items;

-- Scoped: Internal staff full access
CREATE POLICY "Staff full access order_items"
ON public.order_items FOR ALL
TO authenticated
USING (is_internal_staff(auth.uid()))
WITH CHECK (is_internal_staff(auth.uid()));

-- Scoped: Buyers can SELECT their own company's order items
CREATE POLICY "Buyers read own order_items"
ON public.order_items FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.company_id = (SELECT u.company_id FROM users u WHERE u.id = auth.uid() LIMIT 1)
  )
);

-- Scoped: Buyers can INSERT into their own company's orders
CREATE POLICY "Buyers insert own order_items"
ON public.order_items FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.company_id = (SELECT u.company_id FROM users u WHERE u.id = auth.uid() LIMIT 1)
  )
);

-- Scoped: Buyers can UPDATE their own company's order items
CREATE POLICY "Buyers update own order_items"
ON public.order_items FOR UPDATE
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.company_id = (SELECT u.company_id FROM users u WHERE u.id = auth.uid() LIMIT 1)
  )
)
WITH CHECK (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.company_id = (SELECT u.company_id FROM users u WHERE u.id = auth.uid() LIMIT 1)
  )
);

-- Scoped: Buyers can DELETE their own company's order items
CREATE POLICY "Buyers delete own order_items"
ON public.order_items FOR DELETE
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.company_id = (SELECT u.company_id FROM users u WHERE u.id = auth.uid() LIMIT 1)
  )
);

-- =============================================
-- 2. ORDER_PAYMENTS — Remove "Unrestricted" policy
-- =============================================
DROP POLICY IF EXISTS "Unrestricted order payment access" ON public.order_payments;

-- =============================================
-- 3. FACTORY_INVENTORY — Replace blanket authenticated access
-- =============================================
DROP POLICY IF EXISTS "Allow authenticated full access on factory_inventory" ON public.factory_inventory;

CREATE POLICY "Staff full access factory_inventory"
ON public.factory_inventory FOR ALL
TO authenticated
USING (is_internal_staff(auth.uid()))
WITH CHECK (is_internal_staff(auth.uid()));

CREATE POLICY "Buyers read factory_inventory"
ON public.factory_inventory FOR SELECT
TO authenticated
USING (true);

-- =============================================
-- 4. DISPATCH_CARTONS — Replace blanket authenticated access
-- =============================================
DROP POLICY IF EXISTS "Allow authenticated full access on dispatch_cartons" ON public.dispatch_cartons;

CREATE POLICY "Staff full access dispatch_cartons"
ON public.dispatch_cartons FOR ALL
TO authenticated
USING (is_internal_staff(auth.uid()))
WITH CHECK (is_internal_staff(auth.uid()));

-- =============================================
-- 5. MOQ_RULES — Remove "Unrestricted" public policy
-- =============================================
DROP POLICY IF EXISTS "Unrestricted moq access" ON public.moq_rules;
