create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 30 and name = btrim(name)),
  color public.tag_color not null default 'slate'
);

create index tags_user_id_idx on public.tags (user_id);
-- Tag names are unique per user regardless of capitalization.
create unique index tags_user_id_lower_name_key on public.tags (user_id, lower(name));

create table public.opportunity_tags (
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (opportunity_id, tag_id)
);

create index opportunity_tags_user_id_idx on public.opportunity_tags (user_id);
create index opportunity_tags_tag_id_idx on public.opportunity_tags (tag_id);
