-- =============================================================================
-- Sessions and lobbies in the real app (step 1 of the core loop).
--  * Track details the app needs (price, lap length, session length, …).
--  * sessions + session_members, readable by signed-in users; every change goes
--    through the functions below, which check the rules on the server.
--  * "Pay at the track" mode while in-app payments are off (app_config
--    payments_enabled = false): a seat is reserved for free, the track is paid at
--    the desk, no KartUP fee. Turning payments on later switches to pay-to-join.
-- Nothing existing is deleted.
-- =============================================================================

-- ── Track details ────────────────────────────────────────────────────────────
alter table public.tracks
  add column website                text,
  add column phone                  text,
  add column opening_hours          text not null default '',
  add column kart_types             text[] not null default '{}',
  add column session_length_min     int  not null default 10  check (session_length_min between 1 and 120),
  add column max_drivers            int  not null default 10  check (max_drivers between 2 and 60),
  add column indoor                 boolean not null default true,
  add column checkin_radius_m       int  check (checkin_radius_m between 50 and 2000),
  add column lap_length_m           int  not null default 600 check (lap_length_m between 100 and 10000),
  add column lap_length_verified    boolean not null default false,
  add column price_per_driver_minor int  not null default 0   check (price_per_driver_minor >= 0),
  add column currency               text not null default 'RON',
  add column price_note             text,
  add column price_source_url       text,
  add column price_verified         boolean not null default false,
  add column price_updated_at       timestamptz not null default now();

-- Values looked up on the tracks' websites (all "to verify", like in the demo).
update public.tracks set
  website = 'https://www.amckart.ro', phone = '0741 100 700', opening_hours = 'Daily from 10:00 (to verify) · floodlit at night',
  kart_types = array['6.5 CP', '13 CP', 'Two-seater 9 CP']::text[], session_length_min = 10, max_drivers = 12, indoor = false,
  lap_length_m = 1240, price_per_driver_minor = 10000, price_note = '10 min, 6.5 CP kart, non-member (13 CP kart: 120 lei). Members −10 lei. Balaclava 15 lei extra.', price_source_url = 'https://www.amckart.ro/pricing/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'amc-kart';
update public.tracks set
  website = 'https://vmaxromexpo.ro', phone = '+40 760 100 855', opening_hours = 'Booking required (to verify)',
  kart_types = array['Electric']::text[], session_length_min = 10, max_drivers = 10, indoor = true,
  lap_length_m = 700, price_per_driver_minor = 12000, price_note = '1-session package bought online, balaclava included. Event page also lists 50 lei (Mon–Fri) / 70 lei (weekend) per extra session.', price_source_url = 'https://vmaxromexpo.ro/categorie-produs/pachete-sesiuni/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-romexpo';
update public.tracks set
  website = 'https://vmaxtitan.ro', phone = '0771 240 237', opening_hours = 'Mon–Sun · groups of 8+ by reservation (to verify)',
  kart_types = array['Electric (with boost)']::text[], session_length_min = 10, max_drivers = 10, indoor = true,
  lap_length_m = 600, price_per_driver_minor = 10000, price_note = '1-session package bought online, balaclava included (3 sessions: 190 lei). Price page also lists 70–90 lei per adult session (member/non-member columns unclear). Mini Grand Prix 10 min: 90–120 lei.', price_source_url = 'https://vmaxtitan.ro/en/shop/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-titan';
update public.tracks set
  website = 'https://vmaxcluj.ro', phone = '+40 771 588 344', opening_hours = 'See website (to verify)',
  kart_types = array['Electric (Sodi RSX2)']::text[], session_length_min = 8, max_drivers = 13, indoor = true,
  lap_length_m = 500, price_per_driver_minor = 8000, price_note = '8 min adult session, weekend price (weekdays 70 lei; members 10 lei less). Another listing gives Str. Fabricii de Zahăr 165 as the address: confirm the entrance.', price_source_url = 'https://vmaxcluj.ro/en/preturi/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-cluj';
update public.tracks set
  website = 'https://vmaxbrasov.ro', phone = '+40 774 959 913', opening_hours = 'Mon–Thu 15–23, Fri 15–24, Sat 11–24, Sun 11–23 (to verify)',
  kart_types = array['Electric (Sodi RSX2)']::text[], session_length_min = 8, max_drivers = 13, indoor = true,
  lap_length_m = 600, price_per_driver_minor = 9000, price_note = '8 min adult session, non-member (members 80 lei on weekdays). Multi-level track; events page says 650 m.', price_source_url = 'https://vmaxbrasov.ro/en/preturi/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-brasov';
update public.tracks set
  website = 'https://vmaxtimisoara.ro', phone = '+40 772 232 034', opening_hours = 'See website (to verify)',
  kart_types = array['Electric (Sodi RSX2)']::text[], session_length_min = 8, max_drivers = 13, indoor = true,
  lap_length_m = 600, price_per_driver_minor = 9000, price_note = '8 min adult session, non-member (members 80 lei on weekdays). Track length: sources say 500 or 600 m.', price_source_url = 'https://vmaxtimisoara.ro/preturi/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-timisoara';

-- Tracks with their coordinates as numbers (the app can't read the PostGIS column).
create view public.track_details
with (security_invoker = true)
as
select t.id, t.city_id, t.name, t.slug, t.address,
       extensions.st_y(t.location::extensions.geometry) as lat,
       extensions.st_x(t.location::extensions.geometry) as lng,
       t.timezone, t.website, t.phone, t.opening_hours, t.kart_types, t.session_length_min,
       t.max_drivers, t.indoor, t.checkin_radius_m, t.lap_length_m, t.lap_length_verified,
       t.price_per_driver_minor, t.currency, t.price_note, t.price_source_url, t.price_verified, t.price_updated_at
from public.tracks t
where t.is_active;
grant select on public.track_details to anon, authenticated;

insert into public.app_config (key, value, description) values
  ('payments_enabled',        'false', 'In-app payments. Off = "pay at the track": free seat reservation, no KartUP fee.'),
  ('platform_fee_minor',      '1000',  'KartUP fee per driver in minor units (1000 = 10.00 RON) when payments are on.'),
  ('min_drivers',             '4',     'Smallest lobby size a host can create.'),
  ('min_start_lead_minutes',  '240',   'How far ahead a session must start when it is created.')
on conflict (key) do nothing;

create or replace function public.config_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_config where key = p_key), p_default);
$$;

-- ── Sessions and members ─────────────────────────────────────────────────────
create table public.sessions (
  id                 uuid primary key default gen_random_uuid(),
  track_id           uuid not null references public.tracks(id),
  host_id            uuid references public.profiles(id) on delete set null,   -- null = host deleted their account
  starts_at          timestamptz not null,
  max_drivers        int  not null check (max_drivers between 2 and 60),
  min_rank_tier_id   smallint references public.rank_tiers(id),
  min_skill          public.experience_level,
  note               text not null default '' check (char_length(note) <= 300),
  lobby_type         text not null default 'competitive' check (lobby_type in ('casual', 'competitive')),
  is_official_event  boolean not null default false,
  -- Price snapshot when the session was created (later track price changes don't affect it).
  track_price_minor  int  not null check (track_price_minor >= 0),
  fee_minor          int  not null default 0 check (fee_minor >= 0),
  currency           text not null default 'RON',
  price_updated_at   timestamptz not null,
  cancelled_at       timestamptz,
  cancelled_by       text check (cancelled_by in ('host', 'track', 'admin', 'system')),
  cancel_reason      text check (char_length(cancel_reason) <= 300),
  created_at         timestamptz not null default now()
);
create index sessions_starts_idx on public.sessions (starts_at);
create index sessions_track_idx  on public.sessions (track_id, starts_at);
create index sessions_host_idx   on public.sessions (host_id);

create table public.session_members (
  session_id     uuid not null references public.sessions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  status         text not null check (status in ('joined_unpaid', 'confirmed', 'attended', 'no_show', 'cancelled', 'removed')),
  joined_at      timestamptz not null default now(),
  paid_at        timestamptz,
  checked_in_at  timestamptz,
  host_confirmed boolean not null default false,
  primary key (session_id, user_id)
);
create index session_members_user_idx on public.session_members (user_id);

alter table public.sessions enable row level security;
alter table public.session_members enable row level security;
-- Everyone signed in can see sessions and who is in them; changes only through the functions below.
grant select on public.sessions, public.session_members to authenticated;
create policy "sessions readable" on public.sessions for select to authenticated using (true);
create policy "members readable"  on public.session_members for select to authenticated using (true);

-- Seats that count against the limit.
create or replace function public.session_seats_taken(p_session uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.session_members
  where session_id = p_session and status in ('confirmed', 'attended', 'no_show');
$$;

-- One row per session with everything a session card needs (host, counts, my status).
create view public.session_cards
with (security_barrier = true)
as
select s.*,
       t.city_id,
       public.session_seats_taken(s.id) as paid_count,
       (select count(*)::int from public.session_members m
         where m.session_id = s.id and m.status in ('joined_unpaid', 'confirmed', 'attended', 'no_show')) as member_count,
       (select m.status from public.session_members m where m.session_id = s.id and m.user_id = auth.uid()) as my_status,
       hp.first_name as host_first_name, hp.last_name as host_last_name,
       hp.avatar_path as host_avatar_path, hp.provider_avatar_url as host_provider_avatar_url,
       coalesce(hs.rank_tier_id, 1) as host_rank_tier_id, coalesce(hs.total_xp, 0) as host_total_xp,
       coalesce(hs.total_meters, 0) as host_total_meters
from public.sessions s
join public.tracks t on t.id = s.track_id
left join public.profiles hp on hp.id = s.host_id
left join public.user_stats hs on hs.user_id = s.host_id
where auth.uid() is not null;
grant select on public.session_cards to authenticated;

-- Lobby members with their public profile summary.
create view public.lobby_members
with (security_barrier = true)
as
select m.*, (m.user_id = s.host_id) as is_host,
       p.first_name, p.last_name, p.avatar_path, p.provider_avatar_url,
       coalesce(st.rank_tier_id, 1) as rank_tier_id, coalesce(st.total_xp, 0) as total_xp, coalesce(st.total_meters, 0) as total_meters
from public.session_members m
join public.sessions s on s.id = m.session_id
join public.profiles p on p.id = m.user_id
left join public.user_stats st on st.user_id = m.user_id
where auth.uid() is not null;
grant select on public.lobby_members to authenticated;

-- ── Rules (server side) ──────────────────────────────────────────────────────
create or replace function public.assert_can_join(p_session public.sessions, p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rank  smallint;
  v_level public.experience_level;
begin
  if p_session.cancelled_at is not null then raise exception 'session_cancelled'; end if;
  if p_session.starts_at <= now() then raise exception 'session_started'; end if;
  if p_session.min_rank_tier_id is not null then
    select rank_tier_id into v_rank from public.user_stats where user_id = p_user;
    if coalesce(v_rank, 1) < p_session.min_rank_tier_id then raise exception 'rank_too_low'; end if;
  end if;
  if p_session.min_skill is not null then
    select level into v_level from public.track_experience where user_id = p_user and track_id = p_session.track_id;
    if coalesce(v_level, 'beginner') < p_session.min_skill then raise exception 'skill_too_low'; end if;
  end if;
end;
$$;
revoke execute on function public.assert_can_join(public.sessions, uuid) from public, anon, authenticated;

create or replace function public.create_session(
  p_track uuid, p_starts_at timestamptz, p_max_drivers int, p_min_rank smallint,
  p_min_skill public.experience_level, p_note text, p_lobby_type text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := auth.uid();
  v_track   public.tracks;
  v_paid    boolean := public.config_bool('payments_enabled', false);
  v_min     int := public.config_int('min_drivers', 4);
  v_lead    int := public.config_int('min_start_lead_minutes', 240);
  v_id      uuid;
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = v_me and onboarded_at is not null) then raise exception 'profile_incomplete'; end if;
  select * into v_track from public.tracks where id = p_track and is_active;
  if not found then raise exception 'not_found'; end if;
  if p_max_drivers < v_min or p_max_drivers > v_track.max_drivers then raise exception 'invalid_max_drivers'; end if;
  if p_starts_at < now() + make_interval(mins => v_lead) then raise exception 'start_too_soon'; end if;
  if p_starts_at > now() + interval '90 days' then raise exception 'start_too_far'; end if;
  insert into public.sessions (track_id, host_id, starts_at, max_drivers, min_rank_tier_id, min_skill, note, lobby_type,
                               track_price_minor, fee_minor, currency, price_updated_at)
  values (v_track.id, v_me, p_starts_at, p_max_drivers, p_min_rank, p_min_skill, left(trim(coalesce(p_note, '')), 300),
          case when p_lobby_type = 'casual' then 'casual' else 'competitive' end,
          v_track.price_per_driver_minor, case when v_paid then public.config_int('platform_fee_minor', 1000) else 0 end,
          v_track.currency, v_track.price_updated_at)
  returning id into v_id;
  -- The host is in their own lobby: with the seat reserved in "pay at the track" mode.
  insert into public.session_members (session_id, user_id, status)
  values (v_id, v_me, case when v_paid then 'joined_unpaid' else 'confirmed' end);
  return v_id;
end;
$$;

-- "Pay at the track" mode: reserve a seat for free.
create or replace function public.reserve_seat(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_s  public.sessions;
  v_st text;
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  if public.config_bool('payments_enabled', false) then raise exception 'payment_required'; end if;
  if not exists (select 1 from public.profiles where id = v_me and onboarded_at is not null) then raise exception 'profile_incomplete'; end if;
  -- Lock the session so two people can't take the last seat at the same time.
  select * into v_s from public.sessions where id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  perform public.assert_can_join(v_s, v_me);
  select status into v_st from public.session_members where session_id = p_session and user_id = v_me;
  if v_st = 'confirmed' then return; end if;
  if public.session_seats_taken(p_session) >= v_s.max_drivers then raise exception 'session_full'; end if;
  insert into public.session_members (session_id, user_id, status) values (p_session, v_me, 'confirmed')
  on conflict (session_id, user_id) do update set status = 'confirmed', joined_at = now(), paid_at = null, checked_in_at = null, host_confirmed = false;
end;
$$;

-- Leave a lobby / give up a reserved seat (until the start). The host cancels the session instead.
create or replace function public.leave_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_s  public.sessions;
  v_st text;
begin
  select * into v_s from public.sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  if v_s.host_id = v_me then raise exception 'host_cannot_leave'; end if;
  select status into v_st from public.session_members where session_id = p_session and user_id = v_me;
  if v_st is null or v_st not in ('joined_unpaid', 'confirmed') then raise exception 'not_in_lobby'; end if;
  if v_s.starts_at <= now() then raise exception 'session_started'; end if;
  -- A paid seat needs a refund: handled by the payments step, not here.
  if v_st = 'confirmed' and v_s.fee_minor > 0 then raise exception 'refund_required'; end if;
  update public.session_members set status = case when v_st = 'confirmed' then 'cancelled' else 'removed' end
  where session_id = p_session and user_id = v_me;
end;
$$;

create or replace function public.remove_member(p_session uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s  public.sessions;
  v_st text;
begin
  select * into v_s from public.sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  if v_s.host_id is distinct from auth.uid() then raise exception 'not_host'; end if;
  if p_user = v_s.host_id then raise exception 'host_cannot_leave'; end if;
  if v_s.starts_at <= now() then raise exception 'session_started'; end if;
  select status into v_st from public.session_members where session_id = p_session and user_id = p_user;
  if v_st is null or v_st not in ('joined_unpaid', 'confirmed') then raise exception 'not_found'; end if;
  if v_st = 'confirmed' and v_s.fee_minor > 0 then raise exception 'refund_required'; end if;
  update public.session_members set status = 'removed' where session_id = p_session and user_id = p_user;
end;
$$;

create or replace function public.cancel_session(p_session uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s     public.sessions;
  v_admin boolean := public.is_admin();
begin
  select * into v_s from public.sessions where id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  if v_s.host_id is distinct from auth.uid() and not v_admin then raise exception 'not_host'; end if;
  if v_s.cancelled_at is not null then raise exception 'session_cancelled'; end if;
  if not v_admin and v_s.starts_at <= now() then raise exception 'already_started'; end if;
  if v_s.fee_minor > 0 and exists (select 1 from public.session_members where session_id = p_session and status = 'confirmed') then
    raise exception 'refund_required';
  end if;
  update public.sessions set cancelled_at = now(), cancelled_by = case when v_admin and v_s.host_id is distinct from auth.uid() then 'admin' else 'host' end,
         cancel_reason = left(coalesce(p_reason, ''), 300)
  where id = p_session;
  update public.session_members set status = case when status = 'confirmed' then 'cancelled' else 'removed' end
  where session_id = p_session and status in ('confirmed', 'joined_unpaid');
end;
$$;

revoke execute on function public.create_session(uuid, timestamptz, int, smallint, public.experience_level, text, text) from public, anon;
revoke execute on function public.reserve_seat(uuid) from public, anon;
revoke execute on function public.leave_session(uuid) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.cancel_session(uuid, text) from public, anon;
grant execute on function public.create_session(uuid, timestamptz, int, smallint, public.experience_level, text, text) to authenticated;
grant execute on function public.reserve_seat(uuid) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.cancel_session(uuid, text) to authenticated;

-- Live updates in the app (lobbies fill up in front of you). Supabase has this publication;
-- the local test database may not.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sessions, public.session_members;
  end if;
end;
$$;
