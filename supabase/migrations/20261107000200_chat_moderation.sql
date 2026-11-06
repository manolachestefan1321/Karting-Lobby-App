-- =============================================================================
-- Lobby chat + moderation (step 2 of the core loop). Apple guideline 1.2: apps
-- with user content need reporting, blocking and a way for us to act on reports.
--  * messages: only lobby members (and the host) read and write them.
--  * "joined" / "left" lines appear in the chat automatically.
--  * user_blocks: you no longer see messages from people you blocked.
--  * reports: anyone can report a profile or a message; only admins read them.
-- New tables only — nothing existing is changed or deleted.
-- =============================================================================
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  body        text not null check (char_length(body) between 1 and 1000),
  system      boolean not null default false,   -- "joined" / "left" lines
  hidden      boolean not null default false,   -- hidden by an admin after a report
  created_at  timestamptz not null default now()
);
create index messages_session_idx on public.messages (session_id, created_at);

create table public.user_blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.profiles(id) on delete set null,
  kind            text not null check (kind in ('profile', 'message')),
  target_user_id  uuid references public.profiles(id) on delete cascade,
  message_id      uuid references public.messages(id) on delete set null,
  message_body    text,                          -- copy, in case the message is deleted
  reason          text not null check (char_length(reason) between 1 and 500),
  status          text not null default 'open' check (status in ('open', 'closed')),
  created_at      timestamptz not null default now()
);
create index reports_open_idx on public.reports (status, created_at);

-- Lobby members (any status except removed) and the host can read the chat.
create or replace function public.is_session_member(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.sessions where id = p_session and host_id = auth.uid())
      or exists (select 1 from public.session_members where session_id = p_session and user_id = auth.uid() and status <> 'removed');
$$;
revoke execute on function public.is_session_member(uuid) from public, anon;
grant execute on function public.is_session_member(uuid) to authenticated;

alter table public.messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;

grant select on public.messages to authenticated;
create policy "lobby members read the chat" on public.messages for select to authenticated using (
  not hidden
  and public.is_session_member(session_id)
  and (user_id is null or not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = messages.user_id))
);

grant select, insert, delete on public.user_blocks to authenticated;
create policy "own blocks read"   on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
create policy "own blocks add"    on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "own blocks remove" on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());

grant select, update (status) on public.reports to authenticated;
create policy "admins read reports"  on public.reports for select to authenticated using (public.is_admin());
create policy "admins close reports" on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Messages with their author's public profile (the reader's access rules still apply).
create view public.chat_messages
with (security_invoker = true)
as
select m.id, m.session_id, m.user_id, m.body, m.system, m.created_at,
       p.first_name, p.last_name, p.avatar_path, p.provider_avatar_url, p.rank_tier_id, p.total_xp, p.total_meters
from public.messages m
left join public.public_profiles p on p.id = m.user_id;
grant select on public.chat_messages to authenticated;

create or replace function public.send_message(p_session uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_text text := left(trim(coalesce(p_body, '')), 1000);
begin
  if v_text = '' then return; end if;
  if not exists (select 1 from public.sessions where id = p_session and host_id = v_me)
     and not exists (select 1 from public.session_members where session_id = p_session and user_id = v_me and status in ('joined_unpaid', 'confirmed', 'attended')) then
    raise exception 'not_in_lobby';
  end if;
  -- Anti-spam: at most 10 messages in 30 seconds.
  if (select count(*) from public.messages where user_id = v_me and created_at > now() - interval '30 seconds') >= 10 then
    raise exception 'too_fast';
  end if;
  insert into public.messages (session_id, user_id, body) values (p_session, v_me, v_text);
end;
$$;
revoke execute on function public.send_message(uuid, text) from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;

create or replace function public.report_content(p_kind text, p_user uuid, p_message uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid := p_user;
  v_body   text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_kind = 'message' then
    -- You can only report a message you can see.
    select m.user_id, m.body into v_author, v_body from public.messages m
    where m.id = p_message and public.is_session_member(m.session_id);
    if not found then raise exception 'not_found'; end if;
  elsif p_kind <> 'profile' or p_user is null then
    raise exception 'not_found';
  end if;
  insert into public.reports (reporter_id, kind, target_user_id, message_id, message_body, reason)
  values (auth.uid(), p_kind, v_author, case when p_kind = 'message' then p_message end, v_body, left(coalesce(nullif(trim(p_reason), ''), 'other'), 500));
end;
$$;
revoke execute on function public.report_content(text, uuid, uuid, text) from public, anon;
grant execute on function public.report_content(text, uuid, uuid, text) to authenticated;

-- "X joined" / "X left" lines in the lobby chat (not for the host, nor when the whole session is cancelled).
create or replace function public.lobby_system_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.sessions;
begin
  select * into v_s from public.sessions where id = new.session_id;
  if v_s.cancelled_at is not null or new.user_id = v_s.host_id then return null; end if;
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    insert into public.messages (session_id, user_id, body, system) values (new.session_id, new.user_id, 'joined', true);
  elsif tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' then
    insert into public.messages (session_id, user_id, body, system) values (new.session_id, new.user_id, 'left', true);
  end if;
  return null;
end;
$$;
revoke execute on function public.lobby_system_message() from public, anon, authenticated;
create trigger session_members_chat_lines after insert or update of status on public.session_members
  for each row execute function public.lobby_system_message();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
