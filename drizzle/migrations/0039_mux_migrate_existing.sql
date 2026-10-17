-- Moving videos uploaded before the Mux integration: remember which post and which old storage file each Mux job belongs to,
-- so the webhook can swap that post's video only after Mux has finished (the old file keeps playing until then).
ALTER TABLE public.mux_uploads ADD COLUMN IF NOT EXISTS post_id text;
ALTER TABLE public.mux_uploads ADD COLUMN IF NOT EXISTS source_path text;
CREATE INDEX IF NOT EXISTS mux_uploads_post_idx ON public.mux_uploads (post_id) WHERE post_id IS NOT NULL;
