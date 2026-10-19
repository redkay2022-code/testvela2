-- 104차 DB 적용: 화면 표시용 집계 함수 (구조 변경 부분만)

create table if not exists public.test_seed_log (kind text, a text, b text);
alter table public.test_seed_log enable row level security;
revoke all on public.test_seed_log from anon, authenticated;

-- 화면 표시용: 셀러별 합계만 돌려주는 함수 (이름·사용자 ID는 노출하지 않음)
create or replace function public.seller_public_stats()
returns table(seller_key text, followers bigint, likes bigint, saves bigint)
language sql stable security definer set search_path = public as $$
  with g as (
    select p.id as post_id, p.user_id,
            case when p.store_id is not null then p.creator else coalesce(p.user_id::text, p.creator) end as k
    from public.posts p
  ), s as (
    select k, array_agg(distinct user_id::text) filter (where user_id is not null) as uks from g group by k
  )
  select s.k,
    (select count(distinct f.follower_id) from public.seller_follows f where f.seller_key = s.k or f.seller_key = any(coalesce(s.uks, '{}'::text[]))),
    (select count(*) from public.likes l join g on g.post_id = l.post_id where g.k = s.k),
    (select count(*) from public.cart_items c join g on g.post_id = c.post_id where g.k = s.k)
  from s;
$$;
revoke all on function public.seller_public_stats() from public;
grant execute on function public.seller_public_stats() to anon, authenticated, service_role;