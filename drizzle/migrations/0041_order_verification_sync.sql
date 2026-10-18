ALTER TABLE public.orders ADD COLUMN verification_status text NOT NULL DEFAULT 'PENDING_VERIFICATION';
UPDATE public.orders SET verification_status = CASE WHEN payment_verified_at IS NOT NULL THEN 'CONFIRMED' ELSE 'PENDING_VERIFICATION' END;
ALTER TABLE public.orders ADD CONSTRAINT orders_verification_status_check CHECK (verification_status IN ('PENDING_VERIFICATION','CONFIRMED'));
CREATE OR REPLACE FUNCTION public.sync_order_verification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') AND NEW.payment_verified_at IS NOT NULL THEN RAISE EXCEPTION 'Only admins can verify payment'; END IF;
  ELSE
    IF (NEW.payment_verified_at IS DISTINCT FROM OLD.payment_verified_at OR NEW.verification_status IS DISTINCT FROM OLD.verification_status) AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can verify payment'; END IF;
    IF OLD.payment_verified_at IS NOT NULL AND NEW.payment_verified_at IS DISTINCT FROM OLD.payment_verified_at THEN RAISE EXCEPTION 'Payment verification is immutable'; END IF;
    IF OLD.payment_verified_at IS NULL AND NEW.payment_verified_at IS NOT NULL AND coalesce(trim(NEW.txid),'') = '' THEN RAISE EXCEPTION 'TXID required for payment confirmation'; END IF;
  END IF;
  NEW.verification_status := CASE WHEN NEW.payment_verified_at IS NOT NULL THEN 'CONFIRMED' ELSE 'PENDING_VERIFICATION' END;
  RETURN NEW;
END $$;
CREATE TRIGGER order_verification_before BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_order_verification();
CREATE OR REPLACE FUNCTION public.notify_order_verification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.payment_verified_at IS NULL AND NEW.payment_verified_at IS NOT NULL THEN
    UPDATE public.payment_transactions SET escrow_status='HELD', verified_at=NEW.payment_verified_at WHERE order_id=NEW.id AND escrow_status='PENDING';
    INSERT INTO public.notifications(user_id,kind,title,body,cta_label,cta_url)
    SELECT DISTINCT recipient,'payment_verified','TXID 검증 완료 · ' || NEW.order_no, NEW.title || ' · 입금이 확인되어 에스크로에 보관됩니다.','주문 확인',CASE WHEN recipient=NEW.buyer_id THEN '/me?customerTab=orders' WHEN recipient=NEW.seller_id THEN '/seller' ELSE '/admin?section=orders&role=admin' END
    FROM (SELECT NEW.buyer_id AS recipient UNION SELECT NEW.seller_id UNION SELECT user_id FROM public.user_roles WHERE role='admin') parties WHERE recipient IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_verification_after AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_verification();
CREATE OR REPLACE FUNCTION public.order_party_labels(_order_ids uuid[]) RETURNS TABLE(user_id uuid,nickname text,system_code text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT DISTINCT p.user_id,p.nickname,p.system_code FROM public.profiles p JOIN public.orders o ON p.user_id=o.buyer_id OR p.user_id=o.seller_id WHERE o.id=ANY(_order_ids) AND (o.buyer_id=auth.uid() OR o.seller_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
$$;
REVOKE ALL ON FUNCTION public.order_party_labels(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_party_labels(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_order_verification(), public.notify_order_verification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_order_verification(), public.notify_order_verification() TO service_role;