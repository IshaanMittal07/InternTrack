-- Tracks where each outreach message stands. Existing contacts get the
-- default "not_sent"; no other values change.
create type public.outreach_status as enum ('not_sent', 'sent', 'read', 'replied');

alter table public.contacts
  add column outreach_status public.outreach_status not null default 'not_sent';

create index contacts_outreach_status_idx on public.contacts (outreach_status);
