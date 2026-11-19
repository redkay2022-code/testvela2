-- 관리자 회원관리 표시용: 신규 가입자부터 전화번호를 별도 비공개 표에 저장한다. (서버(service_role)만 읽기/쓰기 가능)
CREATE TABLE IF NOT EXISTS public.member_phones (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_phones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_phones FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.member_phones TO service_role;

-- 기존 회원의 국가 임시 분류용: 로그인 상태로 접속한 가장 최근 접속 국가
CREATE OR REPLACE FUNCTION public.admin_member_visit_countries() RETURNS TABLE(user_id uuid, country text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (v.user_id) v.user_id, v.country
    FROM public.page_views v
   WHERE v.user_id IS NOT NULL AND v.country IS NOT NULL
   ORDER BY v.user_id, v.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_member_visit_countries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_member_visit_countries() TO service_role;
