ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS specs jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.posts ADD CONSTRAINT posts_status_check CHECK (status IN ('draft','published'));
DROP POLICY IF EXISTS "Public feed" ON public.posts;
CREATE POLICY "Public feed" ON public.posts FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Feed or own drafts" ON public.posts FOR SELECT TO authenticated USING (status = 'published' OR user_id = auth.uid());
DROP POLICY IF EXISTS "Own posts insert" ON public.posts;
CREATE POLICY "Sellers insert own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND (public.has_role(auth.uid(),'seller') OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "Own posts update" ON public.posts;
CREATE POLICY "Sellers update own posts" ON public.posts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND (public.has_role(auth.uid(),'seller') OR public.has_role(auth.uid(),'admin')));
ALTER TABLE public.posts REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
END $$;