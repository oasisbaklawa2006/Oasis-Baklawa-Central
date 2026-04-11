
-- Create the whatsapp_attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp_attachments', 'whatsapp_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated can upload whatsapp attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp_attachments');

-- Allow authenticated users to read
CREATE POLICY "Authenticated can read whatsapp attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'whatsapp_attachments');
