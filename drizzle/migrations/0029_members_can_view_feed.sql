DROP POLICY IF EXISTS "Prelaunch staff only posts" ON public.posts;
CREATE POLICY "Prelaunch members only posts" ON public.posts AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Prelaunch staff only stores" ON public.stores;
CREATE POLICY "Prelaunch members only stores" ON public.stores AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (auth.uid() IS NOT NULL);