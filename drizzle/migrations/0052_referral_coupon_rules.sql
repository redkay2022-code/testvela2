-- 185차: 추천 코드(원할 때 생성) · 가입 환영 쿠폰 5% · 추천 적립 5% · 추천 포인트는 $500 이상 주문에만 사용 · 적립 후 365일 만료
-- 이 파일은 여러 번 실행해도 안전합니다. (0047~0051 적용 후 실행)

-- 1) 컬럼 · 설정
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;
ALTER TABLE public.loyalty_config ADD COLUMN IF NOT EXISTS referral_min_order_usd numeric NOT NULL DEFAULT 500 CHECK (referral_min_order_usd >= 0);
ALTER TABLE public.loyalty_config ADD COLUMN IF NOT EXISTS referral_expiry_days int NOT NULL DEFAULT 365 CHECK (referral_expiry_days BETWEEN 1 AND 3650);
ALTER TABLE public.loyalty_config ALTER COLUMN referral_rate_pct SET DEFAULT 5;
UPDATE public.loyalty_config SET referral_rate_pct = 5 WHERE id = 1 AND referral_rate_pct <> 5;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount_usd numeric NOT NULL DEFAULT 0 CHECK (coupon_discount_usd >= 0);

-- 2) 쿠폰 (가입 환영 5%, 1인 1장, 90일, 공동구매 주문에는 사용 불가)
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'WELCOME' CHECK (kind IN ('WELCOME')),
  pct numeric NOT NULL DEFAULT 5 CHECK (pct > 0 AND pct <= 50),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
  expires_at timestamptz NOT NULL,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_one_per_user_kind ON public.coupons(user_id, kind);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
DROP POLICY IF EXISTS "Own coupons" ON public.coupons;
CREATE POLICY "Own coupons" ON public.coupons FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- (이미 발급된 사용 가능 쿠폰도 5% · 90일로 맞춘다)
UPDATE public.coupons SET pct = 5 WHERE status = 'active' AND pct <> 5;
UPDATE public.coupons SET expires_at = created_at + interval '90 days' WHERE status = 'active' AND expires_at < created_at + interval '90 days';

CREATE OR REPLACE FUNCTION public._welcome_coupon_grant(_uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.coupons(user_id, kind, pct, expires_at) VALUES (_uid, 'WELCOME', 5, now() + interval '90 days') ON CONFLICT (user_id, kind) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    INSERT INTO public.notifications(user_id, kind, title, body, cta_label, cta_url)
    VALUES (_uid, 'coupon', '가입 환영 쿠폰 5% 도착', '첫 주문에 쓸 수 있는 5% 할인 쿠폰이 발급됐어요. 90일 안에 사용해 주세요. 공동구매 주문에는 함께 쓸 수 없어요. (Your 5% welcome coupon is ready — valid for 90 days, not combinable with group purchases.)', '쿠폰 보기', '/me');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._welcome_coupon_grant(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_welcome_coupon() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.coupons;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.coupons SET status = 'expired' WHERE user_id = uid AND status = 'active' AND expires_at <= now();
  SELECT * INTO c FROM public.coupons WHERE user_id = uid AND kind = 'WELCOME';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', c.id, 'pct', c.pct, 'status', c.status, 'expires_at', c.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.my_welcome_coupon() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_welcome_coupon() TO authenticated;

-- 3) 추천 코드 (원할 때 생성). 기존 /ref/<사용자ID> 링크도 계속 동작한다.
CREATE OR REPLACE FUNCTION public.generate_referral_code() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); code text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; tries int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT referral_code INTO code FROM public.profiles WHERE user_id = uid;
  IF code IS NOT NULL THEN RETURN code; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = uid) THEN RAISE EXCEPTION 'Profile not found'; END IF;
  LOOP
    code := '';
    FOR i IN 1..8 LOOP code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); END LOOP;
    BEGIN
      UPDATE public.profiles SET referral_code = code WHERE user_id = uid AND referral_code IS NULL;
      SELECT referral_code INTO code FROM public.profiles WHERE user_id = uid;
      RETURN code;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 20 THEN RAISE EXCEPTION 'Could not generate a code'; END IF;
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated;

CREATE OR REPLACE FUNCTION public._referral_resolve(_code text) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := btrim(coalesce(_code, '')); r uuid;
BEGIN
  IF c = '' THEN RETURN NULL; END IF;
  IF c ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN c::uuid; END IF;
  SELECT user_id INTO r FROM public.profiles WHERE referral_code = upper(c);
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public._referral_resolve(text) FROM PUBLIC, anon, authenticated;

-- 가입/로그인 직후 추천 연결 (코드 또는 사용자ID). 처음 연결되면 5% 환영 쿠폰을 준다.
CREATE OR REPLACE FUNCTION public._referral_claim(_uid uuid, _code text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref uuid; cur uuid; n int;
BEGIN
  IF _uid IS NULL THEN RETURN 'invalid'; END IF;
  ref := public._referral_resolve(_code);
  IF ref IS NULL THEN RETURN 'invalid'; END IF;
  IF ref = _uid THEN RETURN 'self'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = ref) THEN RETURN 'unknown'; END IF;
  SELECT referred_by INTO cur FROM public.profiles WHERE user_id = ref;
  IF cur = _uid THEN RETURN 'loop'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE buyer_id = _uid) THEN RETURN 'has_orders'; END IF;
  UPDATE public.profiles SET referred_by = ref, referred_at = now() WHERE user_id = _uid AND referred_by IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN PERFORM public._welcome_coupon_grant(_uid); END IF;
  RETURN CASE WHEN n > 0 THEN 'ok' ELSE 'already' END;
END $$;
REVOKE ALL ON FUNCTION public._referral_claim(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._referral_claim(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_referral(_code text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  RETURN public._referral_claim(uid, _code);
END $$;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

-- 4) 추천 포인트: 적립 후 365일 만료 (적립 시점에 만료일 기록)
CREATE OR REPLACE FUNCTION public._referral_sync(o public.orders) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.loyalty_config; r public.referral_rewards; base numeric; ratio numeric; target bigint; net bigint; diff bigint; avail bigint; prod numeric;
BEGIN
  IF o.referrer_id IS NULL OR o.referrer_id = o.buyer_id THEN RETURN; END IF;
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  prod := coalesce(o.product_amount_usd, o.amount_usd);
  SELECT * INTO r FROM public.referral_rewards WHERE order_id = o.id FOR UPDATE;
  IF NOT FOUND THEN
    IF o.payment_verified_at IS NULL OR o.cancelled_at IS NOT NULL OR NOT coalesce(c.points_enabled, true) THEN RETURN; END IF;
    base := greatest(prod - coalesce(o.points_discount_usd, 0), 0);  -- 실제 결제한 상품금액 (할인·쿠폰이 이미 빠진 금액, 배송비·세금·보험 제외)
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
      PERFORM public._loyalty_tx(r.referrer_id, o.id, 'REFERRAL', target, now() + make_interval(days => c.referral_expiry_days), 'SYSTEM', NULL, 'Referral bonus');
      UPDATE public.referral_rewards SET status = 'paid', points_target = target, points_paid = target, paid_at = now(), updated_at = now() WHERE order_id = r.order_id;
      INSERT INTO public.notifications(user_id, kind, title, body, cta_label, cta_url)
      VALUES (r.referrer_id, 'referral', '친구 구매 완료 · 추천 포인트 적립',
              '친구가 구매를 완료해서 ' || target || ' 포인트를 받았어요! $' || trim(to_char(c.referral_min_order_usd, 'FM999999990')) || ' 이상 주문에 ' || c.referral_expiry_days || '일 안에 쓸 수 있어요. (You earned ' || target || ' points — usable on orders of $' || trim(to_char(c.referral_min_order_usd, 'FM999999990')) || '+ within ' || c.referral_expiry_days || ' days.)',
              '내 포인트 보기', '/me?panel=wallet');
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

-- 5) 포인트 차감 시: $500 미만 주문에서는 추천 포인트 묶음을 건드리지 않는다 (세션 설정 vela.skip_referral_lots)
CREATE OR REPLACE FUNCTION public._loyalty_tx(_uid uuid, _order uuid, _type text, _amount bigint, _expires timestamptz, _source text, _admin uuid, _note text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.point_wallets; after_bal bigint; need bigint; lot record; take bigint; skip_ref boolean := coalesce(current_setting('vela.skip_referral_lots', true), 'off') = 'on';
BEGIN
  INSERT INTO public.point_wallets(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM public.point_wallets WHERE user_id = _uid FOR UPDATE;
  after_bal := w.available_points + _amount;
  IF after_bal < 0 THEN RAISE EXCEPTION 'Insufficient points'; END IF;
  IF _amount < 0 THEN
    need := -_amount;
    FOR lot IN SELECT id, remaining FROM public.point_transactions WHERE user_id = _uid AND remaining > 0 AND (NOT skip_ref OR type <> 'REFERRAL') ORDER BY expires_at NULLS LAST, created_at FOR UPDATE LOOP
      EXIT WHEN need <= 0;
      take := least(lot.remaining, need);
      UPDATE public.point_transactions SET remaining = remaining - take WHERE id = lot.id;
      need := need - take;
    END LOOP;
  END IF;
  INSERT INTO public.point_transactions(user_id, order_id, type, amount, balance_before, balance_after, remaining, expires_at, source, admin_id, note)
  VALUES (_uid, _order, _type, _amount, w.available_points, after_bal, CASE WHEN _amount > 0 THEN _amount ELSE 0 END, CASE WHEN _amount > 0 THEN _expires END, _source, _admin, _note);
  UPDATE public.point_wallets SET available_points = after_bal,
    lifetime_earned = lifetime_earned + CASE WHEN _type IN ('EARN','BONUS','REFERRAL','GROUP_BONUS','LEADER_BONUS') OR (_type = 'ADMIN_ADJUSTMENT' AND _amount > 0) THEN _amount ELSE 0 END,
    lifetime_redeemed = lifetime_redeemed + CASE WHEN _type = 'REDEEM' THEN -_amount WHEN _type = 'REFUND' THEN -_amount ELSE 0 END,
    updated_at = now() WHERE user_id = _uid;
  RETURN after_bal;
END $$;
REVOKE ALL ON FUNCTION public._loyalty_tx(uuid,uuid,text,bigint,timestamptz,text,uuid,text) FROM PUBLIC, anon, authenticated;

-- 6) 주문 생성 전 검사 (트리거 이름 순서: orders_yy_group → orders_yz_coupon → orders_zy_refpoints → orders_zz_loyalty)
-- 6-1) 쿠폰: 본인 소유 · 사용 가능 · 공동구매 주문과 중복 불가 · 할인액 상한 검증 후 사용 처리
CREATE OR REPLACE FUNCTION public.coupon_order_before() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.coupons; p record; dmax numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.coupon_id := OLD.coupon_id; NEW.coupon_discount_usd := OLD.coupon_discount_usd;
    RETURN NEW;
  END IF;
  IF NEW.coupon_id IS NULL THEN NEW.coupon_discount_usd := 0; RETURN NEW; END IF;
  IF NEW.group_id IS NOT NULL THEN RAISE EXCEPTION 'The welcome coupon cannot be combined with a group purchase'; END IF;
  SELECT * INTO c FROM public.coupons WHERE id = NEW.coupon_id AND user_id = NEW.buyer_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'active' OR c.expires_at <= now() THEN RAISE EXCEPTION 'This coupon is not available'; END IF;
  SELECT price, coalesce(box_price, 0) AS box INTO p FROM public.posts WHERE id = NEW.post_id;
  dmax := round((coalesce(p.price, 0) + p.box) * c.pct / 100, 2);
  IF coalesce(NEW.coupon_discount_usd, 0) > dmax + 0.01 THEN RAISE EXCEPTION 'The coupon discount has changed. Please try again.'; END IF;
  IF NEW.amount_usd + coalesce(NEW.coupon_discount_usd, 0) < coalesce(p.price, 0) - 0.01 THEN RAISE EXCEPTION 'Invalid order amount'; END IF;
  NEW.coupon_discount_usd := coalesce(NEW.coupon_discount_usd, 0);
  UPDATE public.coupons SET status = 'used', used_at = now(), order_id = NEW.id WHERE id = c.id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_yz_coupon ON public.orders;
CREATE TRIGGER orders_yz_coupon BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.coupon_order_before();

-- 6-2) 추천 포인트: 상품금액이 최소금액($500) 미만이면 추천 포인트는 쓸 수 없다
CREATE OR REPLACE FUNCTION public.referral_points_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.loyalty_config; post_total numeric; prod numeric; refpts bigint; avail bigint;
BEGIN
  PERFORM set_config('vela.skip_referral_lots', 'off', true);
  IF TG_OP <> 'INSERT' OR coalesce(NEW.points_redeemed, 0) <= 0 THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  SELECT price + coalesce(box_price, 0) INTO post_total FROM public.posts WHERE id = NEW.post_id;
  prod := round(least(coalesce(NEW.product_amount_usd, NEW.amount_usd), coalesce(post_total, NEW.amount_usd), NEW.amount_usd), 2);
  IF prod >= c.referral_min_order_usd THEN RETURN NEW; END IF;
  PERFORM public.loyalty_expire_user(NEW.buyer_id);
  SELECT coalesce(sum(remaining), 0) INTO refpts FROM public.point_transactions WHERE user_id = NEW.buyer_id AND type = 'REFERRAL' AND remaining > 0 AND (expires_at IS NULL OR expires_at > now());
  SELECT available_points INTO avail FROM public.point_wallets WHERE user_id = NEW.buyer_id;
  IF NEW.points_redeemed > coalesce(avail, 0) - refpts THEN
    RAISE EXCEPTION 'Referral points can only be used on orders of $% or more', trim(to_char(c.referral_min_order_usd, 'FM999999990'));
  END IF;
  PERFORM set_config('vela.skip_referral_lots', 'on', true);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_zy_refpoints ON public.orders;
CREATE TRIGGER orders_zy_refpoints BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.referral_points_guard();

-- 6-3) 주문 후: 설정 원복 + 주문이 취소되면 쿠폰을 되돌려준다 (기간이 남아 있을 때만)
CREATE OR REPLACE FUNCTION public.coupon_order_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('vela.skip_referral_lots', 'off', true);
  IF TG_OP = 'UPDATE' AND NEW.coupon_id IS NOT NULL AND NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL THEN
    UPDATE public.coupons SET status = CASE WHEN expires_at > now() THEN 'active' ELSE 'expired' END, used_at = NULL, order_id = NULL
      WHERE id = NEW.coupon_id AND status = 'used' AND order_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_zzzzz_coupon_after ON public.orders;
CREATE TRIGGER orders_zzzzz_coupon_after AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.coupon_order_after();

-- 7) 내 추천 요약 (코드 · 규칙 · 쿠폰 포함)
CREATE OR REPLACE FUNCTION public.referral_my_summary() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.loyalty_config; code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  SELECT referral_code INTO code FROM public.profiles WHERE user_id = uid;
  RETURN jsonb_build_object(
    'user_id', uid,
    'referral_code', code,
    'rate_pct', c.referral_rate_pct,
    'min_order_usd', c.referral_min_order_usd,
    'expiry_days', c.referral_expiry_days,
    'referred_users', (SELECT count(*) FROM public.profiles WHERE referred_by = uid),
    'completed_sales', (SELECT count(*) FROM public.referral_rewards WHERE referrer_id = uid AND status = 'paid' AND points_paid - points_reversed > 0),
    'earned_points', coalesce((SELECT sum(points_paid - points_reversed) FROM public.referral_rewards WHERE referrer_id = uid), 0),
    'pending_points', coalesce((SELECT sum(points_target) FROM public.referral_rewards WHERE referrer_id = uid AND status = 'pending'), 0),
    'pending_orders', (SELECT count(*) FROM public.referral_rewards WHERE referrer_id = uid AND status = 'pending' AND points_target > 0));
END $$;
REVOKE ALL ON FUNCTION public.referral_my_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_my_summary() TO authenticated;
