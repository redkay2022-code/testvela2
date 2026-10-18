CREATE TABLE public.seller_store_content (
 user_id uuid PRIMARY KEY,
 introduction text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_store_content TO anon, authenticated;
GRANT INSERT, UPDATE ON public.seller_store_content TO authenticated;
GRANT ALL ON public.seller_store_content TO service_role;
ALTER TABLE public.seller_store_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public store introductions" ON public.seller_store_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Seller creates own introduction" ON public.seller_store_content FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'seller'));
CREATE POLICY "Seller edits own introduction" ON public.seller_store_content FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'seller')) WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'seller'));
CREATE TABLE public.seller_store_notices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 title text NOT NULL,
 body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_store_notices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seller_store_notices TO authenticated;
GRANT ALL ON public.seller_store_notices TO service_role;
ALTER TABLE public.seller_store_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public store notices" ON public.seller_store_notices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Seller creates own notices" ON public.seller_store_notices FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'seller'));
CREATE POLICY "Seller edits own notices" ON public.seller_store_notices FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'seller')) WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'seller'));
CREATE POLICY "Seller deletes own notices" ON public.seller_store_notices FOR DELETE TO authenticated USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'seller'));