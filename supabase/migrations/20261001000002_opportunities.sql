create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  category public.opportunity_category not null,
  company text not null check (char_length(btrim(company)) between 1 and 120),
  role_title text check (char_length(role_title) <= 200),
  posting_url text check (
    char_length(posting_url) <= 2048 and posting_url ~* '^https?://[^[:space:]]+$'
  ),
  posting_notes text check (char_length(posting_notes) <= 10000),
  location text check (char_length(location) <= 200),
  term text check (char_length(term) <= 60),
  deadline date,

  date_applied date,
  application_stage public.application_stage,

  referral_status public.referral_status not null default 'not_requested',
  -- Foreign key added in a later migration, once contacts exists.
  referred_by_contact_id uuid,

  priority public.priority_level not null default 'medium',
  notes text check (char_length(notes) <= 20000),

  -- Applied rows must have both; other categories must have neither.
  constraint opportunities_date_applied_matches_category
    check ((category = 'applied') = (date_applied is not null)),
  constraint opportunities_stage_matches_category
    check ((category = 'applied') = (application_stage is not null))
);

create index opportunities_user_id_idx on public.opportunities (user_id);
create index opportunities_category_idx on public.opportunities (category);
create index opportunities_deadline_idx on public.opportunities (deadline);

create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();
