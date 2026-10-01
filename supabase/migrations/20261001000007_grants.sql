-- Belt and braces: the `anon` role (anyone not signed in) gets no privileges
-- at all on app tables, so access never depends on a policy being absent.
revoke all on table
  public.opportunities, public.contacts, public.tags, public.opportunity_tags
  from anon, public;

revoke all on table
  public.opportunities, public.contacts, public.tags, public.opportunity_tags
  from authenticated;
grant select, insert, update, delete on table
  public.opportunities, public.contacts, public.tags, public.opportunity_tags
  to authenticated;

-- Future tables in `public` start with no anon access either.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

revoke all on function public.set_updated_at() from public, anon, authenticated;
