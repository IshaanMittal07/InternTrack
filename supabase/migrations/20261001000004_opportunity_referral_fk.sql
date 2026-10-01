-- The referrer must be a contact attached to the same opportunity. Using a
-- composite key makes the database enforce that, not just the app. Deleting
-- the contact clears only referred_by_contact_id.
alter table public.opportunities
  add constraint opportunities_referred_by_contact_fkey
  foreign key (referred_by_contact_id, id)
  references public.contacts (id, opportunity_id)
  on delete set null (referred_by_contact_id);

create index opportunities_referred_by_contact_id_idx
  on public.opportunities (referred_by_contact_id);
