-- 0051: 공동구매 링크 생성 제한 해제 (활성 5개 제한 삭제, 같은 상품도 계속 새로 만들 수 있음). 여러 번 실행해도 안전하다.
CREATE OR REPLACE FUNCTION public.create_group(_product text, _size int, _hours int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p record; gid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _size IS NULL OR _size < 2 OR _size > 10 THEN RAISE EXCEPTION 'Group size must be 2 to 10'; END IF;
  IF _hours IS NULL OR _hours < 1 OR _hours > 72 THEN RAISE EXCEPTION 'Time limit must be 1 to 72 hours'; END IF;
  PERFORM public._group_expire_all();
  SELECT id, user_id, price, product_status INTO p FROM public.posts WHERE id = _product;
  IF NOT FOUND OR p.price IS NULL OR p.price <= 0 THEN RAISE EXCEPTION 'This product cannot be bought as a group'; END IF;
  IF coalesce(p.product_status, '') = 'OUT_OF_STOCK' THEN RAISE EXCEPTION 'This product is out of stock'; END IF;
  IF p.user_id = uid THEN RAISE EXCEPTION 'You cannot start a group for your own product'; END IF;
  INSERT INTO public.group_purchases(leader_id, product_id, target_size, duration_hours, expires_at)
  VALUES (uid, _product, _size, _hours, now() + make_interval(hours => _hours)) RETURNING id INTO gid;
  INSERT INTO public.group_members(group_id, user_id) VALUES (gid, uid);
  RETURN gid;
END $$;
REVOKE ALL ON FUNCTION public.create_group(text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(text,int,int) TO authenticated;
