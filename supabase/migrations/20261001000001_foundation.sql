-- Enums, shared helpers, and the private allowlist.

create type public.opportunity_category as enum ('applied', 'planning', 'interested');
create type public.application_stage as enum (
  'submitted', 'online_assessment', 'interviewing', 'offer', 'rejected', 'withdrawn'
);
create type public.referral_status as enum ('not_requested', 'requested', 'received', 'declined');
create type public.priority_level as enum ('low', 'medium', 'high');
create type public.tag_color as enum ('terracotta', 'sage', 'amber', 'slate', 'plum', 'teal');

-- Keeps updated_at current on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- The `private` schema is NOT exposed through the Supabase API, so nobody can
-- read or change the allowlist over HTTP. It is edited only with SQL by the
-- project owner (Supabase dashboard SQL editor, or locally via scripts).
create schema private;
revoke all on schema private from public, anon, authenticated;
-- RLS policies run as the signed-in role, which needs to be able to call
-- private.is_allowed_user(). It gets no access to any private table.
grant usage on schema private to authenticated;

create table private.allowed_emails (
  email text primary key check (email = lower(btrim(email)) and email <> '')
);

-- True only when the signed-in user's email is on the allowlist.
-- SECURITY DEFINER lets it read private.allowed_emails without granting
-- that table to anyone.
create function private.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.allowed_emails a
    where a.email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

revoke all on function private.is_allowed_user() from public, anon;
grant execute on function private.is_allowed_user() to authenticated;
