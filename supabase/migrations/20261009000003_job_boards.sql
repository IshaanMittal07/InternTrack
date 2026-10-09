-- Saved job board links (e.g. Glassdoor, InternInsider), private to each user.
create table public.job_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  url text not null check (char_length(url) <= 2048 and url ~* '^https?://[^[:space:]]+$')
);

create index job_boards_user_id_idx on public.job_boards (user_id);

alter table public.job_boards enable row level security;

create policy job_boards_select on public.job_boards
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy job_boards_insert on public.job_boards
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy job_boards_update on public.job_boards
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy job_boards_delete on public.job_boards
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.job_boards from anon, public, authenticated;
grant select, insert, update, delete on table public.job_boards to authenticated;
