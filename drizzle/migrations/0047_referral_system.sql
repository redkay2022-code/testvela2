-- 165차: 추천 링크 추적 + 자동 포인트 지급 시스템
-- 흐름: 추천 링크 방문 → (가입/주문 전) 추천인 연결 → 친구 결제 확인 시 '대기' 보상 생성
--       → 친구가 수령 확정(에스크로 정산)하면 추천인에게 포인트 지급 + 알림
--       → 취소/환불/분쟁이면 지급 안 함, 지급 후 환불되면 회수

-- 1) 컬럼
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_at timestamptz;
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles(referred_by) WHERE referred_by IS NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS referrer_id uuid;
CREATE INDEX IF NOT EXISTS orders_referrer_idx ON public.orders(referrer_id) WHERE referrer_id IS NOT NULL;
ALTER TABLE public.loyalty_config ADD COLUMN IF NOT EXISTS referral_rate_pct numeric NOT NULL DEFAULT 2 CHECK (referral_rate_pct >= 0 AND referral_rate_pct <= 20);

-- 2) 포인트 유형 REFERRAL 추가 (적립 합계에도 포함)
ALTER TABLE public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_type_check;
ALTER TABLE public.point_transactions ADD CONSTRAINT point_transactions_type_check
  CHECK (type IN ('EARN','REDEEM','REFUND','REVERSAL','EXPIRED','ADMIN_ADJUSTMENT','BONUS','REFERRAL'));
CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_referral_once ON public.point_transactions(order_id) WHERE type = 'REFERRAL' AND order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._loyalty_tx(_uid uuid, _order uuid, _type text, _amount bigint, _expires timestamptz, _source text, _admin uuid, _note text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.point_wallets; after_bal bigint; need bigint; lot record; take bigint;
BEGIN
  INSERT INTO public.point_wallets(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM public.point_wallets WHERE user_id = _uid FOR UPDATE;
  after_bal := w.available_points + _amount;
  IF after_bal < 0 THEN RAISE EXCEPTION 'Insufficient points'; END IF;
  IF _amount < 0 THEN
    need := -_amount;
    FOR lot IN SELECT id, remaining FROM public.point_transactions WHERE user_id = _uid AND remaining > 0 ORDER BY expires_at NULLS LAST, created_at FOR UPDATE LOOP
      EXIT WHEN need <= 0;
      take := least(lot.remaining, need);
      UPDATE public.point_transactions SET remaining = remaining - take WHERE id = lot.id;
      need := need - take;
    END LOOP;
  END IF;
  INSERT INTO public.point_transactions(user_id, order_id, type, amount, balance_before, balance_after, remaining, expires_at, source, admin_id, note)
  VALUES (_uid, _order, _type, _amount, w.available_points, after_bal, CASE WHEN _amount > 0 THEN _amount ELSE 0 END, CASE WHEN _amount > 0 THEN _expires END, _source, _admin, _note);
  UPDATE public.point_wallets SET available_points = after_bal,
    lifetime_earned = lifetime_earned + CASE WHEN _type IN ('EARN','BONUS','REFERRAL') OR (_type = 'ADMIN_ADJUSTMENT' AND _amount > 0) THEN _amount ELSE 0 END,
    lifetime_redeemed = lifetime_redeemed + CASE WHEN _type = 'REDEEM' THEN -_amount WHEN _type = 'REFUND' THEN -_amount ELSE 0 END,
    updated_at = now() WHERE user_id = _uid;
  RETURN after_bal;
END $$;
REVOKE ALL ON FUNCTION public._loyalty_tx(uuid,uuid,text,bigint,timestamptz,text,uuid,text) FROM PUBLIC, anon, authenticated;

-- 3) 추천 보상 원장 (주문당 1건)
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  order_id uuid PRIMARY KEY,
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  base_usd numeric NOT NULL DEFAULT 0,
  rate_pct numeric NOT NULL,
  points_base bigint NOT NULL DEFAULT 0,
  points_target bigint NOT NULL DEFAULT 0,
  points_paid bigint NOT NULL DEFAULT 0,
  points_reversed bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx ON public.referral_rewards(referrer_id, created_at DESC);
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
DROP POLICY IF EXISTS "Own or admin referral rewards" ON public.referral_rewards;
CREATE POLICY "Own or admin referral rewards" ON public.referral_rewards FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4) 주문 생성 시 추천인 자동 기록 (클라이언트가 임의로 못 넣음)
CREATE OR REPLACE FUNCTION public.referral_order_before() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT p.referred_by INTO NEW.referrer_id FROM public.profiles p WHERE p.user_id = NEW.buyer_id;
    IF NEW.referrer_id IS NOT NULL AND NEW.referrer_id = NEW.buyer_id THEN NEW.referrer_id := NULL; END IF;
  ELSE
    NEW.referrer_id := OLD.referrer_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_zy_referral ON public.orders;
CREATE TRIGGER orders_zy_referral BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.referral_order_before();

-- 5) 보상 동기화: 생성 → 대기 → 지급 / 무효 / 회수 (여러 번 호출돼도 안전)
CREATE OR REPLACE FUNCTION public._referral_sync(o public.orders) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.loyalty_config; r public.referral_rewards; base numeric; ratio numeric; target bigint; net bigint; diff bigint; avail bigint; prod numeric;
BEGIN
  IF o.referrer_id IS NULL OR o.referrer_id = o.buyer_id THEN RETURN; END IF;
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  prod := coalesce(o.product_amount_usd, o.amount_usd);
  SELECT * INTO r FROM public.referral_rewards WHERE order_id = o.id FOR UPDATE;
  IF NOT FOUND THEN
    IF o.payment_verified_at IS NULL OR o.cancelled_at IS NOT NULL OR NOT coalesce(c.points_enabled, true) THEN RETURN; END IF;
    base := greatest(prod - coalesce(o.points_discount_usd, 0), 0);  -- 실제 결제한 상품금액 (배송비·세금·보험 제외)
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
              '친구가 구매를 완료해서 ' || target || ' 포인트를 받았어요! (You earned ' || target || ' points because your friend completed a purchase!)',
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

CREATE OR REPLACE FUNCTION public.referral_order_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public._referral_sync(NEW); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS orders_zzz_referral_after ON public.orders;
CREATE TRIGGER orders_zzz_referral_after AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.referral_order_after();

-- 6) 추천인 연결 (가입 직후/체크아웃 전에 호출). 본인 추천·순환 추천·이미 주문한 계정은 거부.
CREATE OR REPLACE FUNCTION public.claim_referral(_code text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ref uuid; cur uuid; n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  BEGIN ref := _code::uuid; EXCEPTION WHEN others THEN RETURN 'invalid'; END;
  IF ref = uid THEN RETURN 'self'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = ref) THEN RETURN 'unknown'; END IF;
  SELECT referred_by INTO cur FROM public.profiles WHERE user_id = ref;
  IF cur = uid THEN RETURN 'loop'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE buyer_id = uid) THEN RETURN 'has_orders'; END IF;
  UPDATE public.profiles SET referred_by = ref, referred_at = now() WHERE user_id = uid AND referred_by IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN CASE WHEN n > 0 THEN 'ok' ELSE 'already' END;
END $$;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

-- 7) 내 추천 대시보드
CREATE OR REPLACE FUNCTION public.referral_my_summary() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.loyalty_config;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  RETURN jsonb_build_object(
    'user_id', uid,
    'rate_pct', c.referral_rate_pct,
    'referred_users', (SELECT count(*) FROM public.profiles WHERE referred_by = uid),
    'completed_sales', (SELECT count(*) FROM public.referral_rewards WHERE referrer_id = uid AND status = 'paid' AND points_paid - points_reversed > 0),
    'earned_points', coalesce((SELECT sum(points_paid - points_reversed) FROM public.referral_rewards WHERE referrer_id = uid), 0),
    'pending_points', coalesce((SELECT sum(points_target) FROM public.referral_rewards WHERE referrer_id = uid AND status = 'pending'), 0),
    'pending_orders', (SELECT count(*) FROM public.referral_rewards WHERE referrer_id = uid AND status = 'pending' AND points_target > 0));
END $$;
REVOKE ALL ON FUNCTION public.referral_my_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_my_summary() TO authenticated;
