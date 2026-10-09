DROP POLICY IF EXISTS "Prelaunch members only stores" ON public.stores;

CREATE POLICY "Sellers read own stores" ON public.stores
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid());