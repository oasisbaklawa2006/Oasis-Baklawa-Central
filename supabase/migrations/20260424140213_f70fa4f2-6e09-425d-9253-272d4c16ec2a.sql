CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users (phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_b2b_applications_contact_email ON public.b2b_applications (contact_email);
CREATE INDEX IF NOT EXISTS idx_b2b_applications_contact_phone ON public.b2b_applications (contact_phone);
CREATE INDEX IF NOT EXISTS idx_b2b_applications_mobile_number ON public.b2b_applications (mobile_number);
CREATE INDEX IF NOT EXISTS idx_companies_phone ON public.companies (phone);