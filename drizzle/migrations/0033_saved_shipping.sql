CREATE TABLE public.saved_shipping (
  user_id uuid PRIMARY KEY,
  shipping jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_shipping TO authenticated;
GRANT ALL ON public.saved_shipping TO service_role;
ALTER TABLE public.saved_shipping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own shipping select" ON public.saved_shipping FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own shipping insert" ON public.saved_shipping FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own shipping update" ON public.saved_shipping FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own shipping delete" ON public.saved_shipping FOR DELETE TO authenticated USING (auth.uid() = user_id);