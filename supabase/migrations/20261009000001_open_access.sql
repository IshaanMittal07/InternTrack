-- Opens the app to anyone with an account. Every row stays private to its
-- owner: the RLS policies still require `user_id = auth.uid()`; only the
-- allowlist half of each policy now passes for any signed-in user.
--
-- Additive only: no rows are changed or removed. private.allowed_emails is
-- kept (now unused) so existing data and history stay intact.
create or replace function private.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null;
$$;

revoke all on function private.is_allowed_user() from public, anon;
grant execute on function private.is_allowed_user() to authenticated;
