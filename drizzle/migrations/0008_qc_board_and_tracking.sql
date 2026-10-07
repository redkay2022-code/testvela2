CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL DEFAULT ('VM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  buyer_id uuid NOT NULL,
  seller_id uuid,
  seller_name text NOT NULL DEFAULT '',
  post_id text,
  title text NOT NULL,
  image_url text,
  amount_usd numeric NOT NULL DEFAULT 0,
  network text,
  txid text,
  stage text NOT NULL DEFAULT 'placed',
  courier text,
  tracking_number text,
  tracking_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  tracking_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_order_seller(_order_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=_order_id AND (o.seller_id=_uid OR (o.seller_id IS NULL AND public.has_role(_uid,'admin'))))
$$;
CREATE OR REPLACE FUNCTION public.is_order_party(_order_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=_order_id AND (o.buyer_id=_uid OR o.seller_id=_uid OR public.has_role(_uid,'admin')))
$$;

CREATE POLICY "Parties read orders" ON public.orders FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Buyers create own orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid() AND stage = 'placed');
CREATE POLICY "Parties update orders" ON public.orders FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.order_qc_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','video')),
  round integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_qc_media TO authenticated;
GRANT ALL ON public.order_qc_media TO service_role;
ALTER TABLE public.order_qc_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read qc media" ON public.order_qc_media FOR SELECT TO authenticated USING (public.is_order_party(order_id, auth.uid()));
CREATE POLICY "Sellers add qc media" ON public.order_qc_media FOR INSERT TO authenticated WITH CHECK (uploader_id = auth.uid() AND public.is_order_seller(order_id, auth.uid()));

CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('buyer','seller')),
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note','request','qc','system')),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 1000),
  areas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read messages" ON public.order_messages FOR SELECT TO authenticated USING (public.is_order_party(order_id, auth.uid()));
CREATE POLICY "Parties post messages" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND (
    (author_role='buyer' AND EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.buyer_id=auth.uid()))
    OR (author_role='seller' AND public.is_order_seller(order_id, auth.uid()))
  ));

-- Enforce role-based stage transitions and QC requirements.
CREATE OR REPLACE FUNCTION public.guard_order_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); is_buyer boolean; is_seller boolean; imgs int; vids int; latest int;
BEGIN
  IF uid IS NULL THEN NEW.updated_at := now(); RETURN NEW; END IF; -- server/service updates (tracking sync)
  is_buyer := OLD.buyer_id = uid;
  is_seller := OLD.seller_id = uid OR (OLD.seller_id IS NULL AND public.has_role(uid,'admin'));
  IF NEW.buyer_id <> OLD.buyer_id OR NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.amount_usd <> OLD.amount_usd
     OR NEW.title <> OLD.title OR NEW.order_no <> OLD.order_no OR NEW.txid IS DISTINCT FROM OLD.txid
     OR NEW.tracking_status <> OLD.tracking_status OR NEW.tracking_checked_at IS DISTINCT FROM OLD.tracking_checked_at THEN
    RAISE EXCEPTION 'Protected order fields cannot be changed';
  END IF;
  IF (NEW.courier IS DISTINCT FROM OLD.courier OR NEW.tracking_number IS DISTINCT FROM OLD.tracking_number) AND NOT is_seller THEN
    RAISE EXCEPTION 'Only the seller can set tracking';
  END IF;
  IF NEW.stage <> OLD.stage THEN
    IF is_seller AND (OLD.stage, NEW.stage) IN (('placed','preparing'),('preparing','qc'),('qc','qc_done'),('qc_requested','qc_done'),('shipping_prep','shipped')) THEN
      IF NEW.stage = 'qc_done' THEN
        SELECT count(*) FILTER (WHERE kind='image'), count(*) FILTER (WHERE kind='video'), coalesce(max(round),0)
          INTO imgs, vids, latest FROM public.order_qc_media WHERE order_id = OLD.id;
        IF OLD.stage='qc' AND (imgs < 9 OR vids < 1) THEN RAISE EXCEPTION 'QC requires at least 9 photos and 1 video'; END IF;
      END IF;
      IF NEW.stage = 'shipped' AND coalesce(trim(NEW.tracking_number),'') = '' THEN RAISE EXCEPTION 'Tracking number required'; END IF;
    ELSIF is_buyer AND (OLD.stage, NEW.stage) IN (('qc_done','shipping_prep'),('qc_done','qc_requested'),('shipped','delivered')) THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Stage change not allowed';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER orders_guard BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_update();

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
ALTER TABLE public.order_qc_media REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders, public.order_messages, public.order_qc_media;