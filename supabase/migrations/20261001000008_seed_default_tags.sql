-- Seeds the default tags for the signed-in user if they have none yet.
-- Runs with the caller's permissions (SECURITY INVOKER), so RLS applies.
-- Idempotent: safe to call on every sign-in.
create function public.seed_default_tags()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.tags where user_id = uid) then
    return;
  end if;

  insert into public.tags (user_id, name, color)
  values
    (uid, 'Cybersecurity', 'terracotta'),
    (uid, 'Quantum', 'plum'),
    (uid, 'Software Engineering', 'teal'),
    (uid, 'Hardware', 'slate'),
    (uid, 'AI/ML', 'sage')
  on conflict (user_id, lower(name)) do nothing;
end;
$$;

revoke all on function public.seed_default_tags() from public, anon;
grant execute on function public.seed_default_tags() to authenticated;
