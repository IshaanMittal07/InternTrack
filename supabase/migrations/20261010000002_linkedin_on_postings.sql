-- The LinkedIn connection status belongs to the posting, not to each
-- contact. Adds it to opportunities (empty for every existing posting, so no
-- existing values change) and removes the contact-level column added in the
-- previous migration, which was only live briefly.
alter table public.opportunities
  add column linkedin_connection public.linkedin_connection;

alter table public.contacts drop column if exists linkedin_connection;
