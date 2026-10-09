-- Contact name becomes optional. Existing names are untouched; the length
-- check still applies whenever a name is given.
alter table public.contacts alter column name drop not null;

alter table public.contacts drop constraint contacts_name_check;
alter table public.contacts add constraint contacts_name_check
  check (name is null or char_length(btrim(name)) between 1 and 120);
