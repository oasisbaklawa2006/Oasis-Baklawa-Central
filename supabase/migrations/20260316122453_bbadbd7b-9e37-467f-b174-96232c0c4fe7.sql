
-- Allow authenticated users to INSERT draft orders for their company
CREATE POLICY "Users can insert orders for their company"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid())
);

-- Allow authenticated users to UPDATE their company's orders
CREATE POLICY "Users can update their company orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid()))
WITH CHECK (company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid()));

-- Allow authenticated users to INSERT order items for their orders
CREATE POLICY "Users can insert order items for their orders"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (
    SELECT orders.id FROM orders
    WHERE orders.company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid())
  )
);

-- Allow authenticated users to UPDATE order items for their orders
CREATE POLICY "Users can update order items for their orders"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  order_id IN (
    SELECT orders.id FROM orders
    WHERE orders.company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid())
  )
)
WITH CHECK (
  order_id IN (
    SELECT orders.id FROM orders
    WHERE orders.company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid())
  )
);

-- Allow authenticated users to DELETE order items from their orders
CREATE POLICY "Users can delete order items from their orders"
ON public.order_items
FOR DELETE
TO authenticated
USING (
  order_id IN (
    SELECT orders.id FROM orders
    WHERE orders.company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid())
  )
);
