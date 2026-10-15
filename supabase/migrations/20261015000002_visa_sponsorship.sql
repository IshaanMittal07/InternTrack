-- How likely a posting is to sponsor a work visa, read from its job
-- description (or set by hand). Adds a nullable column, so every existing
-- posting starts empty ("Not checked") and no existing value changes.
create type public.visa_sponsorship as enum ('no', 'maybe', 'highly_likely', 'yes');

alter table public.opportunities
  add column visa_sponsorship public.visa_sponsorship;
