
CREATE TABLE public.b2b_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  gst_number text,
  expected_volume text,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.b2b_applications ENABLE ROW LEVEL SECURITY;

-- Admins can view all applications (we'll check role in app code)
CREATE POLICY "Authenticated users can view b2b_applications"
  ON public.b2b_applications FOR SELECT
  TO authenticated
  USING (true);

-- Admins can update applications
CREATE POLICY "Authenticated users can update b2b_applications"
  ON public.b2b_applications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anyone authenticated can insert (for registration)
CREATE POLICY "Authenticated users can insert b2b_applications"
  ON public.b2b_applications FOR INSERT
  TO authenticated
  WITH CHECK (true);
