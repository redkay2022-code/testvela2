DROP POLICY IF EXISTS "Read comments" ON public.comments;
CREATE POLICY "Read comments on published posts"
ON public.comments FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = comments.post_id AND p.status = 'published'
));

DROP POLICY IF EXISTS "Read reviews" ON public.reviews;
CREATE POLICY "Read verified public reviews"
ON public.reviews FOR SELECT TO anon, authenticated
USING (
  (order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = reviews.order_id
      AND o.stage = 'delivered'
      AND o.buyer_id = reviews.user_id
      AND o.seller_id::text = reviews.seller_id
  ))
  OR (order_id IS NULL AND rating IS NULL)
);

DROP POLICY IF EXISTS "Public read tier overrides" ON public.seller_tier_overrides;
CREATE POLICY "Read overrides for active studios"
ON public.seller_tier_overrides FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = seller_tier_overrides.seller_id
    AND ur.role IN ('seller'::public.app_role, 'admin'::public.app_role)
));

DROP POLICY IF EXISTS "Anyone reads avatars" ON storage.objects;
CREATE POLICY "Owners read avatars"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner_id = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Review media read" ON storage.objects;
CREATE POLICY "Owners read review media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'review-media'
  AND owner_id = (SELECT auth.uid()::text)
);