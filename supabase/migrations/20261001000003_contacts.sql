create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null check (char_length(btrim(name)) between 1 and 120),
  title text check (char_length(title) <= 120),
  linkedin_url text check (
    char_length(linkedin_url) <= 2048 and linkedin_url ~* '^https?://[^[:space:]]+$'
  ),
  email text check (
    char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  has_spoken boolean not null default false,
  last_contacted date,
  next_follow_up date,
  notes text check (char_length(notes) <= 10000),

  -- Lets opportunities reference (contact, opportunity) pairs, so a referrer
  -- must be a contact of that same opportunity.
  constraint contacts_id_opportunity_id_key unique (id, opportunity_id)
);

create index contacts_user_id_idx on public.contacts (user_id);
create index contacts_opportunity_id_idx on public.contacts (opportunity_id);
create index contacts_next_follow_up_idx on public.contacts (next_follow_up);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();
