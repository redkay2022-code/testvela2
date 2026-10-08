ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS post_id text;
UPDATE public.reviews r SET post_id = o.post_id FROM public.orders o WHERE r.order_id = o.id AND r.post_id IS NULL;
CREATE INDEX IF NOT EXISTS reviews_post_id_idx ON public.reviews(post_id);
CREATE OR REPLACE FUNCTION public.set_review_post_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    SELECT o.post_id INTO NEW.post_id FROM public.orders o WHERE o.id = NEW.order_id;
  ELSE
    NEW.post_id := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reviews_set_post_id ON public.reviews;
CREATE TRIGGER reviews_set_post_id BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_review_post_id();