-- Email sync: reads the user's inboxes for rejection emails and marks the
-- matching Applied posting as Rejected.
--
-- Additive only: new types, tables and functions. No existing rows change.
--
-- Two ways in, both resolved to one user by private.email_sync_user():
--   * a signed-in session (auth.uid()), for the Email sync page;
--   * a per-user sync key, for the Gmail Apps Script, which has no session.
--     Only a SHA-256 hash of the key is stored.
-- Microsoft refresh tokens are kept in the `private` schema (never exposed
-- over the API) and are encrypted by the app before they get here.

create extension if not exists pgcrypto with schema extensions;

create type public.email_source as enum ('gmail', 'microsoft');
create type public.email_outcome as enum ('rejected', 'unmatched', 'ambiguous', 'skipped');

create table private.email_sync_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now()
);

create table private.email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  provider public.email_source not null check (provider = 'microsoft'),
  account_email text not null check (
    char_length(account_email) between 3 and 320 and account_email = lower(btrim(account_email))
  ),
  refresh_token_enc text not null,
  last_synced_at timestamptz,
  last_error text check (char_length(last_error) <= 500),
  unique (user_id, provider, account_email)
);

create index email_connections_user_id_idx on private.email_connections (user_id);

-- One row per email that looked like a rejection, whatever happened to it.
-- The unique key makes processing idempotent: an email is acted on once.
create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  source public.email_source not null,
  message_id text not null check (char_length(message_id) between 1 and 500),
  received_at timestamptz not null,
  sender text not null check (char_length(sender) <= 500),
  subject text not null check (char_length(subject) <= 1000),
  outcome public.email_outcome not null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  -- The stage before it was set to Rejected, so the change can be undone.
  previous_stage public.application_stage,
  undone_at timestamptz,
  unique (user_id, source, message_id)
);

create index email_events_user_created_idx on public.email_events (user_id, created_at desc);
create index email_events_opportunity_id_idx on public.email_events (opportunity_id);

alter table public.email_events enable row level security;

create policy email_events_select on public.email_events
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Only used to record an undo (see email_undo_rejection).
create policy email_events_update on public.email_events
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.email_events from anon, public, authenticated;
grant select on table public.email_events to authenticated;
grant update (undone_at) on table public.email_events to authenticated;

-- Resolving the caller ----------------------------------------------------------

-- The user a sync call acts for: the sync key's owner, or the signed-in user
-- when no key is given. Raises when neither applies, so callers never act
-- for nobody.
create function private.email_sync_user(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if p_token is null then
    uid := auth.uid();
  else
    select t.user_id into uid
    from private.email_sync_tokens t
    where t.token_hash = extensions.digest(p_token, 'sha256');
  end if;

  if uid is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return uid;
end;
$$;

revoke all on function private.email_sync_user(text) from public, anon, authenticated;

-- Sync key (signed-in user only) ----------------------------------------------

-- Creates or replaces the caller's sync key and returns it. It is only ever
-- shown this once; any previous key stops working.
create function public.email_sync_token_create()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into private.email_sync_tokens (user_id, token_hash)
  values (uid, extensions.digest(token, 'sha256'))
  on conflict (user_id) do update
    set token_hash = excluded.token_hash, created_at = now();
  return token;
end;
$$;

create function public.email_sync_token_delete()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from private.email_sync_tokens t where t.user_id = auth.uid();
end;
$$;

-- When the caller's sync key was created, or null if there is none.
create function public.email_sync_token_created_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select t.created_at from private.email_sync_tokens t where t.user_id = auth.uid();
$$;

-- Microsoft connections (signed-in user only) ---------------------------------

create function public.email_connection_save(p_account_email text, p_refresh_token_enc text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into private.email_connections (user_id, provider, account_email, refresh_token_enc)
  values (auth.uid(), 'microsoft', lower(btrim(p_account_email)), p_refresh_token_enc)
  on conflict (user_id, provider, account_email) do update
    set refresh_token_enc = excluded.refresh_token_enc, last_error = null;
end;
$$;

-- The caller's connections, without their tokens.
create function public.email_connection_list()
returns table (
  id uuid,
  account_email text,
  created_at timestamptz,
  last_synced_at timestamptz,
  last_error text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.account_email, c.created_at, c.last_synced_at, c.last_error
  from private.email_connections c
  where c.user_id = auth.uid()
  order by c.created_at;
$$;

create function public.email_connection_delete(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from private.email_connections c where c.id = p_id and c.user_id = auth.uid();
  return found;
end;
$$;

-- Syncing (sync key or signed-in user) ----------------------------------------

-- The user's Applied postings, for matching emails against.
create function public.email_sync_applied(p_token text default null)
returns table (
  id uuid,
  company text,
  role_title text,
  date_applied date,
  application_stage public.application_stage
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.email_sync_user(p_token);
begin
  return query
    select o.id, o.company, o.role_title, o.date_applied, o.application_stage
    from public.opportunities o
    where o.user_id = uid and o.category = 'applied';
end;
$$;

-- The user's Microsoft connections, with their (encrypted) refresh tokens.
create function public.email_sync_connections(p_token text default null)
returns table (
  id uuid,
  account_email text,
  refresh_token_enc text,
  last_synced_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.email_sync_user(p_token);
begin
  return query
    select c.id, c.account_email, c.refresh_token_enc, c.last_synced_at
    from private.email_connections c
    where c.user_id = uid and c.provider = 'microsoft'
    order by c.created_at;
end;
$$;

-- Saves the result of syncing one connection. A null refresh token or sync
-- time keeps the stored value; p_error replaces the last error (null clears it).
-- In every sync function, a null p_token means "the signed-in user".
create function public.email_sync_update_connection(
  p_id uuid,
  p_refresh_token_enc text default null,
  p_synced_at timestamptz default null,
  p_error text default null,
  p_token text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := private.email_sync_user(p_token);
begin
  update private.email_connections c
  set
    refresh_token_enc = coalesce(p_refresh_token_enc, c.refresh_token_enc),
    last_synced_at = coalesce(p_synced_at, c.last_synced_at),
    last_error = left(p_error, 500)
  where c.id = p_id and c.user_id = uid;
end;
$$;

-- Records one rejection email and, for outcome 'rejected', marks the posting
-- Rejected in the same transaction. Checked again here, under a row lock:
-- only an Applied posting of this user that is still Submitted, Online
-- assessment or Interviewing is changed; anything else is recorded as
-- 'skipped'. Returns the recorded outcome, or null if this email was already
-- recorded (nothing is changed then).
create function public.email_sync_record(
  p_source public.email_source,
  p_message_id text,
  p_received_at timestamptz,
  p_sender text,
  p_subject text,
  p_outcome public.email_outcome,
  p_opportunity_id uuid default null,
  p_token text default null
)
returns public.email_outcome
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := private.email_sync_user(p_token);
  v_outcome public.email_outcome := p_outcome;
  v_opportunity uuid := p_opportunity_id;
  v_stage public.application_stage;
  v_event uuid;
begin
  if v_opportunity is not null then
    select o.application_stage into v_stage
    from public.opportunities o
    where o.id = v_opportunity and o.user_id = uid and o.category = 'applied'
    for update;

    if not found then
      v_opportunity := null;
      v_outcome := 'unmatched';
    end if;
  end if;

  if v_outcome = 'rejected' and (
    v_opportunity is null
    or v_stage not in ('submitted', 'online_assessment', 'interviewing')
  ) then
    v_outcome := case when v_opportunity is null then 'unmatched' else 'skipped' end;
  end if;

  insert into public.email_events (
    user_id, source, message_id, received_at, sender, subject,
    outcome, opportunity_id, previous_stage
  )
  values (
    uid, p_source, p_message_id, p_received_at, left(coalesce(p_sender, ''), 500),
    left(coalesce(p_subject, ''), 1000), v_outcome, v_opportunity,
    case when v_outcome = 'rejected' then v_stage end
  )
  on conflict (user_id, source, message_id) do nothing
  returning id into v_event;

  if v_event is null then
    return null;
  end if;

  if v_outcome = 'rejected' then
    update public.opportunities o
    set application_stage = 'rejected'
    where o.id = v_opportunity and o.user_id = uid;
  end if;

  return v_outcome;
end;
$$;

-- Undo (signed-in user, runs with their own permissions) ----------------------

-- Puts the posting back to the stage it had before the email marked it
-- Rejected. Does nothing (returns false) if it was already undone or the
-- posting's stage has been changed by hand since.
create function public.email_undo_rejection(p_event_id uuid)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  ev public.email_events;
begin
  select * into ev
  from public.email_events e
  where e.id = p_event_id and e.user_id = auth.uid()
  for update;

  if not found
    or ev.outcome <> 'rejected'
    or ev.undone_at is not null
    or ev.opportunity_id is null
    or ev.previous_stage is null then
    return false;
  end if;

  update public.opportunities o
  set application_stage = ev.previous_stage
  where o.id = ev.opportunity_id
    and o.user_id = auth.uid()
    and o.category = 'applied'
    and o.application_stage = 'rejected';

  if not found then
    return false;
  end if;

  update public.email_events e set undone_at = now() where e.id = ev.id;
  return true;
end;
$$;

-- Grants ------------------------------------------------------------------------

revoke all on function public.email_sync_token_create() from public, anon;
revoke all on function public.email_sync_token_delete() from public, anon;
revoke all on function public.email_sync_token_created_at() from public, anon;
revoke all on function public.email_connection_save(text, text) from public, anon;
revoke all on function public.email_connection_list() from public, anon;
revoke all on function public.email_connection_delete(uuid) from public, anon;
revoke all on function public.email_undo_rejection(uuid) from public, anon;
grant execute on function public.email_sync_token_create() to authenticated;
grant execute on function public.email_sync_token_delete() to authenticated;
grant execute on function public.email_sync_token_created_at() to authenticated;
grant execute on function public.email_connection_save(text, text) to authenticated;
grant execute on function public.email_connection_list() to authenticated;
grant execute on function public.email_connection_delete(uuid) to authenticated;
grant execute on function public.email_undo_rejection(uuid) to authenticated;

-- Callable without a session: each one requires a valid sync key then.
revoke all on function public.email_sync_applied(text) from public;
revoke all on function public.email_sync_connections(text) from public;
revoke all on function public.email_sync_update_connection(uuid, text, timestamptz, text, text)
  from public;
revoke all on function public.email_sync_record(
  public.email_source, text, timestamptz, text, text, public.email_outcome, uuid, text
) from public;
grant execute on function public.email_sync_applied(text) to anon, authenticated;
grant execute on function public.email_sync_connections(text) to anon, authenticated;
grant execute on function public.email_sync_update_connection(uuid, text, timestamptz, text, text)
  to anon, authenticated;
grant execute on function public.email_sync_record(
  public.email_source, text, timestamptz, text, text, public.email_outcome, uuid, text
) to anon, authenticated;
