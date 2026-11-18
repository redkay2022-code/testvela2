-- 관리자 거래 삭제: 주문과 그 주문을 참조하는 모든 행을 함께 정리한다. (서버에서 관리자 비밀번호 확인 후에만 호출)
CREATE OR REPLACE FUNCTION public.admin_delete_order(_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col, a.attnotnull AS nn
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.orders'::regclass AND array_length(c.conkey, 1) = 1
  LOOP
    IF r.nn THEN EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING _order_id;
    ELSE EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', r.tbl, r.col, r.col) USING _order_id;
    END IF;
  END LOOP;
  DELETE FROM public.orders WHERE id = _order_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('deleted', n);
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_order(uuid) TO service_role;
