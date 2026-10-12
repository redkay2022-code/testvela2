ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS source_lang text, ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.guard_post_translations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source_lang IS NOT NULL AND NEW.source_lang !~ '^[a-z]{2}$' THEN NEW.source_lang := NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN NEW.translations := '{}'::jsonb; END IF;
  ELSE
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description OR NEW.specs IS DISTINCT FROM OLD.specs OR NEW.source_lang IS DISTINCT FROM OLD.source_lang THEN
      NEW.translations := '{}'::jsonb;
    ELSIF current_user NOT IN ('service_role','postgres','supabase_admin') THEN
      NEW.translations := OLD.translations;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_post_translations ON public.posts;
CREATE TRIGGER guard_post_translations BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_post_translations();