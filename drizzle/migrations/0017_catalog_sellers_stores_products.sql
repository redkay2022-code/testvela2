CREATE TABLE public.sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_type text NOT NULL DEFAULT 'CURATED' CHECK (seller_type IN ('CURATED','EXTERNAL')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','PENDING','SUSPENDED')),
  account_id uuid,
  country text NOT NULL DEFAULT '',
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sellers" ON public.sellers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners read own seller" ON public.sellers FOR SELECT TO authenticated USING (account_id = auth.uid());

CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
  store_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo text, cover_image text, avatar text,
  description text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '',
  specialties text[] NOT NULL DEFAULT '{}',
  shipping_regions text[] NOT NULL DEFAULT '{}',
  shipping_information text NOT NULL DEFAULT '',
  response_time text NOT NULL DEFAULT '',
  verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED','VERIFIED','PREMIUM','MASTER')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','INACTIVE')),
  featured boolean NOT NULL DEFAULT false,
  data_source text NOT NULL DEFAULT 'PRODUCTION' CHECK (data_source IN ('SEED','PRODUCTION')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stores_seller_idx ON public.stores(seller_id);
GRANT SELECT ON public.stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active stores" ON public.stores FOR SELECT TO anon, authenticated USING (status = 'ACTIVE');
CREATE POLICY "Admins manage stores" ON public.stores FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.posts
  ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE RESTRICT,
  ADD COLUMN brand text NOT NULL DEFAULT '',
  ADD COLUMN model text NOT NULL DEFAULT '',
  ADD COLUMN reference text NOT NULL DEFAULT '',
  ADD COLUMN subcategory text NOT NULL DEFAULT '',
  ADD COLUMN sku text NOT NULL DEFAULT '',
  ADD COLUMN currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN stock_qty integer NOT NULL DEFAULT 1 CHECK (stock_qty >= 0),
  ADD COLUMN reserved_qty integer NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  ADD COLUMN low_stock_threshold integer NOT NULL DEFAULT 1 CHECK (low_stock_threshold >= 0),
  ADD COLUMN featured boolean NOT NULL DEFAULT false,
  ADD COLUMN data_source text NOT NULL DEFAULT 'PRODUCTION' CHECK (data_source IN ('SEED','PRODUCTION')),
  ADD COLUMN product_status text CHECK (product_status IN ('DRAFT','READY','PUBLISHED','OUT_OF_STOCK','ARCHIVED'));
UPDATE public.posts SET product_status = CASE WHEN status='published' THEN 'PUBLISHED' ELSE 'DRAFT' END;
CREATE INDEX posts_store_idx ON public.posts(store_id);

CREATE OR REPLACE FUNCTION public.sync_product_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE avail int; is_admin boolean := auth.uid() IS NULL OR public.has_role(auth.uid(),'admin');
BEGIN
  IF TG_OP = 'UPDATE' AND NOT is_admin THEN
    NEW.featured := OLD.featured; NEW.data_source := OLD.data_source; NEW.store_id := OLD.store_id;
  END IF;
  IF TG_OP = 'INSERT' AND NOT is_admin THEN NEW.featured := false; NEW.data_source := 'PRODUCTION'; NEW.store_id := NULL; END IF;
  IF NEW.product_status IS NULL OR (TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.product_status IS NOT DISTINCT FROM OLD.product_status) THEN
    NEW.product_status := CASE WHEN NEW.status='published' THEN 'PUBLISHED' ELSE 'DRAFT' END;
  END IF;
  avail := NEW.stock_qty - NEW.reserved_qty;
  IF NEW.product_status = 'PUBLISHED' AND avail <= 0 THEN NEW.product_status := 'OUT_OF_STOCK';
  ELSIF NEW.product_status = 'OUT_OF_STOCK' AND avail > 0 THEN NEW.product_status := 'PUBLISHED';
  END IF;
  NEW.status := CASE WHEN NEW.product_status IN ('PUBLISHED','OUT_OF_STOCK') THEN 'published' ELSE 'draft' END;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER posts_sync_product_status BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.sync_product_status();

CREATE OR REPLACE FUNCTION public.store_is_visible(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _store_id IS NULL OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id=_store_id AND s.status='ACTIVE')
$$;
CREATE POLICY "Hide products of inactive stores" ON public.posts AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (public.store_is_visible(store_id) OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage products" ON public.posts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  path text NOT NULL,
  kind text NOT NULL DEFAULT 'gallery' CHECK (kind IN ('main','gallery','dial','case','caseback','movement','bracelet','clasp','detail','qc')),
  sort_order integer NOT NULL DEFAULT 0,
  is_main boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_post_idx ON public.product_images(post_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage product images" ON public.product_images FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.product_qc (
  post_id text PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  qc_available boolean NOT NULL DEFAULT false,
  qc_video text,
  timegrapher jsonb NOT NULL DEFAULT '{}'::jsonb,
  inspection_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_qc TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_qc TO authenticated;
GRANT ALL ON public.product_qc TO service_role;
ALTER TABLE public.product_qc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads qc of published products" ON public.product_qc FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=product_qc.post_id AND p.status='published'));
CREATE POLICY "Admins manage product qc" ON public.product_qc FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));