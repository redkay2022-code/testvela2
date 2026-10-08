CREATE POLICY "Prelaunch staff only posts" ON public.posts AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'seller')));
CREATE POLICY "Prelaunch staff only stores" ON public.stores AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'seller')));