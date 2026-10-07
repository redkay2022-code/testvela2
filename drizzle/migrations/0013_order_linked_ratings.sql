ALTER TABLE public.reviews ADD COLUMN rating smallint CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN order_id uuid UNIQUE;
DROP POLICY IF EXISTS "Post own review" ON public.reviews;
CREATE POLICY "Post own review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND (
    (order_id IS NULL AND rating IS NULL)
    OR (order_id IS NOT NULL AND rating IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = reviews.order_id AND o.buyer_id = auth.uid() AND o.stage = 'delivered' AND o.seller_id IS NOT NULL AND o.seller_id::text = reviews.seller_id))
  )
);