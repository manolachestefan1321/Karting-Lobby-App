-- In-app notifications for the real app (the Notifications tab and the Settings switches).
-- Created automatically by triggers on what already happens in the app: someone reserves
-- or leaves a seat, a session is cancelled, a chat message, results, rank up.
-- Push notifications to the phone come later and will read from this same table.
--
-- Nothing is deleted or changed in existing tables: only new tables, functions and triggers.

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (char_length(type) <= 40),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));

-- One row per user only once they change something; missing row = everything on.
create table public.notification_prefs (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  lobby      boolean not null default true,
  chat       boolean not null default true,
  reminders  boolean not null default true,
  results    boolean not null default true,
  ranking    boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
grant select on public.notification_prefs to authenticated;
create policy "own prefs" on public.notification_prefs for select to authenticated using (user_id = (select auth.uid()));

-- Which Settings switch controls each type ('account' ones can't be switched off).
create or replace function public.notification_group(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type in ('lobby_joined', 'lobby_left', 'lobby_full', 'session_cancelled', 'auto_cancelled', 'removed_from_lobby') then 'lobby'
    when p_type = 'chat_message' then 'chat'
    when p_type in ('reminder_cancel_window', 'checkin_open') then 'reminders'
    when p_type in ('results_posted', 'results_confirmed', 'results_disputed') then 'results'
    when p_type in ('rank_up', 'xp_penalty') then 'ranking'
    else 'account'
  end;
$$;

-- Internal: adds a notification if the user wants this kind. Not callable from the app.
create or replace function public.notify(p_user uuid, p_type text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group text := public.notification_group(p_type);
  v_on    boolean;
begin
  if p_user is null then return; end if;
  if v_group <> 'account' then
    select case v_group when 'lobby' then lobby when 'chat' then chat when 'reminders' then reminders
                        when 'results' then results when 'ranking' then ranking end
      into v_on from public.notification_prefs where user_id = p_user;
    if v_on is false then return; end if;
  end if;
  insert into public.notifications (user_id, type, data) values (p_user, p_type, coalesce(p_data, '{}'::jsonb));
end;
$$;
revoke execute on function public.notify(uuid, text, jsonb) from public, anon, authenticated;

-- Session details every notification about a session carries. free = 1: seats are paid at the track.
create or replace function public.notification_session_data(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('sessionId', s.id, 'trackName', t.name, 'startsAt', s.starts_at, 'free', case when s.fee_minor = 0 then 1 else 0 end)
  from public.sessions s join public.tracks t on t.id = s.track_id
  where s.id = p_session;
$$;
revoke execute on function public.notification_session_data(uuid) from public, anon, authenticated;

create or replace function public.display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(coalesce(first_name, '') || ' ' || coalesce(left(last_name, 1) || '.', '')), ''), 'KartUP')
  from public.profiles where id = p_user;
$$;
revoke execute on function public.display_name(uuid) from public, anon, authenticated;

-- ───────────────────────────── triggers ─────────────────────────────

-- Seats: reserved, left, removed, lobby full.
create or replace function public.trg_notify_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s      public.sessions;
  v_data   jsonb;
  v_taken  int;
  v_was    text := case when tg_op = 'INSERT' then null else old.status end;
begin
  if v_was is not distinct from new.status then return new; end if;
  select * into v_s from public.sessions where id = new.session_id;
  -- Cancelling a session moves everyone out at once: the cancellation trigger tells them.
  if v_s.cancelled_at is not null then return new; end if;
  v_data := public.notification_session_data(new.session_id);

  if new.status = 'confirmed' then
    if new.user_id is distinct from v_s.host_id then
      perform public.notify(v_s.host_id, 'lobby_joined', v_data || jsonb_build_object('name', public.display_name(new.user_id)));
    end if;
    select count(*) into v_taken from public.session_members where session_id = new.session_id and status = 'confirmed';
    if v_taken = v_s.max_drivers then
      perform public.notify(m.user_id, 'lobby_full', v_data) from public.session_members m
      where m.session_id = new.session_id and m.status = 'confirmed';
    end if;
  elsif v_was = 'confirmed' and new.status = 'cancelled' and new.user_id is distinct from v_s.host_id then
    perform public.notify(v_s.host_id, 'lobby_left', v_data || jsonb_build_object('name', public.display_name(new.user_id)));
  elsif new.status = 'removed' and v_was in ('confirmed', 'joined_unpaid') and auth.uid() is distinct from new.user_id then
    perform public.notify(new.user_id, 'removed_from_lobby', v_data || jsonb_build_object('refunded', 0));
  end if;
  return new;
end;
$$;
create trigger notify_member after insert or update of status on public.session_members
  for each row execute function public.trg_notify_member();

-- Session cancelled by the host or an admin: tell every driver who had a seat.
create or replace function public.trg_notify_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.cancelled_at is null and new.cancelled_at is not null then
    perform public.notify(m.user_id, 'session_cancelled', public.notification_session_data(new.id) || jsonb_build_object('by', new.cancelled_by))
    from public.session_members m
    -- Those who still had a seat (cancel_session moves them out right after this).
    where m.session_id = new.id and m.status in ('confirmed', 'joined_unpaid')
      and m.user_id is distinct from new.host_id;
  end if;
  return new;
end;
$$;
create trigger notify_cancelled after update of cancelled_at on public.sessions
  for each row execute function public.trg_notify_cancelled();

-- Chat: everyone else in the lobby, except people who blocked the author.
create or replace function public.trg_notify_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb;
begin
  if new.system or new.user_id is null then return new; end if;
  v_data := public.notification_session_data(new.session_id)
            || jsonb_build_object('name', public.display_name(new.user_id), 'preview', left(new.body, 80));
  perform public.notify(x.user_id, 'chat_message', v_data)
  from (
    select m.user_id from public.session_members m where m.session_id = new.session_id and m.status in ('confirmed', 'attended')
    union
    select s.host_id from public.sessions s where s.id = new.session_id
  ) x
  where x.user_id is not null and x.user_id <> new.user_id
    and not exists (select 1 from public.user_blocks b where b.blocker_id = x.user_id and b.blocked_id = new.user_id);
  return new;
end;
$$;
create trigger notify_message after insert on public.messages
  for each row execute function public.trg_notify_message();

-- Results posted: each driver on the sheet (except whoever posted them) confirms or disputes.
create or replace function public.trg_notify_results_posted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_by uuid;
begin
  select submitted_by into v_by from public.session_results where session_id = new.session_id;
  if new.user_id is distinct from v_by then
    perform public.notify(new.user_id, 'results_posted', public.notification_session_data(new.session_id));
  end if;
  return new;
end;
$$;
create trigger notify_results_posted after insert on public.result_entries
  for each row execute function public.trg_notify_results_posted();

-- A driver disputes: the host hears about it.
create or replace function public.trg_notify_results_disputed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.response = 'dispute' then
    perform public.notify(s.host_id, 'results_disputed', public.notification_session_data(s.id) || jsonb_build_object('name', public.display_name(new.user_id)))
    from public.sessions s where s.id = new.session_id and s.host_id is distinct from new.user_id;
  end if;
  return new;
end;
$$;
create trigger notify_results_disputed after insert or update of response on public.result_responses
  for each row execute function public.trg_notify_results_disputed();

-- Results final: km and XP for this race.
create or replace function public.trg_notify_results_final()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'race' and new.session_id is not null then
    perform public.notify(new.user_id, 'results_confirmed', public.notification_session_data(new.session_id)
      || jsonb_build_object('xp', new.xp, 'km', round(new.meters / 1000.0, 1), 'position', new.position, 'casual', case when new.casual then 1 else 0 end));
  end if;
  return new;
end;
$$;
create trigger notify_results_final after insert on public.race_ledger
  for each row execute function public.trg_notify_results_final();

-- Rank up (ranks never go down).
create or replace function public.trg_notify_rank_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rank_tier_id > old.rank_tier_id then
    perform public.notify(new.user_id, 'rank_up', jsonb_build_object('rankId', new.rank_tier_id, 'xp', new.total_xp, 'km', round(new.total_meters / 1000.0, 1)));
  end if;
  return new;
end;
$$;
create trigger notify_rank_up after update of rank_tier_id on public.user_stats
  for each row execute function public.trg_notify_rank_up();

-- ───────────────────────────── for the app ─────────────────────────────

create or replace function public.mark_notifications_read(p_id uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_id is null or id = p_id);
$$;

create or replace function public.set_notification_prefs(p_lobby boolean, p_chat boolean, p_reminders boolean, p_results boolean, p_ranking boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notification_prefs (user_id, lobby, chat, reminders, results, ranking, updated_at)
  values (auth.uid(), p_lobby, p_chat, p_reminders, p_results, p_ranking, now())
  on conflict (user_id) do update set lobby = excluded.lobby, chat = excluded.chat, reminders = excluded.reminders,
    results = excluded.results, ranking = excluded.ranking, updated_at = now();
$$;

revoke execute on function public.mark_notifications_read(uuid) from public, anon;
revoke execute on function public.set_notification_prefs(boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.mark_notifications_read(uuid) to authenticated;
grant execute on function public.set_notification_prefs(boolean, boolean, boolean, boolean, boolean) to authenticated;

-- Live: the bell updates as soon as something arrives.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
