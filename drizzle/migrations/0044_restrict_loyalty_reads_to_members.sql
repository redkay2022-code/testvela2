DROP POLICY IF EXISTS "Anyone reads point rules" ON public.loyalty_config;
CREATE POLICY "Members read point rules"
ON public.loyalty_config
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone reads tier settings" ON public.loyalty_settings;
CREATE POLICY "Members read tier settings"
ON public.loyalty_settings
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

REVOKE SELECT ON public.loyalty_config FROM anon;
REVOKE SELECT ON public.loyalty_settings FROM anon;