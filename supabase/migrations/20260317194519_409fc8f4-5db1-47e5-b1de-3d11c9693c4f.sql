
-- Create storage bucket for trade documents
INSERT INTO storage.buckets (id, name, public) VALUES ('trade-documents', 'trade-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to trade-documents
CREATE POLICY "Authenticated users can upload trade documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trade-documents');

-- Allow authenticated users to read their own uploads
CREATE POLICY "Users can read trade documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'trade-documents');

-- Allow public (anon) uploads for registration flow
CREATE POLICY "Anon can upload trade documents"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'trade-documents');
