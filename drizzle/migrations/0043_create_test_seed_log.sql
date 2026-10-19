create table if not exists public.test_seed_log (kind text, a text, b text);
grant select, insert on public.test_seed_log to authenticated;
grant all on public.test_seed_log to service_role;
alter table public.test_seed_log enable row level security;