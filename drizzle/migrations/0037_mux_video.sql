-- Mux video streaming: uploads go straight to Mux, the webhook records the playback id,
-- and posts.video_url is switched from the "mux-upload:<ref>" placeholder to the HLS URL.
CREATE TABLE IF NOT EXISTS public.mux_uploads (
  ref text PRIMARY KEY,
  upload_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  asset_id text,
  playback_id text,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'errored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only the server (service role) reads or writes this table.
ALTER TABLE public.mux_uploads ENABLE ROW LEVEL SECURITY;

-- A post saved AFTER its video finished processing gets the stream URL immediately.
CREATE OR REPLACE FUNCTION public.resolve_mux_video()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid text;
BEGIN
  IF NEW.video_url LIKE 'mux-upload:%' THEN
    SELECT playback_id INTO pid FROM public.mux_uploads
      WHERE ref = substr(NEW.video_url, 12) AND status = 'ready';
    IF pid IS NOT NULL THEN
      NEW.video_url := 'https://stream.mux.com/' || pid || '.m3u8';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS resolve_mux_video ON public.posts;
CREATE TRIGGER resolve_mux_video BEFORE INSERT OR UPDATE OF video_url ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.resolve_mux_video();
