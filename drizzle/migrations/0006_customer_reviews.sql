CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nickname text NOT NULL,
  seller_id text NOT NULL,
  seller_name text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  media_urls text[] NOT NULL DEFAULT '{}',
  video_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Post own review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own review" ON public.reviews FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX reviews_seller_idx ON public.reviews (seller_id, created_at DESC);
CREATE POLICY "Review media upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='review-media' AND (storage.foldername(name))[1] = auth.uid()::text);