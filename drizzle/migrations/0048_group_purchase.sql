-- 169차: 단계별 공동구매(Type B) + 포인트 사용 한도 30%
-- 기존 포인트 시스템(point_wallets / point_transactions)을 그대로 쓰고, 공동구매 테이블·지급 로직만 추가한다.

-- 1) 포인트 사용 한도 30% (기존 최대 20% 제한을 30%로) + 공동구매 설정값
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.loyalty_config'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%max_redemption_pct%' LOOP
    EXECUTE format('ALTER TABLE public.loyalty_config DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.loyalty_config ADD CONSTRAINT loyalty_config_max_redemption_pct_check CHECK (max_redemption_pct >= 0 AND max_redemption_pct <= 30);
UPDATE public.loyalty_config SET max_redemption_pct = 30 WHERE id = 1;
ALTER TABLE public.loyalty_config ADD COLUMN IF NOT EXISTS group_welcome_bonus_points bigint NOT NULL DEFAULT 1000 CHECK (group_welcome_bonus_points >= 0);
-- 공동구매 보상이 수수료(commission_rate_pct)의 몇 %까지 쓸 수 있는지 (구매자 기본 적립 포함). 100 = 수수료 전액 한도.
ALTER TABLE public.loyalty_config ADD COLUMN IF NOT EXISTS group_reward_cap_pct numeric NOT NULL DEFAULT 100 CHECK (group_reward_cap_pct >= 0 AND group_reward_cap_pct <= 100);

-- 2) 포인트 유형 추가
ALTER TABLE public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_type_check;
ALTER TABLE public.point_transactions ADD CONSTRAINT point_transactions_type_check
  CHECK (type IN ('EARN','REDEEM','REFUND','REVERSAL','EXPIRED','ADMIN_ADJUSTMENT','BONUS','REFERRAL','GROUP_BONUS','LEADER_BONUS'));
CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_group_once ON public.point_transactions(order_id, type) WHERE type IN ('GROUP_BONUS','LEADER_BONUS') AND order_id IS NOT NULL;

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
    lifetime_earned = lifetime_earned + CASE WHEN _type IN ('EARN','BONUS','REFERRAL','GROUP_BONUS','LEADER_BONUS') OR (_type = 'ADMIN_ADJUSTMENT' AND _amount > 0) THEN _amount ELSE 0 END,
    lifetime_redeemed = lifetime_redeemed + CASE WHEN _type = 'REDEEM' THEN -_amount WHEN _type = 'REFUND' THEN -_amount ELSE 0 END,
    updated_at = now() WHERE user_id = _uid;
  RETURN after_bal;
END $$;
REVOKE ALL ON FUNCTION public._loyalty_tx(uuid,uuid,text,bigint,timestamptz,text,uuid,text) FROM PUBLIC, anon, authenticated;

-- 3) 테이블
CREATE TABLE IF NOT EXISTS public.group_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL,
  product_id uuid NOT NULL,
  target_size int NOT NULL CHECK (target_size BETWEEN 2 AND 10),
  current_size int NOT NULL DEFAULT 1 CHECK (current_size >= 0),
  duration_hours int NOT NULL CHECK (duration_hours BETWEEN 1 AND 72),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','successful','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS group_purchases_leader_idx ON public.group_purchases(leader_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_purchases_product_idx ON public.group_purchases(product_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid UNIQUE,
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('joined','escrow_approved','canceled')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON public.group_members(user_id);

CREATE TABLE IF NOT EXISTS public.group_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid,
  kind text NOT NULL CHECK (kind IN ('participant','leader','welcome')),
  points_base bigint NOT NULL DEFAULT 0,
  points_paid bigint NOT NULL DEFAULT 0,
  points_reversed bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, kind)
);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS group_id uuid;
CREATE INDEX IF NOT EXISTS orders_group_idx ON public.orders(group_id) WHERE group_id IS NOT NULL;

ALTER TABLE public.group_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_rewards ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.group_purchases, public.group_members, public.group_rewards TO authenticated;
GRANT ALL ON public.group_purchases, public.group_members, public.group_rewards TO service_role;
-- 정책끼리 서로를 조회하면 무한 재귀가 나므로, 권한 확인은 SECURITY DEFINER 함수로 한다.
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
DROP POLICY IF EXISTS "Own group rewards" ON public.group_rewards;
CREATE POLICY "Own group rewards" ON public.group_rewards FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4) 등급표: 인원수 → 참여자 % / 리더 추가 %
CREATE OR REPLACE FUNCTION public._group_tier(_n int, OUT participant_pct numeric, OUT leader_pct numeric, OUT welcome boolean) LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _n >= 10 THEN 8 WHEN _n >= 7 THEN 6 WHEN _n >= 4 THEN 4 WHEN _n >= 2 THEN 2 ELSE 0 END::numeric,
         CASE WHEN _n >= 10 THEN 5 WHEN _n >= 7 THEN 3 WHEN _n >= 4 THEN 2 WHEN _n >= 2 THEN 1 ELSE 0 END::numeric,
         _n >= 10 $$;

-- 월 예산 / 총 부채 한도 안에서만 발행 (기존 구매 적립과 같은 안전장치)
CREATE OR REPLACE FUNCTION public._group_guard_points(_pts bigint) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.loyalty_config; issued_month numeric; outstanding numeric; pts bigint := _pts;
BEGIN
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  IF NOT c.points_enabled THEN RETURN 0; END IF;
  IF c.monthly_point_budget_usd > 0 THEN
    SELECT coalesce(sum(points_issued), 0) * c.point_value_usd INTO issued_month FROM public.loyalty_budget WHERE period = to_char(now(), 'YYYY-MM');
    pts := least(pts, greatest(floor((c.monthly_point_budget_usd - coalesce(issued_month, 0)) / c.point_value_usd), 0));
  END IF;
  IF c.max_outstanding_liability_usd > 0 THEN
    SELECT coalesce(sum(available_points + pending_points), 0) * c.point_value_usd INTO outstanding FROM public.point_wallets;
    pts := least(pts, greatest(floor((c.max_outstanding_liability_usd - outstanding) / c.point_value_usd), 0));
  END IF;
  RETURN greatest(pts, 0);
END $$;
REVOKE ALL ON FUNCTION public._group_guard_points(bigint) FROM PUBLIC, anon, authenticated;

-- 5) 만료 처리 (조회·생성 때마다 늦게라도 정리)
CREATE OR REPLACE FUNCTION public._group_expire_all() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.group_purchases SET status = 'expired' WHERE status = 'active' AND expires_at <= now() $$;
REVOKE ALL ON FUNCTION public._group_expire_all() FROM PUBLIC, anon, authenticated;

-- 6) 공동구매 만들기 (생성자가 인원 2~10, 시간 1~72시간 입력)
CREATE OR REPLACE FUNCTION public.create_group(_product uuid, _size int, _hours int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
REVOKE ALL ON FUNCTION public.create_group(uuid,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(uuid,int,int) TO authenticated;

-- 7) 공개 그룹 정보 (링크로 들어온 방문자용, 로그인 불필요)
CREATE OR REPLACE FUNCTION public.group_public(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; p record; nick text; t record;
BEGIN
  PERFORM public._group_expire_all();
  SELECT * INTO g FROM public.group_purchases WHERE id = _id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT title, price, thumbnail_url INTO p FROM public.posts WHERE id = g.product_id;
  SELECT nickname INTO nick FROM public.profiles WHERE user_id = g.leader_id;
  SELECT * INTO t FROM public._group_tier(g.target_size);
  RETURN jsonb_build_object('id', g.id, 'product_id', g.product_id, 'title', p.title, 'price', p.price, 'image', p.thumbnail_url,
    'leader', coalesce(nick, ''), 'target_size', g.target_size, 'current_size', g.current_size, 'status', g.status,
    'expires_at', g.expires_at, 'participant_pct', t.participant_pct, 'leader_pct', t.leader_pct, 'welcome', t.welcome);
END $$;
REVOKE ALL ON FUNCTION public.group_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_public(uuid) TO anon, authenticated;

-- 8) 주문 생성 시: 그룹 검증 (조건이 안 맞으면 조용히 일반 주문으로)
CREATE OR REPLACE FUNCTION public.group_order_before() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; m public.group_members;
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.group_id := OLD.group_id; RETURN NEW; END IF;
  IF NEW.group_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public._group_expire_all();
  SELECT * INTO g FROM public.group_purchases WHERE id = NEW.group_id;
  IF NOT FOUND OR g.status <> 'active' OR g.expires_at <= now() OR g.product_id IS DISTINCT FROM NEW.post_id THEN NEW.group_id := NULL; RETURN NEW; END IF;
  SELECT * INTO m FROM public.group_members WHERE group_id = g.id AND user_id = NEW.buyer_id;
  IF FOUND THEN
    -- 이미 참여한 사람: 리더의 첫 주문만 허용 (본인 슬롯)
    IF NEW.buyer_id <> g.leader_id OR m.order_id IS NOT NULL THEN NEW.group_id := NULL; END IF;
  ELSIF g.current_size >= g.target_size THEN
    NEW.group_id := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_zzy_group ON public.orders;
CREATE TRIGGER orders_zzy_group BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.group_order_before();

-- 9) 지급 (모든 멤버가 에스크로 승인되면 1회)
CREATE OR REPLACE FUNCTION public._group_payout(gid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; c public.loyalty_config; t record; n int; m record; o public.orders; base numeric; pp numeric; lp numeric; tot numeric; capp numeric; pts bigint; lpts bigint; wel bigint;
BEGIN
  SELECT * INTO g FROM public.group_purchases WHERE id = gid FOR UPDATE;
  IF g.paid_at IS NOT NULL THEN RETURN; END IF;
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  SELECT count(*) INTO n FROM public.group_members WHERE group_id = gid AND status <> 'canceled';
  IF n < 2 THEN UPDATE public.group_purchases SET status = 'expired', paid_at = now() WHERE id = gid; RETURN; END IF;
  SELECT * INTO t FROM public._group_tier(n);
  FOR m IN SELECT * FROM public.group_members WHERE group_id = gid AND status = 'escrow_approved' ORDER BY joined_at LOOP
    SELECT * INTO o FROM public.orders WHERE id = m.order_id;
    base := greatest(coalesce(o.product_amount_usd, o.amount_usd) - coalesce(o.points_discount_usd, 0), 0);  -- 실제 결제한 상품금액
    pp := t.participant_pct; lp := CASE WHEN m.user_id = g.leader_id THEN t.leader_pct ELSE 0 END; tot := pp + lp;
    -- 수수료 안전 한도: 구매자 기본 적립을 뺀 나머지 안에서만 지급
    capp := greatest(c.commission_rate_pct * c.group_reward_cap_pct / 100 - coalesce(o.points_earn_rate, 0) * 100, 0);
    IF tot > capp AND tot > 0 THEN pp := pp * capp / tot; lp := lp * capp / tot; END IF;
    pts := public._group_guard_points(floor(base * pp / 100 / c.point_value_usd)::bigint);
    IF pts > 0 THEN
      PERFORM public._loyalty_tx(m.user_id, o.id, 'GROUP_BONUS', pts, public._loyalty_expires(), 'SYSTEM', NULL, 'Group purchase bonus (' || n || ' members)');
      PERFORM public._loyalty_budget_add(pts, 0, 0);
      INSERT INTO public.group_rewards(group_id, user_id, order_id, kind, points_base, points_paid) VALUES (gid, m.user_id, o.id, 'participant', pts, pts) ON CONFLICT DO NOTHING;
      INSERT INTO public.notifications(user_id, kind, title, body, cta_label, cta_url)
      VALUES (m.user_id, 'group', '공동구매 완료 · 포인트 적립', '공동구매가 완료되어 ' || pts || ' 포인트를 받았어요! (You earned ' || pts || ' points because your group purchase completed!)', '내 포인트 보기', '/me?panel=wallet');
    END IF;
    IF lp > 0 THEN
      lpts := public._group_guard_points(floor(base * lp / 100 / c.point_value_usd)::bigint);
      IF lpts > 0 THEN
        PERFORM public._loyalty_tx(m.user_id, o.id, 'LEADER_BONUS', lpts, public._loyalty_expires(), 'SYSTEM', NULL, 'Group leader bonus');
        PERFORM public._loyalty_budget_add(lpts, 0, 0);
        INSERT INTO public.group_rewards(group_id, user_id, order_id, kind, points_base, points_paid) VALUES (gid, m.user_id, o.id, 'leader', lpts, lpts) ON CONFLICT DO NOTHING;
        INSERT INTO public.notifications(user_id, kind, title, body, cta_label, cta_url)
        VALUES (m.user_id, 'group', '리더 보너스 적립', '공동구매 리더 보너스 ' || lpts || ' 포인트가 적립되었어요! (Group leader bonus: ' || lpts || ' points)', '내 포인트 보기', '/me?panel=wallet');
      END IF;
    END IF;
    IF t.welcome AND c.group_welcome_bonus_points > 0 THEN
      wel := public._group_guard_points(c.group_welcome_bonus_points);
      IF wel > 0 THEN
        PERFORM public._loyalty_tx(m.user_id, NULL, 'BONUS', wel, public._loyalty_expires(), 'SYSTEM', NULL, 'Group welcome bonus (10 members)');
        PERFORM public._loyalty_budget_add(wel, 0, 0);
        INSERT INTO public.group_rewards(group_id, user_id, order_id, kind, points_base, points_paid) VALUES (gid, m.user_id, o.id, 'welcome', wel, wel) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;
  UPDATE public.group_purchases SET paid_at = now() WHERE id = gid;
END $$;
REVOKE ALL ON FUNCTION public._group_payout(uuid) FROM PUBLIC, anon, authenticated;

-- 10) 상태 평가: 성공 → 지급
CREATE OR REPLACE FUNCTION public._group_eval(gid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; n int; open_n int; leader_ok boolean;
BEGIN
  SELECT * INTO g FROM public.group_purchases WHERE id = gid FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*) INTO n FROM public.group_members WHERE group_id = gid AND status <> 'canceled';
  UPDATE public.group_purchases SET current_size = n WHERE id = gid AND current_size <> n;
  IF g.status = 'active' THEN
    SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = g.leader_id AND order_id IS NOT NULL AND status <> 'canceled') INTO leader_ok;
    IF n >= g.target_size AND leader_ok THEN
      UPDATE public.group_purchases SET status = 'successful' WHERE id = gid;
      INSERT INTO public.notifications(user_id, kind, title, body, cta_label, cta_url)
      SELECT user_id, 'group', '공동구매 인원이 모두 모였어요', '모두 수령 확정을 하면 포인트가 지급돼요.', '내 공동구매 보기', '/me?panel=wallet' FROM public.group_members WHERE group_id = gid AND status <> 'canceled';
      g.status := 'successful';
    ELSIF g.expires_at <= now() THEN
      UPDATE public.group_purchases SET status = 'expired' WHERE id = gid;
    END IF;
  END IF;
  IF g.status = 'successful' AND g.paid_at IS NULL THEN
    SELECT count(*) INTO open_n FROM public.group_members WHERE group_id = gid AND status = 'joined';
    IF open_n = 0 THEN PERFORM public._group_payout(gid); END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._group_eval(uuid) FROM PUBLIC, anon, authenticated;

-- 11) 지급 후 환불/취소 회수
CREATE OR REPLACE FUNCTION public._group_reverse(o public.orders) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.group_rewards; prod numeric; ratio numeric; target bigint; net bigint; diff bigint; avail bigint;
BEGIN
  prod := coalesce(o.product_amount_usd, o.amount_usd);
  ratio := CASE WHEN prod > 0 THEN least(greatest(coalesce(o.refunded_amount_usd, 0) / prod, 0), 1) ELSE 0 END;
  FOR r IN SELECT * FROM public.group_rewards WHERE order_id = o.id FOR UPDATE LOOP
    target := CASE WHEN o.cancelled_at IS NOT NULL THEN 0 ELSE floor(r.points_base * (1 - ratio)) END;
    net := r.points_paid - r.points_reversed;
    IF target < net THEN
      SELECT available_points INTO avail FROM public.point_wallets WHERE user_id = r.user_id;
      diff := least(net - target, coalesce(avail, 0));
      IF diff > 0 THEN
        PERFORM public._loyalty_tx(r.user_id, NULL, 'REVERSAL', -diff, NULL, 'SYSTEM', NULL, 'Group bonus reversed (refund)');
        UPDATE public.group_rewards SET points_reversed = points_reversed + diff WHERE id = r.id;
        INSERT INTO public.notifications(user_id, kind, title, body) VALUES (r.user_id, 'group', '공동구매 포인트 회수', '주문이 환불·취소되어 공동구매 포인트 ' || diff || ' 포인트가 회수되었어요. (Group points reversed due to a refund.)');
      END IF;
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._group_reverse(public.orders) FROM PUBLIC, anon, authenticated;

-- 12) 주문 변경 → 그룹 동기화
CREATE OR REPLACE FUNCTION public.group_order_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; mem public.group_members; dead boolean; ins int;
BEGIN
  IF NEW.group_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO g FROM public.group_purchases WHERE id = NEW.group_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.buyer_id = g.leader_id THEN
      UPDATE public.group_members SET order_id = NEW.id WHERE group_id = g.id AND user_id = g.leader_id AND order_id IS NULL;
    ELSE
      INSERT INTO public.group_members(group_id, user_id, order_id) VALUES (g.id, NEW.buyer_id, NEW.id) ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;
  END IF;
  SELECT * INTO mem FROM public.group_members WHERE order_id = NEW.id;
  IF FOUND THEN
    dead := NEW.cancelled_at IS NOT NULL OR coalesce(NEW.refunded_amount_usd, 0) > 0;
    IF dead AND mem.status <> 'canceled' AND g.paid_at IS NULL THEN
      UPDATE public.group_members SET status = 'canceled' WHERE id = mem.id;
      IF mem.user_id = g.leader_id THEN UPDATE public.group_purchases SET status = 'expired', paid_at = coalesce(paid_at, now()) WHERE id = g.id; END IF;
    ELSIF NOT dead AND NEW.stage = 'delivered' AND NOT coalesce(NEW.dispute_open, false) AND mem.status = 'joined' THEN
      UPDATE public.group_members SET status = 'escrow_approved' WHERE id = mem.id;
    END IF;
    IF g.paid_at IS NOT NULL THEN PERFORM public._group_reverse(NEW); END IF;
  END IF;
  PERFORM public._group_eval(g.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_zzzz_group_after ON public.orders;
CREATE TRIGGER orders_zzzz_group_after AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.group_order_after();

-- 13) 내 공동구매 현황
CREATE OR REPLACE FUNCTION public.group_my_summary() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  PERFORM public._group_expire_all();
  RETURN jsonb_build_object(
    'groups', coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) FROM (
      SELECT g.id, g.product_id, p.title, g.target_size, g.current_size, g.status, g.expires_at, g.created_at, g.paid_at, g.duration_hours,
             (g.leader_id = uid) AS is_leader,
             coalesce((SELECT sum(r.points_paid - r.points_reversed) FROM public.group_rewards r WHERE r.group_id = g.id AND r.user_id = uid), 0) AS reward_points
      FROM public.group_purchases g LEFT JOIN public.posts p ON p.id = g.product_id
      WHERE g.leader_id = uid OR EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = g.id AND m.user_id = uid)
      ORDER BY g.created_at DESC LIMIT 30) x), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.group_my_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_my_summary() TO authenticated;
