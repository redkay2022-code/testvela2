CREATE POLICY "QC sellers upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qc-media' AND public.is_order_seller(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "QC parties read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'qc-media' AND public.is_order_party(((storage.foldername(name))[1])::uuid, auth.uid()));