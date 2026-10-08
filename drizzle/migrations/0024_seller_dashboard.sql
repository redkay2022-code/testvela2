CREATE TABLE public.seller_follows (follower_id uuid NOT NULL, seller_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (follower_id, seller_key));
GRANT SELECT, INSERT, DELETE ON public.seller_follows TO authenticated;
GRANT ALL ON public.seller_follows TO service_role;
ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own follows read" ON public.seller_follows FOR SELECT TO authenticated USING (auth.uid() = follower_id);
CREATE POLICY "own follows add" ON public.seller_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "own follows remove" ON public.seller_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE TABLE public.cart_items (user_id uuid NOT NULL, post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, post_id));
GRANT SELECT, INSERT, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cart read" ON public.cart_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own cart add" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cart remove" ON public.cart_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.seller_dashboard_stats() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'seller') OR public.has_role(auth.uid(),'admin')) THEN NULL ELSE jsonb_build_object(
    'followers', (SELECT count(*) FROM seller_follows WHERE seller_key = auth.uid()::text),
    'cart', (SELECT count(*) FROM cart_items c JOIN posts p ON p.id = c.post_id WHERE p.user_id = auth.uid()),
    'orders', (SELECT count(*) FROM orders WHERE seller_id = auth.uid() AND cancelled_at IS NULL),
    'preparing', (SELECT count(*) FROM orders WHERE seller_id = auth.uid() AND cancelled_at IS NULL AND stage IN ('placed','preparing','qc','qc_requested','qc_done','shipping_prep')),
    'escrow_pending_usd', (SELECT coalesce(sum(amount_usd),0) FROM orders WHERE seller_id = auth.uid() AND cancelled_at IS NULL AND payment_verified_at IS NOT NULL AND stage <> 'delivered'),
    'selling', (SELECT count(*) FROM posts WHERE user_id = auth.uid() AND product_status = 'PUBLISHED'),
    'sold_out', (SELECT count(*) FROM posts WHERE user_id = auth.uid() AND product_status = 'OUT_OF_STOCK')
  ) END
$$;
REVOKE ALL ON FUNCTION public.seller_dashboard_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seller_dashboard_stats() TO authenticated;