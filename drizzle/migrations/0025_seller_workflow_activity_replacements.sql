CREATE TABLE public.order_replacements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id), seller_id uuid NOT NULL, reason text NOT NULL, status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','shipped')), courier text, tracking_number text, created_at timestamptz NOT NULL DEFAULT now(), shipped_at timestamptz, UNIQUE(order_id)
);
GRANT SELECT ON public.order_replacements TO authenticated;
GRANT ALL ON public.order_replacements TO service_role;
ALTER TABLE public.order_replacements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order parties read replacements" ON public.order_replacements FOR SELECT TO authenticated USING (public.is_order_party(order_id,auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX order_replacements_seller ON public.order_replacements(seller_id);
CREATE OR REPLACE FUNCTION public.seller_activity_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
 IF uid IS NULL OR NOT (public.has_role(uid,'seller') OR public.has_role(uid,'admin')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 RETURN jsonb_build_object(
 'products',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'likes',(SELECT count(*) FROM public.likes l WHERE l.post_id=p.id AND l.user_id<>uid),'saves',(SELECT count(*) FROM public.cart_items c WHERE c.post_id=p.id AND c.user_id<>uid))) FROM public.posts p WHERE p.user_id=uid),'[]'::jsonb),
 'followers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.follower_id,'nickname',coalesce(pr.nickname,'VELA 회원'),'created_at',f.created_at) ORDER BY f.created_at DESC) FROM public.seller_follows f LEFT JOIN public.profiles pr ON pr.user_id=f.follower_id WHERE f.seller_key=uid::text AND f.follower_id<>uid),'[]'::jsonb),
 'comments',coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (SELECT c.id,c.post_id,c.creator,c.body,c.created_at,p.title FROM public.comments c JOIN public.posts p ON p.id=c.post_id WHERE p.user_id=uid AND c.user_id<>uid ORDER BY c.created_at DESC LIMIT 100) x),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.seller_activity_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seller_activity_summary() TO authenticated,service_role;