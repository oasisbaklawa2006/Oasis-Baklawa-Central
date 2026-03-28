ALTER TABLE public.product_tag_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read product_tag_mapping"
  ON public.product_tag_mapping
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage product_tag_mapping"
  ON public.product_tag_mapping
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read product_tags"
  ON public.product_tags
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage product_tags"
  ON public.product_tags
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));