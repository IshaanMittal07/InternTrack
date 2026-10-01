-- Row Level Security: every row is visible and changeable only by its owner,
-- and only if that owner is on the allowlist. Policies apply to the
-- `authenticated` role only, so the `anon` role (not signed in) has none.
--
-- `(select auth.uid())` is evaluated once per statement instead of per row.
--
-- Note: Postgres checks foreign keys WITHOUT applying RLS, so child tables
-- also verify that the referenced parent rows belong to the current user.

alter table public.opportunities enable row level security;
alter table public.contacts enable row level security;
alter table public.tags enable row level security;
alter table public.opportunity_tags enable row level security;

-- opportunities --------------------------------------------------------------

create policy opportunities_select on public.opportunities
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()));

create policy opportunities_insert on public.opportunities
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

create policy opportunities_update on public.opportunities
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

create policy opportunities_delete on public.opportunities
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()));

-- contacts -------------------------------------------------------------------

create policy contacts_select on public.contacts
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()));

create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_allowed_user())
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.user_id = (select auth.uid())
    )
  );

create policy contacts_update on public.contacts
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (
    user_id = (select auth.uid())
    and (select private.is_allowed_user())
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.user_id = (select auth.uid())
    )
  );

create policy contacts_delete on public.contacts
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()));

-- tags -----------------------------------------------------------------------

create policy tags_select on public.tags
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()));

create policy tags_insert on public.tags
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

create policy tags_update on public.tags
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

create policy tags_delete on public.tags
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()));

-- opportunity_tags -----------------------------------------------------------

create policy opportunity_tags_select on public.opportunity_tags
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()));

create policy opportunity_tags_insert on public.opportunity_tags
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_allowed_user())
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.tags t
      where t.id = tag_id and t.user_id = (select auth.uid())
    )
  );

create policy opportunity_tags_update on public.opportunity_tags
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (
    user_id = (select auth.uid())
    and (select private.is_allowed_user())
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.tags t
      where t.id = tag_id and t.user_id = (select auth.uid())
    )
  );

create policy opportunity_tags_delete on public.opportunity_tags
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()));
