-- 0050: 공동구매 초대 코드 + 서버 쪽 자동 연결(가입 직후 / 코드 입력). 여러 번 실행해도 안전하다.

-- 1) 초대 코드 (예: VELA-K7M2). 헷갈리는 글자(0 O 1 I)는 뺀다.
ALTER TABLE public.group_purchases ADD COLUMN IF NOT EXISTS invite_code text;
CREATE OR REPLACE FUNCTION public._group_new_code() RETURNS text LANGUAGE plpgsql AS $$
DECLARE alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int; tries int := 0;
BEGIN
  LOOP
    c := 'VELA-';
    FOR i IN 1..4 LOOP c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.group_purchases WHERE invite_code = c) THEN RETURN c; END IF;
    tries := tries + 1;
    IF tries > 50 THEN RETURN c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); END IF;
  END LOOP;
END $$;
UPDATE public.group_purchases SET invite_code = public._group_new_code() WHERE invite_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS group_purchases_invite_code_uq ON public.group_purchases(invite_code);
CREATE OR REPLACE FUNCTION public._group_set_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.invite_code IS NULL THEN NEW.invite_code := public._group_new_code(); END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS group_purchases_code ON public.group_purchases;
CREATE TRIGGER group_purchases_code BEFORE INSERT ON public.group_purchases FOR EACH ROW EXECUTE FUNCTION public._group_set_code();

-- 2) 코드 또는 ID 로 공동구매 찾기
CREATE OR REPLACE FUNCTION public._group_resolve(_id text) RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE gid uuid; v text := upper(btrim(coalesce(_id, '')));
BEGIN
  IF v = '' THEN RETURN NULL; END IF;
  BEGIN gid := lower(v)::uuid; RETURN gid; EXCEPTION WHEN others THEN NULL; END;
  IF v !~ '^VELA-[A-Z0-9]{4,6}$' THEN RETURN NULL; END IF;
  SELECT id INTO gid FROM public.group_purchases WHERE invite_code = v;
  RETURN gid;
END $$;

-- 3) 참여 처리 (사용자 ID 를 받는 내부 함수 — 가입 서버가 계정을 만든 직후에도 쓴다)
CREATE OR REPLACE FUNCTION public._group_claim(_uid uuid, _id text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gid uuid; g public.group_purchases; m public.group_members;
BEGIN
  IF _uid IS NULL THEN RETURN 'invalid'; END IF;
  gid := public._group_resolve(_id);
  IF gid IS NULL THEN RETURN CASE WHEN btrim(coalesce(_id, '')) = '' THEN 'invalid' ELSE 'unknown' END; END IF;
  PERFORM public._group_expire_all();
  SELECT * INTO g FROM public.group_purchases WHERE id = gid;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  IF g.status <> 'active' OR g.expires_at <= now() THEN RETURN 'closed'; END IF;
  IF g.leader_id = _uid THEN RETURN 'leader'; END IF;
  SELECT * INTO m FROM public.group_members WHERE group_id = gid AND user_id = _uid;
  IF FOUND THEN RETURN 'already'; END IF;
  IF g.current_size >= g.target_size THEN RETURN 'full'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members mm JOIN public.group_purchases gg ON gg.id = mm.group_id WHERE mm.user_id = _uid AND mm.status <> 'canceled' AND gg.status = 'active' AND gg.product_id = g.product_id) THEN RETURN 'other_group'; END IF;
  INSERT INTO public.group_members(group_id, user_id) VALUES (gid, _uid);
  PERFORM public._group_eval(gid);
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public._group_claim(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._group_claim(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_group(_id text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  RETURN public._group_claim(uid, _id);
END $$;
REVOKE ALL ON FUNCTION public.claim_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_group(text) TO authenticated;

-- 4) 친구 초대(추천) 연결도 같은 방식으로: 가입 서버에서 바로 연결할 수 있게 내부 함수로 분리
CREATE OR REPLACE FUNCTION public._referral_claim(_uid uuid, _code text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref uuid; cur uuid; n int;
BEGIN
  IF _uid IS NULL THEN RETURN 'invalid'; END IF;
  BEGIN ref := _code::uuid; EXCEPTION WHEN others THEN RETURN 'invalid'; END;
  IF ref = _uid THEN RETURN 'self'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = ref) THEN RETURN 'unknown'; END IF;
  SELECT referred_by INTO cur FROM public.profiles WHERE user_id = ref;
  IF cur = _uid THEN RETURN 'loop'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE buyer_id = _uid) THEN RETURN 'has_orders'; END IF;
  UPDATE public.profiles SET referred_by = ref, referred_at = now() WHERE user_id = _uid AND referred_by IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
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

-- 5) 공개 조회: ID 또는 코드, 결과에 invite_code 포함 (로그인 전에도 가능)
DROP FUNCTION IF EXISTS public.group_public(uuid);
CREATE OR REPLACE FUNCTION public.group_public(_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_purchases; p record; nick text; gid uuid := public._group_resolve(_id);
BEGIN
  IF gid IS NULL THEN RETURN NULL; END IF;
  PERFORM public._group_expire_all();
  SELECT * INTO g FROM public.group_purchases WHERE id = gid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT title, price, thumbnail_url INTO p FROM public.posts WHERE id = g.product_id;
  SELECT nickname INTO nick FROM public.profiles WHERE user_id = g.leader_id;
  RETURN jsonb_build_object('id', g.id, 'invite_code', g.invite_code, 'product_id', g.product_id, 'title', p.title, 'price', p.price, 'image', p.thumbnail_url,
    'leader', coalesce(nick, ''), 'target_size', g.target_size, 'current_size', g.current_size, 'status', g.status,
    'expires_at', g.expires_at, 'discount_pct', public._group_discount_pct(g.current_size), 'max_pct', public._group_discount_pct(g.target_size));
END $$;
REVOKE ALL ON FUNCTION public.group_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_public(text) TO anon, authenticated;

-- 6) 내 공동구매 목록에도 초대 코드 포함
CREATE OR REPLACE FUNCTION public.group_my_summary() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  PERFORM public._group_expire_all();
  RETURN jsonb_build_object('groups', coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) FROM (
    SELECT g.id, g.invite_code, g.product_id, p.title, g.target_size, g.current_size, g.status, g.expires_at, g.created_at, g.duration_hours,
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
