ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS held boolean NOT NULL DEFAULT false;
CREATE POLICY "Held reviews hidden from others" ON public.reviews AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (held = false OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));