-- Adding a contact now tags its posting "Connection sent". Applies the same
-- rule to postings that already have contacts: only an untracked or "unsent"
-- posting changes, and nothing else on it does (updated_at is kept as is).
alter table public.opportunities disable trigger opportunities_set_updated_at;

update public.opportunities o
set linkedin_connection = 'sent'
where (o.linkedin_connection is null or o.linkedin_connection = 'not_sent')
  and exists (select 1 from public.contacts c where c.opportunity_id = o.id);

alter table public.opportunities enable trigger opportunities_set_updated_at;
