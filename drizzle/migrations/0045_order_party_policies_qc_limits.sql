-- 100차 DB 적용 (한 번만 실행해도 되고, 여러 번 실행해도 안전합니다)

-- 1) 주문/거래 접근 제한: 구매자 본인, 판매자 본인, 관리자만
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND cmd IN ('SELECT','UPDATE','ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.orders', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Parties read orders" ON public.orders FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Parties update orders" ON public.orders FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders FROM anon;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('order_qc_media','order_messages') AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;
CREATE POLICY "Parties read qc media" ON public.order_qc_media FOR SELECT TO authenticated USING (public.is_order_party(order_id, auth.uid()));
CREATE POLICY "Parties read messages" ON public.order_messages FOR SELECT TO authenticated USING (public.is_order_party(order_id, auth.uid()));
REVOKE ALL ON public.order_qc_media, public.order_messages FROM anon;

ALTER TABLE IF EXISTS public.test_seed_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.test_seed_log FROM anon, authenticated;

-- 2) QC 업로드 제한: 라운드당 사진 최대 14장, 영상 최대 1개
CREATE OR REPLACE FUNCTION public.limit_qc_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.order_qc_media WHERE order_id=NEW.order_id AND round=NEW.round AND kind=NEW.kind;
  IF NEW.kind='image' AND n >= 14 THEN RAISE EXCEPTION 'QC photos limit is 14'; END IF;
  IF NEW.kind='video' AND n >= 1 THEN RAISE EXCEPTION 'QC video limit is 1'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS qc_media_limit ON public.order_qc_media;
CREATE TRIGGER qc_media_limit BEFORE INSERT ON public.order_qc_media FOR EACH ROW EXECUTE FUNCTION public.limit_qc_media();

-- 3) 단계 변경 알림: QC 완료 -> 구매자, 구매자 승인 -> 판매자
CREATE OR REPLACE FUNCTION public.notify_order_stage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.stage='qc_done' THEN
      INSERT INTO public.notifications(user_id,kind,title,body,cta_label,cta_url)
      VALUES (NEW.buyer_id,'qc_ready','QC 사진·영상 도착 · '||NEW.order_no, NEW.title||' · 셀러가 QC 사진과 영상을 올렸습니다. 확인 후 승인해 주세요.','QC 확인','/me?customerTab=orders');
    ELSIF NEW.stage='shipping_prep' AND NEW.seller_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,kind,title,body,cta_label,cta_url)
      VALUES (NEW.seller_id,'qc_approved','QC 승인 완료 · '||NEW.order_no, NEW.title||' · 구매자가 QC를 승인했습니다. 배송을 준비해 주세요.','배송 준비','/seller');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS order_stage_notify ON public.orders;
CREATE TRIGGER order_stage_notify AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_stage();
REVOKE ALL ON FUNCTION public.limit_qc_media(), public.notify_order_stage() FROM PUBLIC, anon, authenticated;