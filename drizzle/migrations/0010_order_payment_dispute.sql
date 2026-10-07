ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dispute_open boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dispute_opened_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_order_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); is_buyer boolean; is_seller boolean; is_admin boolean; imgs int; vids int; latest int;
BEGIN
  IF uid IS NULL THEN NEW.updated_at := now(); RETURN NEW; END IF;
  is_buyer := OLD.buyer_id = uid;
  is_admin := public.has_role(uid,'admin');
  is_seller := OLD.seller_id = uid OR (OLD.seller_id IS NULL AND is_admin);
  IF NEW.buyer_id <> OLD.buyer_id OR NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.amount_usd <> OLD.amount_usd
     OR NEW.title <> OLD.title OR NEW.order_no <> OLD.order_no OR NEW.txid IS DISTINCT FROM OLD.txid
     OR NEW.tracking_status <> OLD.tracking_status OR NEW.tracking_checked_at IS DISTINCT FROM OLD.tracking_checked_at THEN
    RAISE EXCEPTION 'Protected order fields cannot be changed';
  END IF;
  IF NEW.payment_verified_at IS DISTINCT FROM OLD.payment_verified_at AND NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can verify payment';
  END IF;
  IF NEW.dispute_open IS DISTINCT FROM OLD.dispute_open THEN
    IF NEW.dispute_open AND NOT (is_buyer OR is_seller OR is_admin) THEN RAISE EXCEPTION 'Not allowed'; END IF;
    IF NOT NEW.dispute_open AND NOT is_admin THEN RAISE EXCEPTION 'Only admins can close disputes'; END IF;
    IF NEW.dispute_open THEN NEW.dispute_opened_at := now(); END IF;
  ELSIF NEW.dispute_opened_at IS DISTINCT FROM OLD.dispute_opened_at THEN
    NEW.dispute_opened_at := OLD.dispute_opened_at;
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
END $function$;

DROP POLICY IF EXISTS "Parties post messages" ON public.order_messages;
CREATE POLICY "Parties post messages" ON public.order_messages FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND (
  (author_role = 'buyer' AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_messages.order_id AND o.buyer_id = auth.uid()))
  OR (author_role = 'seller' AND public.is_order_seller(order_id, auth.uid()))
  OR (author_role = 'admin' AND public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_messages.order_id AND o.dispute_open))
));