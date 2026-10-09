-- Tracks whether a LinkedIn connection request was sent to a contact.
-- Adding the column with a default rewrites no existing values, and the app
-- only shows it while the contact's message status is still "not_sent".
create type public.linkedin_connection as enum ('not_sent', 'sent');

alter table public.contacts
  add column linkedin_connection public.linkedin_connection default 'not_sent';
