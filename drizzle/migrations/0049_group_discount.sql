-- 170차: 공동구매(Type B)를 "즉시 가격 할인"으로 재설계. 공동구매 주문에는 포인트가 적립되지 않는다.
-- 할인율: 2~3명 5% / 4~6명 8% / 7~9명 12% / 10명 15%. 0048(포인트 방식)을 이미 실행했어도, 안 했어도 안전하게 실행된다.

-- 0) 포인트 사용 한도 30% 와 포인트 유형 (0048과 동일, 이미 적용돼 있어도 무방)
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.loyalty_config'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%max_redemption_pct%' LOOP
    EXECUTE format('ALTER TABLE public.loyalty_config DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.loyalty_config ADD CONSTRAINT loyalty_config_max_redemption_pct_check CHECK (max_redemption_pct >= 0 AND max_redemption_pct <= 30);
UPDATE public.loyalty_config SET max_redemption_pct = 30 WHERE id = 1;
ALTER TABLE public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_type_check;
ALTER TABLE public.point_transactions ADD CONSTRAINT point_transactions_type_check
  CHECK (type IN ('EARN','REDEEM','REFUND','REVERSAL','EXPIRED','ADMIN_ADJUSTMENT','BONUS','REFERRAL','GROUP_BONUS','LEADER_BONUS'));

-- 1) 이전(포인트 방식) 공동구매 로직 제거
DROP TRIGGER IF EXISTS orders_zzy_group ON public.orders;
DROP TRIGGER IF EXISTS orders_zzzz_group_after ON public.orders;
DROP TRIGGER IF EXISTS orders_yy_group ON public.orders;
DROP TRIGGER IF EXISTS orders_zzy_group_pts ON public.orders;
DROP FUNCTION IF EXISTS public.group_order_no_points();
DROP FUNCTION IF EXISTS public.group_order_before();
DROP FUNCTION IF EXISTS public.group_order_after();
DROP FUNCTION IF EXISTS public._group_payout(uuid);
DROP FUNCTION IF EXISTS public._group_reverse(public.orders);
DROP FUNCTION IF EXISTS public._group_guard_points(bigint);
DROP FUNCTION IF EXISTS public._group_tier(int);
DROP FUNCTION IF EXISTS public._group_eval(uuid);
DROP FUNCTION IF EXISTS public.group_my_summary();
DROP FUNCTION IF EXISTS public.group_public(uuid);

-- 2) 테이블
CREATE TABLE IF NOT EXISTS public.group_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL,
  product_id text NOT NULL,
  target_size int NOT NULL CHECK (target_size BETWEEN 2 AND 10),
  current_size int NOT NULL DEFAULT 1 CHECK (current_size >= 0),
  duration_hours int NOT NULL DEFAULT 72 CHECK (duration_hours BETWEEN 1 AND 72),
  discount_tier int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','successful','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz
);
-- posts.id 는 text 이므로 이미 uuid 로 만들어진 경우 text 로 바꾼다
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='group_purchases' AND column_name='product_id') = 'uuid' THEN
    DROP INDEX IF EXISTS public.group_purchases_product_idx;
    ALTER TABLE public.group_purchases ALTER COLUMN product_id TYPE text USING product_id::text;
  END IF;
END $$;
ALTER TABLE public.group_purchases ADD COLUMN IF NOT EXISTS discount_tier int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS group_purchases_leader_idx ON public.group_purchases(leader_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_purchases_product_idx ON public.group_purchases(product_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid UNIQUE,
  status text NOT NULL DEFAULT 'joined',
  joined_at timestamptz NOT NULL DEFAULT now(),
  refund_due_usd numeric NOT NULL DEFAULT 0,
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS refund_due_usd numeric NOT NULL DEFAULT 0;
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.group_members'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE public.group_members DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
-- joined = 결제 대기, paid = 결제 완료(에스크로 진행 중), escrow_approved = 에스크로 승인(완료), canceled = 취소
ALTER TABLE public.group_members ADD CONSTRAINT group_members_status_check CHECK (status IN ('joined','paid','escrow_approved','canceled'));
CREATE INDEX IF NOT EXISTS group_members_user_idx ON public.group_members(user_id);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS group_discount_pct numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS group_discount_usd numeric NOT NULL DEFAULT 0 CHECK (group_discount_usd >= 0);
CREATE INDEX IF NOT EXISTS orders_group_idx ON public.orders(group_id) WHERE group_id IS NOT NULL;

ALTER TABLE public.group_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.group_purchases, public.group_members TO authenticated;
GRANT ALL ON public.group_purchases, public.group_members TO service_role;
CREATE OR REPLACE FUNCTION public._group_can_see(_gid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_purchases g WHERE g.id = _gid AND g.leader_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = _gid AND m.user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin') $$;
CREATE OR REPLACE FUNCTION public._group_is_leader(_gid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_purchases g WHERE g.id = _gid AND g.leader_id = auth.uid()) $$;
REVOKE ALL ON FUNCTION public._group_can_see(uuid), public._group_is_leader(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._group_can_see(uuid), public._group_is_leader(uuid) TO authenticated;
DROP POLICY IF EXISTS "Group parties read groups" ON public.group_purchases;
CREATE POLICY "Group parties read groups" ON public.group_purchases FOR SELECT TO authenticated USING (public._group_can_see(id));
DROP POLICY IF EXISTS "Group parties read members" ON public.group_members;
CREATE POLICY "Group parties read members" ON public.group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public._group_is_leader(group_id) OR public.has_role(auth.uid(), 'admin'));

-- 3) 할인율표: 인원수 → 즉시 할인 %
CREATE OR REPLACE FUNCTION public._group_discount_pct(_n int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _n >= 10 THEN 15 WHEN _n >= 7 THEN 12 WHEN _n >= 4 THEN 8 WHEN _n >= 2 THEN 5 ELSE 0 END::numeric $$;

-- 4) 정산: 마감 후 최종 인원 기준 할인율로 "아직 수령 확정 전인 주문"의 차액을 계산 (양수=구매자에게 환급, 음수=추가 결제 필요)
CREATE OR REPLACE FUNCTION public._group_settle(gid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; n int; pct numeric; m record; o record; gross numeric; fin numeric; diff numeric;
BEGIN
  SELECT * INTO g FROM public.group_purchases WHERE id = gid;
  IF NOT FOUND OR g.status = 'active' THEN RETURN; END IF;
  SELECT count(*) INTO n FROM public.group_members WHERE group_id = gid AND status IN ('paid','escrow_approved');
  pct := CASE WHEN g.status = 'successful' THEN public._group_discount_pct(n) ELSE 0 END;
  FOR m IN SELECT * FROM public.group_members WHERE group_id = gid AND status = 'paid' AND order_id IS NOT NULL LOOP
    SELECT product_amount_usd, group_discount_usd INTO o FROM public.orders WHERE id = m.order_id;
    gross := coalesce(o.product_amount_usd, 0) + coalesce(o.group_discount_usd, 0);
    fin := round(gross * pct / 100, 2);
    diff := round(fin - coalesce(o.group_discount_usd, 0), 2);
    IF diff IS DISTINCT FROM m.refund_due_usd THEN
      UPDATE public.group_members SET refund_due_usd = diff WHERE id = m.id;
      IF diff > 0 THEN
        INSERT INTO public.notifications(user_id, kind, title, body, cta_label, cta_url)
        VALUES (m.user_id, 'group', '공동구매 할인율 확정 · 환급 예정', '최종 할인율 ' || pct || '%가 적용되어 $' || diff || ' 가 환급될 예정이에요. (Final group discount ' || pct || '%: $' || diff || ' will be refunded.)', '내 주문 보기', '/me?panel=orders');
      ELSIF diff < 0 THEN
        INSERT INTO public.notifications(user_id, kind, title, body, cta_label, cta_url)
        VALUES (m.user_id, 'group', '공동구매 할인율 변경', '인원이 줄어 최종 할인율이 ' || pct || '%로 확정되었어요. 차액 $' || (-diff) || ' 가 추가로 필요해요. 주문 채팅으로 안내해 드려요. (Final group discount is ' || pct || '%; $' || (-diff) || ' extra is due.)', '내 주문 보기', '/me?panel=orders');
      END IF;
    END IF;
  END LOOP;
  UPDATE public.group_purchases SET discount_tier = pct::int WHERE id = gid AND discount_tier <> pct::int;
END $$;
REVOKE ALL ON FUNCTION public._group_settle(uuid) FROM PUBLIC, anon, authenticated;

-- 5) 마감: 결제 완료 2명 이상 + 리더 결제 → 성공, 아니면 만료. 결제 안 한 참여자는 정리.
CREATE OR REPLACE FUNCTION public._group_close(gid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; paid_n int; leader_ok boolean;
BEGIN
  SELECT * INTO g FROM public.group_purchases WHERE id = gid FOR UPDATE;
  IF NOT FOUND OR g.status <> 'active' THEN RETURN; END IF;
  SELECT count(*) INTO paid_n FROM public.group_members WHERE group_id = gid AND status IN ('paid','escrow_approved');
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = g.leader_id AND status IN ('paid','escrow_approved')) INTO leader_ok;
  UPDATE public.group_members SET status = 'canceled' WHERE group_id = gid AND status = 'joined';
  UPDATE public.group_purchases SET status = CASE WHEN paid_n >= 2 AND leader_ok THEN 'successful' ELSE 'expired' END, current_size = paid_n, paid_at = now() WHERE id = gid;
  INSERT INTO public.notifications(user_id, kind, title, body, cta_label, cta_url)
  SELECT user_id, 'group', CASE WHEN paid_n >= 2 AND leader_ok THEN '공동구매 성사' ELSE '공동구매 마감' END,
         CASE WHEN paid_n >= 2 AND leader_ok THEN '최종 ' || paid_n || '명으로 공동구매가 확정됐어요.' ELSE '인원이 부족해 공동구매가 마감됐어요. 할인이 적용되지 않을 수 있어요.' END, '내 공동구매 보기', '/me'
  FROM public.group_members WHERE group_id = gid AND status IN ('paid','escrow_approved');
  PERFORM public._group_settle(gid);
END $$;
REVOKE ALL ON FUNCTION public._group_close(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._group_expire_all() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.group_purchases WHERE status = 'active' AND expires_at <= now() LOOP PERFORM public._group_close(r.id); END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._group_expire_all() FROM PUBLIC, anon, authenticated;

-- 6) 현재 인원/할인 단계 갱신 + 닫을 조건 확인
CREATE OR REPLACE FUNCTION public._group_eval(gid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; n int; paid_n int; leader_ok boolean;
BEGIN
  SELECT * INTO g FROM public.group_purchases WHERE id = gid FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF g.status = 'active' THEN
    SELECT count(*) INTO n FROM public.group_members WHERE group_id = gid AND status <> 'canceled';
    SELECT count(*) INTO paid_n FROM public.group_members WHERE group_id = gid AND status IN ('paid','escrow_approved');
    SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = g.leader_id AND status IN ('paid','escrow_approved')) INTO leader_ok;
    UPDATE public.group_purchases SET current_size = n, discount_tier = public._group_discount_pct(n)::int WHERE id = gid;
    IF g.expires_at <= now() OR (paid_n >= g.target_size AND leader_ok) THEN PERFORM public._group_close(gid); END IF;
  ELSE
    PERFORM public._group_settle(gid);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._group_eval(uuid) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.create_group(uuid,int,int);
DROP FUNCTION IF EXISTS public.group_checkout_quote(uuid,text);
-- 7) 공동구매 만들기 (인원 2~10, 시간 1~72시간 — 기본 72시간)
CREATE OR REPLACE FUNCTION public.create_group(_product text, _size int, _hours int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p record; existing uuid; gid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _size IS NULL OR _size < 2 OR _size > 10 THEN RAISE EXCEPTION 'Group size must be 2 to 10'; END IF;
  IF _hours IS NULL OR _hours < 1 OR _hours > 72 THEN RAISE EXCEPTION 'Time limit must be 1 to 72 hours'; END IF;
  PERFORM public._group_expire_all();
  SELECT id, user_id, price, product_status INTO p FROM public.posts WHERE id = _product;
  IF NOT FOUND OR p.price IS NULL OR p.price <= 0 THEN RAISE EXCEPTION 'This product cannot be bought as a group'; END IF;
  IF coalesce(p.product_status, '') = 'OUT_OF_STOCK' THEN RAISE EXCEPTION 'This product is out of stock'; END IF;
  IF p.user_id = uid THEN RAISE EXCEPTION 'You cannot start a group for your own product'; END IF;
  SELECT id INTO existing FROM public.group_purchases WHERE leader_id = uid AND product_id = _product AND status = 'active' LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  IF (SELECT count(*) FROM public.group_purchases WHERE leader_id = uid AND status = 'active') >= 5 THEN RAISE EXCEPTION 'Too many active groups'; END IF;
  INSERT INTO public.group_purchases(leader_id, product_id, target_size, duration_hours, expires_at)
  VALUES (uid, _product, _size, _hours, now() + make_interval(hours => _hours)) RETURNING id INTO gid;
  INSERT INTO public.group_members(group_id, user_id) VALUES (gid, uid);
  RETURN gid;
END $$;
REVOKE ALL ON FUNCTION public.create_group(text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(text,int,int) TO authenticated;

-- 8) 가입/로그인 직후 자동 참여 (링크를 클릭해 저장된 group_id 로)
CREATE OR REPLACE FUNCTION public.claim_group(_id text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); gid uuid; g public.group_purchases; m public.group_members;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  BEGIN gid := _id::uuid; EXCEPTION WHEN others THEN RETURN 'invalid'; END;
  PERFORM public._group_expire_all();
  SELECT * INTO g FROM public.group_purchases WHERE id = gid;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  IF g.status <> 'active' OR g.expires_at <= now() THEN RETURN 'closed'; END IF;
  IF g.leader_id = uid THEN RETURN 'leader'; END IF;
  SELECT * INTO m FROM public.group_members WHERE group_id = gid AND user_id = uid;
  IF FOUND THEN RETURN 'already'; END IF;
  IF g.current_size >= g.target_size THEN RETURN 'full'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members mm JOIN public.group_purchases gg ON gg.id = mm.group_id WHERE mm.user_id = uid AND mm.status <> 'canceled' AND gg.status = 'active' AND gg.product_id = g.product_id) THEN RETURN 'other_group'; END IF;
  INSERT INTO public.group_members(group_id, user_id) VALUES (gid, uid);
  PERFORM public._group_eval(gid);
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.claim_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_group(text) TO authenticated;

-- 9) 체크아웃 견적: 이 상품을 지금 사면 적용되는 할인율
CREATE OR REPLACE FUNCTION public.group_checkout_quote(_product text, _group text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); g public.group_purchases; m public.group_members; gid uuid; n int;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  PERFORM public._group_expire_all();
  IF _group IS NOT NULL THEN BEGIN gid := _group::uuid; EXCEPTION WHEN others THEN gid := NULL; END; END IF;
  IF gid IS NOT NULL THEN SELECT * INTO g FROM public.group_purchases WHERE id = gid AND product_id = _product AND status = 'active' AND expires_at > now(); END IF;
  IF g.id IS NULL THEN
    SELECT gp.* INTO g FROM public.group_purchases gp JOIN public.group_members mm ON mm.group_id = gp.id
      WHERE mm.user_id = uid AND mm.status = 'joined' AND gp.status = 'active' AND gp.expires_at > now() AND gp.product_id = _product ORDER BY gp.created_at LIMIT 1;
  END IF;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO m FROM public.group_members WHERE group_id = g.id AND user_id = uid;
  IF FOUND THEN
    IF m.status <> 'joined' THEN RETURN NULL; END IF;
    n := g.current_size;
  ELSE
    IF g.current_size >= g.target_size THEN RETURN NULL; END IF;
    n := g.current_size + 1;
  END IF;
  RETURN jsonb_build_object('group_id', g.id, 'pct', public._group_discount_pct(n), 'current_size', g.current_size, 'target_size', g.target_size, 'expires_at', g.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.group_checkout_quote(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_checkout_quote(text,text) TO authenticated;

-- 10) 공개 그룹 정보 (링크로 들어온 방문자용)
CREATE OR REPLACE FUNCTION public.group_public(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; p record; nick text;
BEGIN
  PERFORM public._group_expire_all();
  SELECT * INTO g FROM public.group_purchases WHERE id = _id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT title, price, thumbnail_url INTO p FROM public.posts WHERE id = g.product_id;
  SELECT nickname INTO nick FROM public.profiles WHERE user_id = g.leader_id;
  RETURN jsonb_build_object('id', g.id, 'product_id', g.product_id, 'title', p.title, 'price', p.price, 'image', p.thumbnail_url,
    'leader', coalesce(nick, ''), 'target_size', g.target_size, 'current_size', g.current_size, 'status', g.status,
    'expires_at', g.expires_at, 'discount_pct', public._group_discount_pct(g.current_size), 'max_pct', public._group_discount_pct(g.target_size));
END $$;
REVOKE ALL ON FUNCTION public.group_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_public(uuid) TO anon, authenticated;

-- 11) 주문 생성 시: 그룹 연결 + 할인 검증. (포인트 적립 제거는 아래 별도 트리거)
CREATE OR REPLACE FUNCTION public.group_order_before() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; m public.group_members; ok boolean := false; n int; pct numeric; p record; dmax numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.group_id := OLD.group_id; NEW.group_discount_pct := OLD.group_discount_pct; NEW.group_discount_usd := OLD.group_discount_usd;
    RETURN NEW;
  END IF;
  PERFORM public._group_expire_all();
  IF NEW.group_id IS NOT NULL THEN
    SELECT * INTO g FROM public.group_purchases WHERE id = NEW.group_id;
  ELSE
    SELECT gp.* INTO g FROM public.group_purchases gp JOIN public.group_members mm ON mm.group_id = gp.id
      WHERE mm.user_id = NEW.buyer_id AND mm.status = 'joined' AND gp.status = 'active' AND gp.product_id = NEW.post_id ORDER BY gp.created_at LIMIT 1;
  END IF;
  IF g.id IS NOT NULL AND g.status = 'active' AND g.expires_at > now() AND g.product_id IS NOT DISTINCT FROM NEW.post_id THEN
    SELECT * INTO m FROM public.group_members WHERE group_id = g.id AND user_id = NEW.buyer_id;
    IF FOUND THEN
      IF m.status = 'joined' THEN ok := true; n := g.current_size; END IF;
    ELSIF g.current_size < g.target_size THEN
      ok := true; n := g.current_size + 1;
    END IF;
  END IF;
  IF ok THEN
    pct := public._group_discount_pct(n);
    SELECT price, coalesce(box_price, 0) AS box INTO p FROM public.posts WHERE id = NEW.post_id;
    dmax := round((coalesce(p.price, 0) + p.box) * pct / 100, 2);
    IF coalesce(NEW.group_discount_usd, 0) > dmax + 0.01 THEN RAISE EXCEPTION 'The group discount has changed. Please try again.'; END IF;
    IF NEW.amount_usd + coalesce(NEW.group_discount_usd, 0) < coalesce(p.price, 0) - 0.01 THEN RAISE EXCEPTION 'Invalid order amount'; END IF;
    NEW.group_id := g.id; NEW.group_discount_pct := pct; NEW.group_discount_usd := coalesce(NEW.group_discount_usd, 0);
  ELSE
    IF coalesce(NEW.group_discount_usd, 0) > 0 THEN RAISE EXCEPTION 'This group purchase is no longer available'; END IF;
    NEW.group_id := NULL; NEW.group_discount_pct := NULL; NEW.group_discount_usd := 0;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_yy_group ON public.orders;
CREATE TRIGGER orders_yy_group BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.group_order_before();

-- 공동구매 주문은 포인트 적립 없음: 기본 적립 트리거(orders_zz_loyalty) 뒤에 적립률을 0으로 만든다.
CREATE OR REPLACE FUNCTION public.group_order_no_points() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.group_id IS NOT NULL THEN NEW.points_earn_rate := 0; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_zzy_group_pts ON public.orders;
CREATE TRIGGER orders_zzy_group_pts BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.group_order_no_points();

-- 12) 주문 변경 → 멤버 상태/정산 동기화
CREATE OR REPLACE FUNCTION public.group_order_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; mem public.group_members; dead boolean; rc int;
BEGIN
  IF NEW.group_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO g FROM public.group_purchases WHERE id = NEW.group_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    UPDATE public.group_members SET order_id = NEW.id, status = 'paid' WHERE group_id = g.id AND user_id = NEW.buyer_id AND order_id IS NULL AND status = 'joined';
    GET DIAGNOSTICS rc = ROW_COUNT;
    IF rc = 0 THEN
      INSERT INTO public.group_members(group_id, user_id, order_id, status) VALUES (g.id, NEW.buyer_id, NEW.id, 'paid') ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;
  ELSE
    SELECT * INTO mem FROM public.group_members WHERE order_id = NEW.id;
    IF FOUND THEN
      dead := NEW.cancelled_at IS NOT NULL OR coalesce(NEW.refunded_amount_usd, 0) > 0;
      IF dead AND mem.status <> 'canceled' THEN
        UPDATE public.group_members SET status = 'canceled', refund_due_usd = 0 WHERE id = mem.id;
        IF mem.user_id = g.leader_id AND g.status <> 'expired' THEN
          UPDATE public.group_purchases SET status = 'expired', paid_at = coalesce(paid_at, now()) WHERE id = g.id;
        END IF;
      ELSIF NOT dead AND NEW.stage = 'delivered' AND NOT coalesce(NEW.dispute_open, false) AND mem.status = 'paid' THEN
        UPDATE public.group_members SET status = 'escrow_approved' WHERE id = mem.id;
      END IF;
    END IF;
  END IF;
  PERFORM public._group_eval(g.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_zzzz_group_after ON public.orders;
CREATE TRIGGER orders_zzzz_group_after AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.group_order_after();

-- 13) 1:1 추천(Type A) 보상은 공동구매 주문에는 지급하지 않는다
CREATE OR REPLACE FUNCTION public._referral_sync(o public.orders) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.loyalty_config; r public.referral_rewards; base numeric; ratio numeric; target bigint; net bigint; diff bigint; avail bigint; prod numeric;
BEGIN
  IF o.referrer_id IS NULL OR o.referrer_id = o.buyer_id OR o.group_id IS NOT NULL THEN RETURN; END IF;
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  prod := coalesce(o.product_amount_usd, o.amount_usd);
  SELECT * INTO r FROM public.referral_rewards WHERE order_id = o.id FOR UPDATE;
  IF NOT FOUND THEN
    IF o.payment_verified_at IS NULL OR o.cancelled_at IS NOT NULL OR NOT coalesce(c.points_enabled, true) THEN RETURN; END IF;
    base := greatest(prod - coalesce(o.points_discount_usd, 0), 0);
    INSERT INTO public.referral_rewards(order_id, referrer_id, referred_id, base_usd, rate_pct, points_base, points_target)
    VALUES (o.id, o.referrer_id, o.buyer_id, base, c.referral_rate_pct,
            floor(base * c.referral_rate_pct / 100 / c.point_value_usd), floor(base * c.referral_rate_pct / 100 / c.point_value_usd))
    ON CONFLICT (order_id) DO NOTHING;
    SELECT * INTO r FROM public.referral_rewards WHERE order_id = o.id FOR UPDATE;
  END IF;
  ratio := CASE WHEN prod > 0 THEN least(greatest(coalesce(o.refunded_amount_usd, 0) / prod, 0), 1) ELSE 0 END;
  target := CASE WHEN o.cancelled_at IS NOT NULL THEN 0 ELSE floor(r.points_base * (1 - ratio)) END;
  IF r.status = 'pending' THEN
    IF target <= 0 THEN
      UPDATE public.referral_rewards SET status = 'void', points_target = 0, updated_at = now() WHERE order_id = r.order_id;
    ELSIF o.stage = 'delivered' AND NOT coalesce(o.dispute_open, false) AND o.cancelled_at IS NULL THEN
      PERFORM public._loyalty_tx(r.referrer_id, o.id, 'REFERRAL', target, public._loyalty_expires(), 'SYSTEM', NULL, 'Referral bonus');
      UPDATE public.referral_rewards SET status = 'paid', points_target = target, points_paid = target, paid_at = now(), updated_at = now() WHERE order_id = r.order_id;
      INSERT INTO public.notifications(user_id, kind, title, body, cta_label, cta_url)
      VALUES (r.referrer_id, 'referral', '친구 구매 완료 · 추천 포인트 적립',
              '친구가 구매를 완료해서 ' || target || ' 포인트를 받았어요! (You earned ' || target || ' points because your friend completed a purchase!)', '내 포인트 보기', '/me?panel=wallet');
    ELSIF target <> r.points_target THEN
      UPDATE public.referral_rewards SET points_target = target, updated_at = now() WHERE order_id = r.order_id;
    END IF;
  ELSIF r.status = 'paid' THEN
    net := r.points_paid - r.points_reversed;
    IF target < net THEN
      SELECT available_points INTO avail FROM public.point_wallets WHERE user_id = r.referrer_id;
      diff := least(net - target, coalesce(avail, 0));
      IF diff > 0 THEN
        PERFORM public._loyalty_tx(r.referrer_id, o.id, 'REVERSAL', -diff, NULL, 'SYSTEM', NULL, 'Referral bonus reversed (refund)');
        UPDATE public.referral_rewards SET points_reversed = points_reversed + diff, points_target = target, updated_at = now() WHERE order_id = r.order_id;
        INSERT INTO public.notifications(user_id, kind, title, body)
        VALUES (r.referrer_id, 'referral', '추천 포인트 회수', '친구의 주문이 환불·취소되어 추천 포인트 ' || diff || ' 포인트가 회수되었어요. (Referral points were reversed because the order was refunded.)');
      END IF;
    END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._referral_sync(public.orders) FROM PUBLIC, anon, authenticated;

-- 14) 내 공동구매 현황 (참여자용) / 리더 대시보드 (참여자별 결제 상태)
CREATE OR REPLACE FUNCTION public.group_my_summary() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  PERFORM public._group_expire_all();
  RETURN jsonb_build_object('groups', coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) FROM (
    SELECT g.id, g.product_id, p.title, g.target_size, g.current_size, g.status, g.expires_at, g.created_at, g.duration_hours,
           CASE WHEN g.status = 'active' THEN public._group_discount_pct(g.current_size) ELSE g.discount_tier END AS discount_pct,
           (g.leader_id = uid) AS is_leader, m.status AS my_status, coalesce(m.refund_due_usd, 0) AS refund_due_usd
    FROM public.group_purchases g
    LEFT JOIN public.posts p ON p.id = g.product_id
    LEFT JOIN public.group_members m ON m.group_id = g.id AND m.user_id = uid
    WHERE g.leader_id = uid OR m.user_id = uid
    ORDER BY g.created_at DESC LIMIT 30) x), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.group_my_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_my_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.group_leader_detail(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); g public.group_purchases;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  PERFORM public._group_expire_all();
  SELECT * INTO g FROM public.group_purchases WHERE id = _id;
  IF NOT FOUND OR (g.leader_id <> uid AND NOT public.has_role(uid, 'admin')) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('members', coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.joined_at) FROM (
    SELECT coalesce(pr.nickname, '') AS nickname, m.status, m.joined_at, (m.user_id = g.leader_id) AS is_leader, m.refund_due_usd
    FROM public.group_members m LEFT JOIN public.profiles pr ON pr.user_id = m.user_id WHERE m.group_id = _id) x), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.group_leader_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_leader_detail(uuid) TO authenticated;
