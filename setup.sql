-- Run in a separate Supabase project for the public demo.
begin;
create table if not exists public.hq_demo_workspace (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state jsonb not null check (
    jsonb_typeof(state) = 'object'
    and octet_length(state::text) <= 65536
  )
);
alter table public.hq_demo_workspace enable row level security;
revoke all on public.hq_demo_workspace from public, anon, authenticated;
grant select, insert, update on public.hq_demo_workspace to authenticated;
drop policy if exists hq_demo_owner on public.hq_demo_workspace;
create policy hq_demo_owner on public.hq_demo_workspace
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select auth.jwt()->>'is_anonymous') = 'true')
  with check (owner_id = (select auth.uid()) and (select auth.jwt()->>'is_anonymous') = 'true');
commit;
