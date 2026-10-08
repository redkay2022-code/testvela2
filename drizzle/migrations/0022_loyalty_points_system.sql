
CREATE TABLE public.loyalty_settings (
  tier text PRIMARY KEY CHECK (tier IN ('bronze','silver','gold','platinum')),
  sort_order int NOT NULL,
  spend_min numeric NOT NULL,
  spend_max numeric,
  insurance_rate numeric NOT NULL,
  insurance_discount numeric NOT NULL,
  earn_rate numeric NOT NULL CHECK (earn_rate >= 0 AND earn_rate <= 0.2),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.loyalty_settings VALUES
 ('bronze',1,0,2500,0.10,0,0.01,now()),
 ('silver',2,2500,6000,0.07,0.30,0.015,now()),
 ('gold',3,6000,12000,0.05,0.50,0.02,now()),
 ('platinum',4,12000,NULL,0.03,0.70,0.03,now());

CREATE TABLE public.loyalty_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  point_value_usd numeric NOT NULL DEFAULT 0.001 CHECK (point_value_usd > 0),
  max_redemption_pct numeric NOT NULL DEFAULT 20 CHECK (max_redemption_pct >= 0 AND max_redemption_pct <= 20),
  expiration_months int NOT NULL DEFAULT 12 CHECK (expiration_months BETWEEN 1 AND 60),
  commission_rate_pct numeric NOT NULL DEFAULT 10 CHECK (commission_rate_pct >= 0 AND commission_rate_pct <= 100),
  loyalty_budget_pct numeric NOT NULL DEFAULT 30 CHECK (loyalty_budget_pct >= 0 AND loyalty_budget_pct <= 100),
  max_earn_rate_pct numeric NOT NULL DEFAULT 3 CHECK (max_earn_rate_pct >= 0 AND max_earn_rate_pct <= 20),
  monthly_point_budget_usd numeric NOT NULL DEFAULT 0,
  max_outstanding_liability_usd numeric NOT NULL DEFAULT 0,
  points_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.loyalty_config (id) VALUES (1);

CREATE TABLE public.memberships (
  user_id uuid PRIMARY KEY,
  tier text NOT NULL DEFAULT 'bronze',
  rolling_12_month_spend numeric NOT NULL DEFAULT 0,
  tier_start_date timestamptz NOT NULL DEFAULT now(),
  tier_end_date timestamptz NOT NULL DEFAULT now() + interval '12 months',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.point_wallets (
  user_id uuid PRIMARY KEY,
  available_points bigint NOT NULL DEFAULT 0 CHECK (available_points >= 0),
  pending_points bigint NOT NULL DEFAULT 0 CHECK (pending_points >= 0),
  lifetime_earned bigint NOT NULL DEFAULT 0,
  lifetime_redeemed bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  type text NOT NULL CHECK (type IN ('EARN','REDEEM','REFUND','REVERSAL','EXPIRED','ADMIN_ADJUSTMENT','BONUS')),
  amount bigint NOT NULL,
  balance_before bigint NOT NULL,
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  remaining bigint NOT NULL DEFAULT 0,
  expires_at timestamptz,
  source text NOT NULL DEFAULT 'SYSTEM' CHECK (source IN ('SYSTEM','ADMIN')),
  admin_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX point_transactions_user_idx ON public.point_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX point_transactions_once_per_order ON public.point_transactions(order_id, type) WHERE order_id IS NOT NULL AND type IN ('EARN','REDEEM','REFUND');

CREATE TABLE public.loyalty_budget (
  period text PRIMARY KEY,
  commission_amount numeric NOT NULL DEFAULT 0,
  allocated_budget numeric NOT NULL DEFAULT 0,
  points_issued bigint NOT NULL DEFAULT 0,
  points_redeemed bigint NOT NULL DEFAULT 0,
  outstanding_liability numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.loyalty_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_settings TO anon, authenticated;
GRANT UPDATE ON public.loyalty_settings TO authenticated;
GRANT SELECT ON public.loyalty_config TO anon, authenticated;
GRANT UPDATE ON public.loyalty_config TO authenticated;
GRANT SELECT ON public.memberships, public.point_wallets, public.point_transactions, public.loyalty_budget, public.loyalty_audit_log TO authenticated;
GRANT ALL ON public.loyalty_settings, public.loyalty_config, public.memberships, public.point_wallets, public.point_transactions, public.loyalty_budget, public.loyalty_audit_log TO service_role;

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads tier settings" ON public.loyalty_settings FOR SELECT USING (true);
CREATE POLICY "Admins update tier settings" ON public.loyalty_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone reads point rules" ON public.loyalty_config FOR SELECT USING (true);
CREATE POLICY "Admins update point rules" ON public.loyalty_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own or admin membership" ON public.memberships FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own or admin wallet" ON public.point_wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own or admin point history" ON public.point_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins read budget" ON public.loyalty_budget FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins read audit" ON public.loyalty_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.orders
  ADD COLUMN product_amount_usd numeric,
  ADD COLUMN points_redeemed bigint NOT NULL DEFAULT 0,
  ADD COLUMN points_discount_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN points_earn_rate numeric,
  ADD COLUMN points_earn_base bigint NOT NULL DEFAULT 0,
  ADD COLUMN points_pending bigint NOT NULL DEFAULT 0,
  ADD COLUMN points_earned bigint NOT NULL DEFAULT 0,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN refunded_amount_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN purchase_confirmed_at timestamptz;

-- Core ledger write: locks the wallet, blocks negative balances, records before/after.
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
    lifetime_earned = lifetime_earned + CASE WHEN _type IN ('EARN','BONUS') OR (_type = 'ADMIN_ADJUSTMENT' AND _amount > 0) THEN _amount ELSE 0 END,
    lifetime_redeemed = lifetime_redeemed + CASE WHEN _type = 'REDEEM' THEN -_amount WHEN _type = 'REFUND' THEN -_amount ELSE 0 END,
    updated_at = now() WHERE user_id = _uid;
  RETURN after_bal;
END $$;

CREATE OR REPLACE FUNCTION public._loyalty_expires() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT now() + make_interval(months => expiration_months) FROM public.loyalty_config WHERE id = 1 $$;

CREATE OR REPLACE FUNCTION public._loyalty_budget_add(_issued bigint, _redeemed bigint, _commission numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.loyalty_config; per text := to_char(now(), 'YYYY-MM');
BEGIN
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  INSERT INTO public.loyalty_budget(period) VALUES (per) ON CONFLICT DO NOTHING;
  UPDATE public.loyalty_budget SET points_issued = points_issued + _issued, points_redeemed = points_redeemed + _redeemed,
    commission_amount = commission_amount + _commission, allocated_budget = allocated_budget + _commission * c.loyalty_budget_pct / 100,
    outstanding_liability = (SELECT coalesce(sum(available_points),0) FROM public.point_wallets) * c.point_value_usd, updated_at = now()
  WHERE period = per;
END $$;

CREATE OR REPLACE FUNCTION public.loyalty_expire_user(_uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lot record;
BEGIN
  FOR lot IN SELECT id, remaining FROM public.point_transactions WHERE user_id = _uid AND remaining > 0 AND expires_at < now() LOOP
    UPDATE public.point_transactions SET remaining = 0 WHERE id = lot.id;
    INSERT INTO public.point_wallets(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
    INSERT INTO public.point_transactions(user_id, type, amount, balance_before, balance_after, note)
      SELECT _uid, 'EXPIRED', -lot.remaining, available_points, available_points - lot.remaining, 'Expired lot ' || lot.id FROM public.point_wallets WHERE user_id = _uid;
    UPDATE public.point_wallets SET available_points = available_points - lot.remaining, updated_at = now() WHERE user_id = _uid;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.loyalty_refresh_membership(_uid uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE spend numeric; new_tier text; cur text;
BEGIN
  SELECT coalesce(sum(greatest(coalesce(product_amount_usd, amount_usd) - refunded_amount_usd, 0)), 0) INTO spend
  FROM public.orders WHERE buyer_id = _uid AND payment_verified_at IS NOT NULL AND payment_verified_at >= now() - interval '12 months' AND cancelled_at IS NULL;
  SELECT tier INTO new_tier FROM public.loyalty_settings WHERE spend_min = 0 OR spend > spend_min ORDER BY sort_order DESC LIMIT 1;
  new_tier := coalesce(new_tier, 'bronze');
  SELECT tier INTO cur FROM public.memberships WHERE user_id = _uid;
  INSERT INTO public.memberships(user_id, tier, rolling_12_month_spend) VALUES (_uid, new_tier, spend)
  ON CONFLICT (user_id) DO UPDATE SET rolling_12_month_spend = spend, updated_at = now(), tier = new_tier,
    tier_start_date = CASE WHEN public.memberships.tier <> new_tier THEN now() ELSE public.memberships.tier_start_date END,
    tier_end_date = CASE WHEN public.memberships.tier <> new_tier THEN now() + interval '12 months' ELSE public.memberships.tier_end_date END;
  RETURN new_tier;
END $$;

-- Order lifecycle: redeem on insert, pending on payment, grant on delivery, cancel/refund adjustments.
CREATE OR REPLACE FUNCTION public.loyalty_order_before() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.loyalty_config; uid uuid := auth.uid(); admin boolean; cap bigint; post_total numeric; rate numeric; earn_usd numeric; pts bigint; ratio numeric; target bigint; diff bigint; issued_month numeric; outstanding numeric;
BEGIN
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  admin := uid IS NULL OR public.has_role(uid, 'admin');
  IF TG_OP = 'INSERT' THEN
    SELECT p.price + coalesce(p.box_price, 0) INTO post_total FROM public.posts p WHERE p.id = NEW.post_id;
    NEW.product_amount_usd := round(least(coalesce(NEW.product_amount_usd, NEW.amount_usd), coalesce(post_total, NEW.amount_usd), NEW.amount_usd), 2);
    PERFORM public.loyalty_refresh_membership(NEW.buyer_id);
    SELECT least(s.earn_rate, c.max_earn_rate_pct / 100) INTO rate FROM public.memberships m JOIN public.loyalty_settings s ON s.tier = m.tier WHERE m.user_id = NEW.buyer_id;
    NEW.points_earn_rate := coalesce(rate, 0.01);
    NEW.points_pending := 0; NEW.points_earned := 0; NEW.points_earn_base := 0; NEW.cancelled_at := NULL; NEW.refunded_amount_usd := 0; NEW.purchase_confirmed_at := NULL;
    NEW.points_redeemed := greatest(coalesce(NEW.points_redeemed, 0), 0);
    IF NEW.points_redeemed > 0 THEN
      IF NOT c.points_enabled THEN RAISE EXCEPTION 'Points are temporarily unavailable'; END IF;
      cap := floor(NEW.product_amount_usd * c.max_redemption_pct / 100 / c.point_value_usd);
      IF NEW.points_redeemed > cap THEN RAISE EXCEPTION 'Points exceed the % percent limit', c.max_redemption_pct; END IF;
      PERFORM public.loyalty_expire_user(NEW.buyer_id);
      PERFORM public._loyalty_tx(NEW.buyer_id, NEW.id, 'REDEEM', -NEW.points_redeemed, NULL, 'SYSTEM', NULL, NULL);
      PERFORM public._loyalty_budget_add(0, NEW.points_redeemed, 0);
    END IF;
    NEW.points_discount_usd := round(NEW.points_redeemed * c.point_value_usd, 2);
    RETURN NEW;
  END IF;

  -- UPDATE: clients can never write loyalty bookkeeping directly.
  NEW.product_amount_usd := OLD.product_amount_usd; NEW.points_redeemed := OLD.points_redeemed; NEW.points_discount_usd := OLD.points_discount_usd;
  NEW.points_earn_rate := OLD.points_earn_rate; NEW.points_earn_base := OLD.points_earn_base; NEW.points_pending := OLD.points_pending;
  NEW.points_earned := OLD.points_earned; NEW.purchase_confirmed_at := OLD.purchase_confirmed_at;
  IF NOT admin THEN NEW.cancelled_at := OLD.cancelled_at; NEW.refunded_amount_usd := OLD.refunded_amount_usd; END IF;
  IF OLD.cancelled_at IS NOT NULL THEN NEW.cancelled_at := OLD.cancelled_at; END IF;
  NEW.refunded_amount_usd := least(greatest(NEW.refunded_amount_usd, OLD.refunded_amount_usd, 0), coalesce(OLD.product_amount_usd, OLD.amount_usd));

  -- Payment verified -> Pending Points (within budget guards)
  IF OLD.payment_verified_at IS NULL AND NEW.payment_verified_at IS NOT NULL AND NEW.cancelled_at IS NULL AND c.points_enabled THEN
    earn_usd := coalesce(OLD.product_amount_usd, OLD.amount_usd) * least(coalesce(OLD.points_earn_rate, 0.01), c.max_earn_rate_pct / 100, c.commission_rate_pct * c.loyalty_budget_pct / 10000);
    pts := floor(earn_usd / c.point_value_usd);
    IF c.monthly_point_budget_usd > 0 THEN
      SELECT coalesce(sum(points_issued), 0) * c.point_value_usd INTO issued_month FROM public.loyalty_budget WHERE period = to_char(now(), 'YYYY-MM');
      pts := least(pts, greatest(floor((c.monthly_point_budget_usd - coalesce(issued_month,0)) / c.point_value_usd), 0));
    END IF;
    IF c.max_outstanding_liability_usd > 0 THEN
      SELECT (coalesce(sum(available_points + pending_points), 0)) * c.point_value_usd INTO outstanding FROM public.point_wallets;
      pts := least(pts, greatest(floor((c.max_outstanding_liability_usd - outstanding) / c.point_value_usd), 0));
    END IF;
    NEW.points_earn_base := pts; NEW.points_pending := pts;
    INSERT INTO public.point_wallets(user_id) VALUES (OLD.buyer_id) ON CONFLICT DO NOTHING;
    UPDATE public.point_wallets SET pending_points = pending_points + pts, updated_at = now() WHERE user_id = OLD.buyer_id;
    PERFORM public._loyalty_budget_add(0, 0, coalesce(OLD.product_amount_usd, OLD.amount_usd) * c.commission_rate_pct / 100);
  END IF;

  -- Cancellation
  IF OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NOT NULL THEN
    IF OLD.points_redeemed > 0 THEN PERFORM public._loyalty_tx(OLD.buyer_id, OLD.id, 'REFUND', OLD.points_redeemed, public._loyalty_expires(), 'SYSTEM', NULL, 'Order cancelled'); END IF;
    IF NEW.points_pending > 0 THEN
      UPDATE public.point_wallets SET pending_points = greatest(pending_points - NEW.points_pending, 0), updated_at = now() WHERE user_id = OLD.buyer_id;
      NEW.points_pending := 0;
    END IF;
    IF OLD.points_earned > 0 THEN
      SELECT least(OLD.points_earned, available_points) INTO diff FROM public.point_wallets WHERE user_id = OLD.buyer_id;
      IF diff > 0 THEN PERFORM public._loyalty_tx(OLD.buyer_id, OLD.id, 'REVERSAL', -diff, NULL, 'SYSTEM', NULL, 'Order cancelled'); END IF;
      NEW.points_earned := 0;
    END IF;
    RETURN NEW;
  END IF;

  -- Partial refund: earn proportional to the non-refunded product amount
  IF NEW.refunded_amount_usd > OLD.refunded_amount_usd AND NEW.cancelled_at IS NULL THEN
    ratio := least(NEW.refunded_amount_usd / nullif(coalesce(OLD.product_amount_usd, OLD.amount_usd), 0), 1);
    target := floor(NEW.points_earn_base * (1 - coalesce(ratio, 0)));
    IF NEW.points_earned > 0 THEN
      SELECT least(NEW.points_earned - target, available_points) INTO diff FROM public.point_wallets WHERE user_id = OLD.buyer_id;
      IF diff > 0 THEN PERFORM public._loyalty_tx(OLD.buyer_id, OLD.id, 'REVERSAL', -diff, NULL, 'SYSTEM', NULL, 'Partial refund'); END IF;
      NEW.points_earned := target;
    ELSIF NEW.points_pending > target THEN
      UPDATE public.point_wallets SET pending_points = greatest(pending_points - (NEW.points_pending - target), 0), updated_at = now() WHERE user_id = OLD.buyer_id;
      NEW.points_pending := target;
    END IF;
  END IF;

  -- Purchase confirmed -> grant points once
  IF NEW.stage = 'delivered' AND OLD.stage <> 'delivered' AND NEW.cancelled_at IS NULL THEN
    NEW.purchase_confirmed_at := now();
    IF NEW.points_pending > 0 AND OLD.points_earned = 0 THEN
      UPDATE public.point_wallets SET pending_points = greatest(pending_points - NEW.points_pending, 0) WHERE user_id = OLD.buyer_id;
      PERFORM public._loyalty_tx(OLD.buyer_id, OLD.id, 'EARN', NEW.points_pending, public._loyalty_expires(), 'SYSTEM', NULL, NULL);
      PERFORM public._loyalty_budget_add(NEW.points_pending, 0, 0);
      NEW.points_earned := NEW.points_pending; NEW.points_pending := 0;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.loyalty_order_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.loyalty_refresh_membership(NEW.buyer_id); RETURN NEW; END $$;

CREATE TRIGGER orders_zz_loyalty BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.loyalty_order_before();
CREATE TRIGGER orders_zz_loyalty_after AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.loyalty_order_after();

-- Customer summary (refreshes tier and expiry first)
CREATE OR REPLACE FUNCTION public.loyalty_my_summary() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.point_wallets; m public.memberships; soon bigint; soon_date timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  PERFORM public.loyalty_expire_user(uid);
  PERFORM public.loyalty_refresh_membership(uid);
  INSERT INTO public.point_wallets(user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM public.point_wallets WHERE user_id = uid;
  SELECT * INTO m FROM public.memberships WHERE user_id = uid;
  SELECT coalesce(sum(remaining),0), min(expires_at) INTO soon, soon_date FROM public.point_transactions WHERE user_id = uid AND remaining > 0 AND expires_at < now() + interval '30 days';
  RETURN jsonb_build_object('available', w.available_points, 'pending', w.pending_points, 'lifetime_earned', w.lifetime_earned, 'lifetime_redeemed', w.lifetime_redeemed,
    'expiring_soon', soon, 'expiring_at', soon_date, 'tier', m.tier, 'spend', m.rolling_12_month_spend, 'tier_end_date', m.tier_end_date);
END $$;

-- Admin manual adjustment with audit trail
CREATE OR REPLACE FUNCTION public.loyalty_admin_adjust(_user uuid, _points bigint, _reason text, _bonus boolean DEFAULT false) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); bal bigint;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF coalesce(trim(_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _points = 0 OR abs(_points) > 10000000 THEN RAISE EXCEPTION 'Invalid point amount'; END IF;
  IF _bonus AND _points < 0 THEN RAISE EXCEPTION 'Bonus must be positive'; END IF;
  bal := public._loyalty_tx(_user, NULL, CASE WHEN _bonus THEN 'BONUS' ELSE 'ADMIN_ADJUSTMENT' END, _points, public._loyalty_expires(), 'ADMIN', uid, left(_reason, 300));
  INSERT INTO public.loyalty_audit_log(actor_id, action, target_user_id, details) VALUES (uid, CASE WHEN _bonus THEN 'BONUS' ELSE 'ADMIN_ADJUSTMENT' END, _user, jsonb_build_object('points', _points, 'reason', left(_reason, 300), 'balance_after', bal));
  IF _points > 0 THEN PERFORM public._loyalty_budget_add(_points, 0, 0); END IF;
  RETURN bal;
END $$;

CREATE OR REPLACE FUNCTION public.loyalty_settings_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  INSERT INTO public.loyalty_audit_log(actor_id, action, details) VALUES (auth.uid(), 'SETTINGS_' || upper(TG_TABLE_NAME), jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)));
  RETURN NEW;
END $$;
CREATE TRIGGER loyalty_settings_audit BEFORE UPDATE ON public.loyalty_settings FOR EACH ROW EXECUTE FUNCTION public.loyalty_settings_audit();
CREATE TRIGGER loyalty_config_audit BEFORE UPDATE ON public.loyalty_config FOR EACH ROW EXECUTE FUNCTION public.loyalty_settings_audit();

-- Admin overview metrics
CREATE OR REPLACE FUNCTION public.loyalty_admin_overview() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.loyalty_config; per text := to_char(now(), 'YYYY-MM'); res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO c FROM public.loyalty_config WHERE id = 1;
  SELECT jsonb_build_object(
    'issued', (SELECT coalesce(sum(amount),0) FROM public.point_transactions WHERE type IN ('EARN','BONUS') OR (type='ADMIN_ADJUSTMENT' AND amount>0)),
    'redeemed', (SELECT coalesce(-sum(amount),0) FROM public.point_transactions WHERE type = 'REDEEM') - (SELECT coalesce(sum(amount),0) FROM public.point_transactions WHERE type = 'REFUND'),
    'expired', (SELECT coalesce(-sum(amount),0) FROM public.point_transactions WHERE type = 'EXPIRED'),
    'outstanding', (SELECT coalesce(sum(available_points),0) FROM public.point_wallets),
    'pending', (SELECT coalesce(sum(pending_points),0) FROM public.point_wallets),
    'point_value', c.point_value_usd,
    'monthly_cost_points', (SELECT coalesce(sum(amount),0) FROM public.point_transactions WHERE amount > 0 AND type IN ('EARN','BONUS','ADMIN_ADJUSTMENT') AND created_at >= date_trunc('month', now())),
    'monthly_budget', (SELECT coalesce(allocated_budget,0) FROM public.loyalty_budget WHERE period = per),
    'monthly_budget_cap', c.monthly_point_budget_usd,
    'customers', (SELECT count(*) FROM public.point_wallets),
    'tiers', (SELECT coalesce(jsonb_agg(t ORDER BY t.sort_order), '[]'::jsonb) FROM (
       SELECT s.tier, s.sort_order, count(m.user_id) AS customers, coalesce(avg(m.rolling_12_month_spend),0) AS avg_spend,
         coalesce(avg(w.lifetime_earned),0) AS avg_earned, coalesce(avg(w.lifetime_redeemed),0) AS avg_redeemed,
         coalesce(sum(w.lifetime_earned),0) * c.point_value_usd AS cost_usd
       FROM public.loyalty_settings s LEFT JOIN public.memberships m ON m.tier = s.tier LEFT JOIN public.point_wallets w ON w.user_id = m.user_id
       GROUP BY s.tier, s.sort_order) t),
    'alerts', (SELECT coalesce(jsonb_agg(a), '[]'::jsonb) FROM (
       SELECT user_id, sum(amount) AS points FROM public.point_transactions WHERE amount > 0 AND created_at > now() - interval '30 days'
       GROUP BY user_id HAVING sum(amount) >= 500000 ORDER BY sum(amount) DESC LIMIT 20) a),
    'recent', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (
       SELECT id, user_id, order_id, type, amount, balance_after, source, note, created_at FROM public.point_transactions ORDER BY created_at DESC LIMIT 30) r),
    'audit', (SELECT coalesce(jsonb_agg(l), '[]'::jsonb) FROM (
       SELECT id, actor_id, action, target_user_id, details, created_at FROM public.loyalty_audit_log ORDER BY created_at DESC LIMIT 20) l)
  ) INTO res;
  RETURN res;
END $$;

REVOKE ALL ON FUNCTION public._loyalty_tx(uuid,uuid,text,bigint,timestamptz,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._loyalty_budget_add(bigint,bigint,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_expire_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_refresh_membership(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_my_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_my_summary() TO authenticated;
REVOKE ALL ON FUNCTION public.loyalty_admin_adjust(uuid,bigint,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_admin_adjust(uuid,bigint,text,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.loyalty_admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_admin_overview() TO authenticated;
