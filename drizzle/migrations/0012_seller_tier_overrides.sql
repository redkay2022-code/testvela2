CREATE TABLE public.seller_tier_overrides (
  seller_id uuid PRIMARY KEY,
  tier text NOT NULL CHECK (tier IN ('standard','pro','prime','master')),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_tier_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seller_tier_overrides TO authenticated;
GRANT ALL ON public.seller_tier_overrides TO service_role;
ALTER TABLE public.seller_tier_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tier overrides" ON public.seller_tier_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert tier overrides" ON public.seller_tier_overrides FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND updated_by = auth.uid());
CREATE POLICY "Admins update tier overrides" ON public.seller_tier_overrides FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin') AND updated_by = auth.uid());
CREATE POLICY "Admins delete tier overrides" ON public.seller_tier_overrides FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));