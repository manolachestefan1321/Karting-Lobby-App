-- KartUP: aplică pe baza de producție actualizările 20261102000100 … 20261109000100
-- (pentru Supabase → SQL Editor, când nu ai laptopul pentru 'npx supabase db push').
-- Doar ADAUGĂ tabele și funcții: nu șterge nimic. Tot sau nimic (o singură tranzacție).
-- Se oprește singur dacă baza nu e exact după 'founder_badge' (20261101000100).
begin;
do $$ begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261101000100') then
    raise exception 'Oprit: lipsește founder_badge (20261101000100). Nu am schimbat nimic.';
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version > '20261101000100') then
    raise exception 'Oprit: o parte din actualizări sunt deja aplicate. Nu am schimbat nimic – folosește npx supabase db push.';
  end if;
end $$;

-- ═════ 20261102000100_short_track_names ═════
-- Shorter track names, so they fit on the session cards ("VMax Romexpo" instead of
-- "VMax Electric Indoor Karting Romexpo"). Only names change; nothing is deleted.
update public.tracks set name = 'VMax Romexpo'   where slug = 'vmax-romexpo';
update public.tracks set name = 'VMax Titan'     where slug = 'vmax-titan';
update public.tracks set name = 'VMax Cluj'      where slug = 'vmax-cluj';
update public.tracks set name = 'VMax Brașov'    where slug = 'vmax-brasov';
update public.tracks set name = 'VMax Timișoara' where slug = 'vmax-timisoara';

insert into supabase_migrations.schema_migrations (version, name) values ('20261102000100', 'short_track_names');

-- ═════ 20261104000100_launch_signups ═════
-- =============================================================================
-- "Join the race": sign-ups for the launch event, from the website.
-- Anyone (even without an account) can sign up; only admins can read the list.
-- New table only — nothing existing is changed or deleted.
-- =============================================================================
create table public.launch_signups (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null check (char_length(trim(first_name)) between 1 and 50),
  last_name   text not null check (char_length(trim(last_name)) between 1 and 50),
  phone       text not null check (phone ~ '^\+?[0-9 ()\-.]{9,25}$'),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  locale      text not null default 'ro' check (locale in ('en', 'ro')),
  consent_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
-- One sign-up per email (case-insensitive).
create unique index launch_signups_email_key on public.launch_signups (lower(email));
alter table public.launch_signups enable row level security;

grant insert (first_name, last_name, phone, email, locale) on public.launch_signups to anon, authenticated;
grant select on public.launch_signups to authenticated;
create policy "anyone can join the race" on public.launch_signups for insert to anon, authenticated with check (true);
create policy "admins read sign-ups"     on public.launch_signups for select to authenticated using (public.is_admin());

insert into supabase_migrations.schema_migrations (version, name) values ('20261104000100', 'launch_signups');

-- ═════ 20261106000100_site_analytics ═════
-- =============================================================================
-- Website analytics for the owner's dashboard (Profile → Analytics).
--  * site_events: anonymous page views + heartbeats from the website. No names,
--    emails or IPs: a random visitor id (kept in the browser) and a session id.
--  * analytics_report(): every number on the dashboard, for the FOUNDER only.
-- New table + functions only — nothing existing is changed or deleted.
-- =============================================================================
create table public.site_events (
  id          bigint generated always as identity primary key,
  visitor_id  uuid not null,
  session_id  uuid not null,
  kind        text not null check (kind in ('pageview', 'heartbeat')),
  path        text not null check (char_length(path) between 1 and 200),
  referrer    text check (char_length(referrer) <= 200),
  utm_source  text check (char_length(utm_source) <= 80),
  device      text not null check (device in ('mobile', 'tablet', 'desktop')),
  created_at  timestamptz not null default now()
);
create index site_events_created_idx on public.site_events (created_at);
create index site_events_session_idx on public.site_events (session_id, created_at);
alter table public.site_events enable row level security;

-- Visitors can only add events (with the server's clock); nobody reads them directly.
grant insert (visitor_id, session_id, kind, path, referrer, utm_source, device) on public.site_events to anon, authenticated;
create policy "anyone can send site events" on public.site_events for insert to anon, authenticated with check (true);

create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and 'founder' = any(badges));
$$;
revoke execute on function public.is_founder() from public, anon;
grant execute on function public.is_founder() to authenticated;

-- One call returns the whole dashboard for the last p_seconds, in p_buckets time buckets,
-- with the previous period of the same length for comparison.
create or replace function public.analytics_report(p_seconds int, p_buckets int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now   timestamptz := now();
  v_from  timestamptz;
  v_prev  timestamptz;
  v_step  double precision;
  v_out   jsonb;
begin
  if not public.is_founder() then
    raise exception 'founder_only' using errcode = '42501';
  end if;
  if p_seconds not between 300 and 400 * 86400 or p_buckets not between 1 and 120 then
    raise exception 'bad_range' using errcode = '22023';
  end if;
  v_from := v_now - make_interval(secs => p_seconds);
  v_prev := v_from - make_interval(secs => p_seconds);
  v_step := p_seconds::double precision / p_buckets;

  with cur as (select * from public.site_events where created_at >= v_from),
       prev as (select * from public.site_events where created_at >= v_prev and created_at < v_from),
       sess as (
         select session_id, count(*) filter (where kind = 'pageview') as views,
                extract(epoch from max(created_at) - min(created_at)) as secs
         from cur group by session_id
       ),
       series as (
         select b, coalesce(count(distinct e.visitor_id), 0) as visitors,
                coalesce(count(*) filter (where e.kind = 'pageview'), 0) as pageviews
         from generate_series(0, p_buckets - 1) b
         left join cur e on floor(extract(epoch from e.created_at - v_from) / v_step) = b
         group by b order by b
       )
  select jsonb_build_object(
    'visitors',        (select count(distinct visitor_id) from cur),
    'visitorsPrev',    (select count(distinct visitor_id) from prev),
    'sessions',        (select count(*) from sess),
    'sessionsPrev',    (select count(distinct session_id) from prev),
    'pageviews',       (select count(*) from cur where kind = 'pageview'),
    'pageviewsPrev',   (select count(*) from prev where kind = 'pageview'),
    'onlineNow',       (select count(distinct session_id) from public.site_events where created_at >= v_now - interval '5 minutes'),
    'avgSessionSecs',  (select coalesce(round(avg(secs)), 0) from sess),
    'bounceRate',      (select coalesce(round(100.0 * count(*) filter (where views <= 1) / nullif(count(*), 0)), 0) from sess),
    'waitlist',        (select count(*) from public.launch_signups where created_at >= v_from),
    'waitlistPrev',    (select count(*) from public.launch_signups where created_at >= v_prev and created_at < v_from),
    'waitlistTotal',   (select count(*) from public.launch_signups),
    'accounts',        (select count(*) from public.profiles where created_at >= v_from),
    'accountsPrev',    (select count(*) from public.profiles where created_at >= v_prev and created_at < v_from),
    'accountsTotal',   (select count(*) from public.profiles),
    'series',          (select coalesce(jsonb_agg(jsonb_build_object('visitors', visitors, 'pageviews', pageviews) order by b), '[]') from series),
    'topPages',        (select coalesce(jsonb_agg(jsonb_build_object('label', path, 'count', n) order by n desc), '[]')
                        from (select path, count(*) n from cur where kind = 'pageview' group by path order by n desc limit 6) t),
    'sources',         (select coalesce(jsonb_agg(jsonb_build_object('label', src, 'count', n) order by n desc), '[]')
                        from (select coalesce(utm_source, nullif(referrer, ''), 'direct') src, count(distinct session_id) n
                              from cur where kind = 'pageview' group by 1 order by n desc limit 6) t),
    'devices',         (select coalesce(jsonb_agg(jsonb_build_object('label', device, 'count', n) order by n desc), '[]')
                        from (select device, count(distinct visitor_id) n from cur group by device) t)
  ) into v_out;
  return v_out;
end;
$$;
revoke execute on function public.analytics_report(int, int) from public, anon;
grant execute on function public.analytics_report(int, int) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261106000100', 'site_analytics');

-- ═════ 20261106000200_cookie_consent ═════
-- =============================================================================
-- Cookie consent (website): proof of each choice (GDPR Art. 7(1): we must be able
-- to show consent was given), and automatic deletion of old data as the privacy
-- policy promises: website statistics after 13 months, consent records after 3 years.
-- New table + triggers only — nothing existing is changed or deleted.
-- =============================================================================
create table public.consent_log (
  id          bigint generated always as identity primary key,
  consent_id  uuid not null,            -- random id kept with the choice in the browser
  analytics   boolean not null,
  version     text not null check (char_length(version) <= 20),
  locale      text not null default 'ro' check (locale in ('en', 'ro')),
  created_at  timestamptz not null default now()
);
create index consent_log_consent_idx on public.consent_log (consent_id, created_at);
alter table public.consent_log enable row level security;
grant insert (consent_id, analytics, version, locale) on public.consent_log to anon, authenticated;
create policy "anyone records their own choice" on public.consent_log for insert to anon, authenticated with check (true);
create policy "founder reads consent records" on public.consent_log for select to authenticated using (public.is_founder());

-- Retention: deletes what the privacy policy says we no longer keep.
create or replace function public.purge_expired_site_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.site_events where created_at < now() - interval '13 months';
  delete from public.consent_log where created_at < now() - interval '3 years';
$$;
revoke execute on function public.purge_expired_site_data() from public, anon, authenticated;

-- Runs the purge on about 1% of inserts, so no scheduler is needed.
create or replace function public.purge_expired_site_data_sometimes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if random() < 0.01 then
    perform public.purge_expired_site_data();
  end if;
  return null;
end;
$$;
revoke execute on function public.purge_expired_site_data_sometimes() from public, anon, authenticated;
create trigger site_events_retention after insert on public.site_events
  for each statement execute function public.purge_expired_site_data_sometimes();
create trigger consent_log_retention after insert on public.consent_log
  for each statement execute function public.purge_expired_site_data_sometimes();

insert into supabase_migrations.schema_migrations (version, name) values ('20261106000200', 'cookie_consent');

-- ═════ 20261107000100_sessions_lobbies ═════
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

insert into supabase_migrations.schema_migrations (version, name) values ('20261107000100', 'sessions_lobbies');

-- ═════ 20261107000200_chat_moderation ═════
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

insert into supabase_migrations.schema_migrations (version, name) values ('20261107000200', 'chat_moderation');

-- ═════ 20261107000300_results_ranking ═════
-- =============================================================================
-- Results, XP / km / ranks and leaderboards (steps 3–4 of the core loop).
--  * The host enters the finishing order after the start; the other drivers have
--    24 h to confirm or dispute. No dispute → final → VERIFIED: XP + km + rank.
--    A dispute goes to an admin. Results entered by an admin are final at once.
--  * XP rules mirror config/progression.ts (keep them in sync; tested in
--    supabase/tests/results_ranking.test.sql with the same numbers as the app).
--  * race_ledger: one row per driver per verified race → history and leaderboards.
--  * Stats are ADDED to user_stats, so history entered by hand (founder) is kept.
-- New tables + functions; the session_cards view gets a results_status column.
-- Nothing is deleted.
-- =============================================================================
insert into public.app_config (key, value, description) values
  ('results_confirm_hours', '24', 'Hours drivers have to confirm or dispute results before they become final.')
on conflict (key) do nothing;

create table public.session_results (
  session_id      uuid primary key references public.sessions(id) on delete cascade,
  submitted_by    uuid references public.profiles(id) on delete set null,
  submitted_at    timestamptz not null default now(),
  deadline        timestamptz not null,
  source          text not null check (source in ('organizer', 'admin')),
  printout_path   text check (char_length(printout_path) <= 300),   -- photo of the timing sheet (storage: timing-sheets)
  admin_decision  text check (admin_decision in ('approved', 'rejected')),
  finalized_at    timestamptz
);

create table public.result_entries (
  session_id   uuid not null references public.session_results(session_id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  position     int  not null check (position between 1 and 60),
  laps         int  not null check (laps between 0 and 500),
  best_lap_ms  int  check (best_lap_ms between 5000 and 600000),
  primary key (session_id, user_id),
  unique (session_id, position)
);

create table public.result_responses (
  session_id  uuid not null references public.session_results(session_id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  response    text not null check (response in ('confirm', 'dispute')),
  comment     text check (char_length(comment) <= 300),
  created_at  timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- One row per driver per verified race (penalties come later). Source of history and leaderboards.
create table public.race_ledger (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  session_id   uuid references public.sessions(id) on delete set null,
  track_id     uuid not null references public.tracks(id),
  city_id      uuid not null references public.cities(id),
  raced_at     timestamptz not null,
  season       text not null check (season ~ '^\d{4}-\d{2}$'),          -- YYYY-MM in the track's time zone
  kind         text not null default 'race' check (kind in ('race', 'penalty')),
  casual       boolean not null default false,                         -- Casual lobby: history only
  position     int  not null,
  field_size   int  not null,
  laps         int  not null,
  best_lap_ms  int,
  meters       int  not null,
  xp           int  not null,
  breakdown    jsonb,
  source       text not null,
  created_at   timestamptz not null default now()
);
create index race_ledger_user_idx   on public.race_ledger (user_id, raced_at);
create index race_ledger_scope_idx  on public.race_ledger (city_id, track_id, season);

alter table public.session_results enable row level security;
alter table public.result_entries enable row level security;
alter table public.result_responses enable row level security;
alter table public.race_ledger enable row level security;
-- Results and race history are visible to signed-in drivers; changes only through the functions below.
grant select on public.session_results, public.result_entries, public.result_responses, public.race_ledger to authenticated;
create policy "results readable"   on public.session_results  for select to authenticated using (true);
create policy "entries readable"   on public.result_entries   for select to authenticated using (true);
create policy "responses readable" on public.result_responses for select to authenticated using (true);
create policy "ledger readable"    on public.race_ledger      for select to authenticated using (true);

-- ── XP for one race (config/progression.ts) ──────────────────────────────────
create or replace function public.session_xp(p_position int, p_field int, p_fastest boolean, p_pb boolean, p_new_track boolean, p_official boolean)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_part   int := 25;
  v_pos    int := case when p_field <= 1 then 0 else round((150.0 * (p_field - p_position)) / (p_field - 1)) end;
  v_podium int := case when p_field >= 4 then case p_position when 1 then 50 when 2 then 30 when 3 then 15 else 0 end else 0 end;
  v_fast   int := case when p_fastest then 20 else 0 end;
  v_pb     int := case when p_pb then 15 else 0 end;
  v_new    int := case when p_new_track then 30 else 0 end;
  v_mult   numeric := case when p_official then 1.5 else 1 end;
begin
  return jsonb_build_object(
    'participation', v_part, 'position', v_pos, 'podium', v_podium, 'fastestLap', v_fast,
    'personalBest', v_pb, 'newTrack', v_new, 'multiplier', v_mult,
    'total', round((v_part + v_pos + v_podium + v_fast + v_pb + v_new) * v_mult)::int);
end;
$$;

-- ── Results state: pending → (confirmed by all | 24 h) final; dispute → admin ──
create or replace function public.results_state(p_session uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when r.admin_decision = 'approved' then 'final'
    when r.admin_decision = 'rejected' then 'rejected'
    when exists (select 1 from public.result_responses x where x.session_id = r.session_id and x.response = 'dispute') then 'disputed'
    when r.finalized_at is not null then 'final'
    when now() >= r.deadline then 'final'
    when not exists (
      select 1 from public.result_entries e
      where e.session_id = r.session_id and e.user_id is distinct from r.submitted_by
        and not exists (select 1 from public.result_responses x where x.session_id = r.session_id and x.user_id = e.user_id and x.response = 'confirm')
    ) then 'final'
    else 'pending'
  end
  from public.session_results r where r.session_id = p_session;
$$;
revoke execute on function public.results_state(uuid) from public, anon;
grant execute on function public.results_state(uuid) to authenticated;

-- ── Final → verified: XP, km, rank, track experience ─────────────────────────
create or replace function public.finalize_results(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r        public.session_results;
  v_s        public.sessions;
  v_t        public.tracks;
  v_n        int;
  v_casual   boolean;
  v_fastest  int;
  v_season   text;
  v_e        record;
  v_prev     int;
  v_count    int;
  v_br       jsonb;
  v_xp       int;
  v_m        int;
begin
  select * into v_r from public.session_results where session_id = p_session for update;
  if not found or v_r.finalized_at is not null then return; end if;
  select * into v_s from public.sessions where id = p_session;
  select * into v_t from public.tracks where id = v_s.track_id;
  select count(*) into v_n from public.result_entries where session_id = p_session;
  v_casual := v_s.lobby_type = 'casual' and not v_s.is_official_event;
  v_fastest := case when v_n > 1 then (select min(best_lap_ms) from public.result_entries where session_id = p_session) end;
  v_season := to_char(v_s.starts_at at time zone v_t.timezone, 'YYYY-MM');

  for v_e in select * from public.result_entries where session_id = p_session order by position loop
    -- Earlier verified Competitive races at this track: new-track and personal-best bonuses.
    select min(best_lap_ms), count(*) into v_prev, v_count from public.race_ledger
    where user_id = v_e.user_id and track_id = v_t.id and kind = 'race' and not casual and raced_at < v_s.starts_at;
    v_br := public.session_xp(v_e.position, v_n, v_fastest is not null and v_e.best_lap_ms = v_fastest,
                              v_prev is not null and v_e.best_lap_ms is not null and v_e.best_lap_ms < v_prev, v_count = 0, v_s.is_official_event);
    v_xp := case when v_casual then 0 else (v_br->>'total')::int end;
    v_m  := case when v_casual then 0 else v_e.laps * v_t.lap_length_m end;
    insert into public.race_ledger (user_id, session_id, track_id, city_id, raced_at, season, casual, position, field_size, laps, best_lap_ms, meters, xp, breakdown, source)
    values (v_e.user_id, p_session, v_t.id, v_t.city_id, v_s.starts_at, v_season, v_casual, v_e.position, v_n, v_e.laps, v_e.best_lap_ms, v_m, v_xp,
            case when v_casual then null else v_br end, v_r.source);
    if not v_casual then
      update public.user_stats set
        total_xp       = greatest(0, total_xp + v_xp),
        total_meters   = total_meters + v_m,
        sessions_raced = sessions_raced + 1,
        wins           = wins + case when v_e.position = 1 then 1 else 0 end,
        tracks_visited = tracks_visited + case when v_count = 0 then 1 else 0 end
      where user_id = v_e.user_id;
      -- Ranks only go up.
      update public.user_stats set rank_tier_id = greatest(rank_tier_id, public.rank_tier_for_progress(total_meters / 1000.0, total_xp))
      where user_id = v_e.user_id;
    end if;
    -- Keep the driver's track experience in sync (sessions and best lap).
    update public.track_experience set
      sessions_count = sessions_count + 1,
      best_lap_ms = case when v_e.best_lap_ms is not null and (best_lap_ms is null or v_e.best_lap_ms < best_lap_ms) then v_e.best_lap_ms else best_lap_ms end
    where user_id = v_e.user_id and track_id = v_t.id;
  end loop;
  update public.session_results set finalized_at = now() where session_id = p_session;
end;
$$;
revoke execute on function public.finalize_results(uuid) from public, anon, authenticated;

-- Results whose 24 h passed without a dispute. Called when results or leaderboards are read
-- (and by pg_cron every 10 minutes when that extension is switched on).
create or replace function public.finalize_due_results()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select session_id from public.session_results where finalized_at is null and admin_decision is null loop
    if public.results_state(v_id) = 'final' then perform public.finalize_results(v_id); end if;
  end loop;
end;
$$;
revoke execute on function public.finalize_due_results() from public, anon, authenticated;

-- ── Actions ─────────────────────────────────────────────────────────────────
create or replace function public.submit_results(p_session uuid, p_entries jsonb, p_printout_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := auth.uid();
  v_s     public.sessions;
  v_admin boolean := false;
  v_n     int;
begin
  select * into v_s from public.sessions where id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  if v_s.host_id is distinct from v_me then
    if not public.is_admin() then raise exception 'not_host'; end if;
    v_admin := true;
  end if;
  if v_s.cancelled_at is not null then raise exception 'session_cancelled'; end if;
  if now() < v_s.starts_at then raise exception 'results_too_early'; end if;
  if exists (select 1 from public.session_results where session_id = p_session) then raise exception 'results_exist'; end if;

  drop table if exists _entries;
  create temp table _entries on commit drop as
    select * from jsonb_to_recordset(coalesce(p_entries, '[]')) as x(user_id uuid, position int, laps int, best_lap_ms int);
  select count(*) into v_n from _entries;
  if v_n = 0 then raise exception 'results_empty'; end if;
  if (select count(distinct user_id) from _entries) <> v_n then raise exception 'results_duplicate_driver'; end if;
  -- Only drivers with a seat in this lobby can be classified.
  if exists (select 1 from _entries e where not exists (
      select 1 from public.session_members m where m.session_id = p_session and m.user_id = e.user_id and m.status in ('confirmed', 'attended'))) then
    raise exception 'results_unknown_driver';
  end if;
  if (select array_agg(position order by position) from _entries) is distinct from (select array_agg(g) from generate_series(1, v_n) g) then
    raise exception 'results_bad_positions';
  end if;
  if exists (select 1 from _entries where laps is null or laps not between 0 and 500) then raise exception 'results_bad_laps'; end if;
  if exists (select 1 from _entries where best_lap_ms is not null and best_lap_ms not between 5000 and 600000) then raise exception 'results_bad_lap_time'; end if;

  insert into public.session_results (session_id, submitted_by, deadline, source, printout_path)
  values (p_session, v_me, now() + make_interval(hours => public.config_int('results_confirm_hours', 24)),
          case when v_admin then 'admin' else 'organizer' end, nullif(trim(p_printout_path), ''));
  insert into public.result_entries (session_id, user_id, position, laps, best_lap_ms)
  select p_session, user_id, position, laps, best_lap_ms from _entries;
  update public.session_members set status = 'attended'
  where session_id = p_session and status = 'confirmed' and user_id in (select user_id from _entries);
  -- Admin results are final at once; so are results nobody else has to confirm.
  if v_admin then
    update public.session_results set admin_decision = 'approved' where session_id = p_session;
  end if;
  if public.results_state(p_session) = 'final' then perform public.finalize_results(p_session); end if;
end;
$$;

create or replace function public.respond_results(p_session uuid, p_response text, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_r  public.session_results;
begin
  select * into v_r from public.session_results where session_id = p_session for update;
  if not found then raise exception 'not_found'; end if;
  if public.results_state(p_session) <> 'pending' then raise exception 'results_final'; end if;
  if v_r.submitted_by = v_me then raise exception 'host_cannot_respond'; end if;
  if not exists (select 1 from public.result_entries where session_id = p_session and user_id = v_me) then raise exception 'not_participant'; end if;
  if exists (select 1 from public.result_responses where session_id = p_session and user_id = v_me) then raise exception 'already_responded'; end if;
  insert into public.result_responses (session_id, user_id, response, comment)
  values (p_session, v_me, case when p_response = 'dispute' then 'dispute' else 'confirm' end, left(nullif(trim(p_comment), ''), 300));
  if public.results_state(p_session) = 'final' then perform public.finalize_results(p_session); end if;
end;
$$;

-- Admin decision on disputed results.
create or replace function public.admin_decide_results(p_session uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if public.results_state(p_session) is distinct from 'disputed' then raise exception 'not_disputed'; end if;
  update public.session_results set admin_decision = case when p_approve then 'approved' else 'rejected' end where session_id = p_session;
  if p_approve then perform public.finalize_results(p_session); end if;
end;
$$;

-- Everything the results screen shows, in one call (finalizes them first if their time came).
create or replace function public.get_session_results(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.session_results;
  v_s public.sessions;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into v_r from public.session_results where session_id = p_session;
  if not found then return null; end if;
  if v_r.finalized_at is null and v_r.admin_decision is null and public.results_state(p_session) = 'final' then
    perform public.finalize_results(p_session);
  end if;
  select * into v_s from public.sessions where id = p_session;
  return jsonb_build_object(
    'sessionId', p_session,
    'submittedBy', v_r.submitted_by,
    'submittedAt', v_r.submitted_at,
    'deadline', v_r.deadline,
    'status', public.results_state(p_session),
    'source', v_r.source,
    'lobbyType', case when v_s.lobby_type = 'casual' and not v_s.is_official_event then 'casual' else 'competitive' end,
    'printoutPath', v_r.printout_path,
    'entries', (select coalesce(jsonb_agg(jsonb_build_object(
        'userId', e.user_id, 'position', e.position, 'laps', e.laps, 'bestLapMs', e.best_lap_ms,
        'xp', case when l.id is not null and not l.casual then l.xp end,
        'km', case when l.id is not null and not l.casual then l.meters / 1000.0 end,
        'breakdown', case when l.id is not null and not l.casual then l.breakdown end) order by e.position), '[]')
      from public.result_entries e
      left join public.race_ledger l on l.session_id = e.session_id and l.user_id = e.user_id and l.kind = 'race'
      where e.session_id = p_session),
    'responses', (select coalesce(jsonb_agg(jsonb_build_object('userId', x.user_id, 'response', x.response, 'comment', x.comment) order by x.created_at), '[]')
      from public.result_responses x where x.session_id = p_session));
end;
$$;

-- ── Leaderboards ────────────────────────────────────────────────────────────
-- Global: everyone's total (includes history entered by hand). City / track / season: verified races there.
create or replace function public.leaderboard(p_kind text, p_city uuid, p_track uuid, p_season text)
returns table (user_id uuid, first_name text, last_name text, avatar_path text, provider_avatar_url text, rank_tier_id smallint,
               total_xp int, total_meters bigint, xp int, meters bigint, sessions int, wins int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  perform public.finalize_due_results();
  if p_kind = 'global' then
    return query
      select p.id, p.first_name, p.last_name, p.avatar_path, p.provider_avatar_url, p.rank_tier_id, p.total_xp, p.total_meters,
             p.total_xp, p.total_meters, p.sessions_raced, p.wins
      from public.public_profiles p
      where p.sessions_raced > 0 or p.total_xp > 0
      order by p.total_xp desc, p.wins desc
      limit 100;
  else
    return query
      select p.id, p.first_name, p.last_name, p.avatar_path, p.provider_avatar_url, p.rank_tier_id, p.total_xp, p.total_meters,
             greatest(0, sum(l.xp))::int, sum(l.meters)::bigint,
             (count(*) filter (where l.kind = 'race'))::int, (count(*) filter (where l.kind = 'race' and l.position = 1))::int
      from public.race_ledger l
      join public.public_profiles p on p.id = l.user_id
      where not l.casual
        and (p_kind <> 'city'   or l.city_id = p_city)
        and (p_kind <> 'track'  or l.track_id = p_track)
        and (p_kind <> 'season' or l.season = p_season)
      group by p.id, p.first_name, p.last_name, p.avatar_path, p.provider_avatar_url, p.rank_tier_id, p.total_xp, p.total_meters
      having count(*) filter (where l.kind = 'race') > 0
      order by 9 desc, 12 desc
      limit 100;
  end if;
end;
$$;

create or replace function public.race_seasons()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct season from public.race_ledger where not casual order by season desc;
$$;

revoke execute on function public.submit_results(uuid, jsonb, text) from public, anon;
revoke execute on function public.respond_results(uuid, text, text) from public, anon;
revoke execute on function public.admin_decide_results(uuid, boolean) from public, anon;
revoke execute on function public.get_session_results(uuid) from public, anon;
revoke execute on function public.leaderboard(text, uuid, uuid, text) from public, anon;
revoke execute on function public.race_seasons() from public, anon;
grant execute on function public.submit_results(uuid, jsonb, text) to authenticated;
grant execute on function public.respond_results(uuid, text, text) to authenticated;
grant execute on function public.admin_decide_results(uuid, boolean) to authenticated;
grant execute on function public.get_session_results(uuid) to authenticated;
grant execute on function public.leaderboard(text, uuid, uuid, text) to authenticated;
grant execute on function public.race_seasons() to authenticated;

-- Session cards also show the results state.
create or replace view public.session_cards
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
       coalesce(hs.total_meters, 0) as host_total_meters,
       public.results_state(s.id) as results_status
from public.sessions s
join public.tracks t on t.id = s.track_id
left join public.profiles hp on hp.id = s.host_id
left join public.user_stats hs on hs.user_id = s.host_id
where auth.uid() is not null;

-- ── Photo of the timing sheet (private: signed-in drivers only) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('timing-sheets', 'timing-sheets', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "timing sheets readable" on storage.objects for select to authenticated
  using (bucket_id = 'timing-sheets');
-- Only the session's host (or an admin) uploads, inside timing-sheets/<session id>/.
create policy "timing sheets host upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'timing-sheets' and (
    public.is_admin() or exists (select 1 from public.sessions s where s.id::text = (storage.foldername(name))[1] and s.host_id = auth.uid())));

-- Finalize results every 10 minutes when pg_cron is switched on (Supabase → Database → Extensions).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('kartup-finalize-results', '*/10 * * * *', 'select public.finalize_due_results()');
  end if;
end;
$$;

-- ── Admin tools ──────────────────────────────────────────────────────────────
-- Disputed results waiting for a decision, with who disputed and why.
create or replace function public.admin_disputed_results()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'sessionId', r.session_id, 'trackName', t.name, 'startsAt', s.starts_at, 'timezone', t.timezone,
      'disputes', (select coalesce(jsonb_agg(jsonb_build_object('name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), 'comment', x.comment)), '[]')
                   from public.result_responses x left join public.profiles p on p.id = x.user_id
                   where x.session_id = r.session_id and x.response = 'dispute')) order by s.starts_at), '[]')
    from public.session_results r
    join public.sessions s on s.id = r.session_id
    join public.tracks t on t.id = s.track_id
    where public.results_state(r.session_id) = 'disputed');
end;
$$;

-- Official KartUP event (XP × 1.5, always Competitive). Only before results exist.
create or replace function public.set_official_event(p_session uuid, p_official boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if exists (select 1 from public.session_results where session_id = p_session) then raise exception 'results_exist'; end if;
  update public.sessions set is_official_event = p_official,
         lobby_type = case when p_official then 'competitive' else lobby_type end
  where id = p_session;
  if not found then raise exception 'not_found'; end if;
end;
$$;

revoke execute on function public.admin_disputed_results() from public, anon;
revoke execute on function public.set_official_event(uuid, boolean) from public, anon;
grant execute on function public.admin_disputed_results() to authenticated;
grant execute on function public.set_official_event(uuid, boolean) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261107000300', 'results_ranking');

-- ═════ 20261107000400_analytics_karting ═════
-- =============================================================================
-- Owner analytics: karting sessions now come from the real sessions table
-- (upcoming lobbies, at the track now, races held in the period).
-- Replaces the report function only; nothing is deleted.
-- =============================================================================
create or replace function public.analytics_report(p_seconds int, p_buckets int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now   timestamptz := now();
  v_from  timestamptz;
  v_prev  timestamptz;
  v_step  double precision;
  v_out   jsonb;
begin
  if not public.is_founder() then
    raise exception 'founder_only' using errcode = '42501';
  end if;
  if p_seconds not between 300 and 400 * 86400 or p_buckets not between 1 and 120 then
    raise exception 'bad_range' using errcode = '22023';
  end if;
  v_from := v_now - make_interval(secs => p_seconds);
  v_prev := v_from - make_interval(secs => p_seconds);
  v_step := p_seconds::double precision / p_buckets;

  with cur as (select * from public.site_events where created_at >= v_from),
       prev as (select * from public.site_events where created_at >= v_prev and created_at < v_from),
       sess as (
         select session_id, count(*) filter (where kind = 'pageview') as views,
                extract(epoch from max(created_at) - min(created_at)) as secs
         from cur group by session_id
       ),
       series as (
         select b, coalesce(count(distinct e.visitor_id), 0) as visitors,
                coalesce(count(*) filter (where e.kind = 'pageview'), 0) as pageviews
         from generate_series(0, p_buckets - 1) b
         left join cur e on floor(extract(epoch from e.created_at - v_from) / v_step) = b
         group by b order by b
       )
  select jsonb_build_object(
    'visitors',        (select count(distinct visitor_id) from cur),
    'visitorsPrev',    (select count(distinct visitor_id) from prev),
    'sessions',        (select count(*) from sess),
    'sessionsPrev',    (select count(distinct session_id) from prev),
    'pageviews',       (select count(*) from cur where kind = 'pageview'),
    'pageviewsPrev',   (select count(*) from prev where kind = 'pageview'),
    'onlineNow',       (select count(distinct session_id) from public.site_events where created_at >= v_now - interval '5 minutes'),
    'avgSessionSecs',  (select coalesce(round(avg(secs)), 0) from sess),
    'bounceRate',      (select coalesce(round(100.0 * count(*) filter (where views <= 1) / nullif(count(*), 0)), 0) from sess),
    'waitlist',        (select count(*) from public.launch_signups where created_at >= v_from),
    'waitlistPrev',    (select count(*) from public.launch_signups where created_at >= v_prev and created_at < v_from),
    'waitlistTotal',   (select count(*) from public.launch_signups),
    'accounts',        (select count(*) from public.profiles where created_at >= v_from),
    'accountsPrev',    (select count(*) from public.profiles where created_at >= v_prev and created_at < v_from),
    'accountsTotal',   (select count(*) from public.profiles),
    'series',          (select coalesce(jsonb_agg(jsonb_build_object('visitors', visitors, 'pageviews', pageviews) order by b), '[]') from series),
    'topPages',        (select coalesce(jsonb_agg(jsonb_build_object('label', path, 'count', n) order by n desc), '[]')
                        from (select path, count(*) n from cur where kind = 'pageview' group by path order by n desc limit 6) t),
    'sources',         (select coalesce(jsonb_agg(jsonb_build_object('label', src, 'count', n) order by n desc), '[]')
                        from (select coalesce(utm_source, nullif(referrer, ''), 'direct') src, count(distinct session_id) n
                              from cur where kind = 'pageview' group by 1 order by n desc limit 6) t),
    'devices',         (select coalesce(jsonb_agg(jsonb_build_object('label', device, 'count', n) order by n desc), '[]')
                        from (select device, count(distinct visitor_id) n from cur group by device) t),
    -- Karting sessions: upcoming lobbies, the ones at the track right now, and races held in the period.
    'karting', jsonb_build_object(
      'active',  (select count(*) from public.sessions where cancelled_at is null and starts_at > v_now),
      'liveNow', (select count(*) from public.sessions where cancelled_at is null and starts_at between v_now - interval '30 minutes' and v_now + interval '30 minutes'),
      'raced',   (select count(*) from public.sessions where cancelled_at is null and starts_at between v_from and v_now))
  ) into v_out;
  return v_out;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name) values ('20261107000400', 'analytics_karting');

-- ═════ 20261108000100_booking_codes_track_report ═════
-- =============================================================================
-- Booking codes + monthly report per track (getting paid by tracks for the
-- drivers KartUP brings, while seats are paid at the track).
--  * Every reserved seat gets a short code (KUP-4821) the driver says at the desk.
--    Only the driver, the session's host and admins can see it.
--  * track_report(): per track and month, the seats booked through KartUP for
--    sessions that took place, with their codes. Founder only.
-- Adds a column, a trigger and functions; nothing is deleted.
-- =============================================================================
alter table public.session_members add column booking_code text unique check (booking_code ~ '^KUP-[A-Z2-9]{4}$');

-- Short and easy to read out loud: no 0/O, 1/I/L.
create or replace function public.new_booking_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code  text;
begin
  loop
    v_code := 'KUP-' || (select string_agg(substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1), '') from generate_series(1, 4));
    exit when not exists (select 1 from public.session_members where booking_code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke execute on function public.new_booking_code() from public, anon, authenticated;

create or replace function public.assign_booking_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('confirmed', 'attended') and new.booking_code is null then
    new.booking_code := public.new_booking_code();
  end if;
  return new;
end;
$$;
revoke execute on function public.assign_booking_code() from public, anon, authenticated;
create trigger session_members_booking_code before insert or update of status on public.session_members
  for each row execute function public.assign_booking_code();

-- Seats reserved before this migration get a code too (one by one, so codes never clash).
do $$
declare
  v record;
begin
  for v in select session_id, user_id from public.session_members where status in ('confirmed', 'attended') and booking_code is null loop
    update public.session_members set booking_code = public.new_booking_code() where session_id = v.session_id and user_id = v.user_id;
  end loop;
end;
$$;

-- Lobby members: the code is shown only to the driver, the host and admins.
create or replace view public.lobby_members
with (security_barrier = true)
as
select m.session_id, m.user_id, m.status, m.joined_at, m.paid_at, m.checked_in_at, m.host_confirmed,
       (m.user_id = s.host_id) as is_host,
       p.first_name, p.last_name, p.avatar_path, p.provider_avatar_url,
       coalesce(st.rank_tier_id, 1) as rank_tier_id, coalesce(st.total_xp, 0) as total_xp, coalesce(st.total_meters, 0) as total_meters,
       case when m.user_id = auth.uid() or s.host_id = auth.uid() or public.is_admin() then m.booking_code end as booking_code
from public.session_members m
join public.sessions s on s.id = m.session_id
join public.profiles p on p.id = m.user_id
left join public.user_stats st on st.user_id = m.user_id
where auth.uid() is not null;

-- Session cards: my own code.
create or replace view public.session_cards
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
       coalesce(hs.total_meters, 0) as host_total_meters,
       public.results_state(s.id) as results_status,
       (select m.booking_code from public.session_members m where m.session_id = s.id and m.user_id = auth.uid()) as my_booking_code
from public.sessions s
join public.tracks t on t.id = s.track_id
left join public.profiles hp on hp.id = s.host_id
left join public.user_stats hs on hs.user_id = s.host_id
where auth.uid() is not null;

-- Per track, for one month (YYYY-MM, track time zone): seats booked through KartUP in
-- sessions that already took place and weren't cancelled — what you invoice the track for.
create or replace function public.track_report(p_month text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_founder() then raise exception 'admin_only'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'bad_month'; end if;
  return (
    select coalesce(jsonb_agg(x order by x->>'trackName'), '[]')
    from (
      select jsonb_build_object(
        'trackId', t.id, 'trackName', t.name,
        'sessions', count(distinct s.id),
        'drivers', count(*),
        'rows', jsonb_agg(jsonb_build_object(
          'code', m.booking_code,
          'driver', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
          'startsAt', s.starts_at,
          'sessionId', s.id,
          'status', m.status) order by s.starts_at, p.last_name)) as x
      from public.session_members m
      join public.sessions s on s.id = m.session_id
      join public.tracks t on t.id = s.track_id
      left join public.profiles p on p.id = m.user_id
      where m.status in ('confirmed', 'attended')
        and s.cancelled_at is null
        and s.starts_at <= now()
        and to_char(s.starts_at at time zone t.timezone, 'YYYY-MM') = p_month
      group by t.id, t.name
    ) r
  );
end;
$$;
revoke execute on function public.track_report(text) from public, anon;
grant execute on function public.track_report(text) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261108000100', 'booking_codes_track_report');

-- ═════ 20261108000200_track_partners ═════
-- =============================================================================
-- Track partner panel: what a track like VMax uses at the desk and to see the
-- value KartUP brings. Track staff (added by the founder) see their own track only.
--  * desk: today's and upcoming sessions with drivers, booking codes, "arrived".
--  * stats: drivers brought, new customers, money brought to the track,
--    off-peak drivers, arrivals, upcoming bookings — per month.
--  * report: the month's list with codes (CSV in the app), for invoicing.
-- New table + functions; nothing is deleted.
-- =============================================================================
create table public.track_staff (
  track_id   uuid not null references public.tracks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (track_id, user_id)
);
alter table public.track_staff enable row level security;
grant select on public.track_staff to authenticated;
create policy "staff see their own tracks" on public.track_staff for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Founder and admins can open every track's panel; staff only their track.
create or replace function public.is_track_staff(p_track uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (select 1 from public.track_staff where track_id = p_track and user_id = auth.uid());
$$;
revoke execute on function public.is_track_staff(uuid) from public, anon;
grant execute on function public.is_track_staff(uuid) to authenticated;

-- The founder gives someone from a track access (they need a KartUP account first):
--   select public.add_track_staff('receptie@vmax.ro', 'vmax-romexpo');
create or replace function public.add_track_staff(p_email text, p_track_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid;
  v_track uuid;
begin
  -- From the app only the founder; from the SQL editor (no signed-in user) also allowed.
  if auth.uid() is not null and not public.is_founder() then raise exception 'admin_only'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'No account with email %', p_email; end if;
  select id into v_track from public.tracks where slug = p_track_slug;
  if v_track is null then raise exception 'No track %', p_track_slug; end if;
  insert into public.track_staff (track_id, user_id) values (v_track, v_user) on conflict do nothing;
end;
$$;
revoke execute on function public.add_track_staff(text, text) from public, anon;
grant execute on function public.add_track_staff(text, text) to authenticated;

-- Tracks whose panel I can open.
create or replace function public.my_partner_tracks()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.tracks where is_active and public.is_track_staff(id);
$$;
revoke execute on function public.my_partner_tracks() from public, anon;
grant execute on function public.my_partner_tracks() to authenticated;

-- Desk: sessions at the track between two moments, with drivers and booking codes.
create or replace function public.track_desk(p_track uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_track_staff(p_track) then raise exception 'track_staff_only'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'sessionId', s.id, 'startsAt', s.starts_at, 'maxDrivers', s.max_drivers,
      'cancelled', s.cancelled_at is not null, 'lobbyType', s.lobby_type, 'official', s.is_official_event,
      'host', trim(coalesce(hp.first_name, '') || ' ' || coalesce(hp.last_name, '')),
      'trackPriceMinor', s.track_price_minor, 'currency', s.currency,
      'drivers', (select coalesce(jsonb_agg(jsonb_build_object(
          'userId', m.user_id, 'name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
          'code', m.booking_code, 'status', m.status, 'arrivedAt', m.checked_in_at) order by p.last_name, p.first_name), '[]')
        from public.session_members m left join public.profiles p on p.id = m.user_id
        where m.session_id = s.id and m.status in ('confirmed', 'attended', 'no_show'))) order by s.starts_at), '[]')
    from public.sessions s
    left join public.profiles hp on hp.id = s.host_id
    where s.track_id = p_track and s.starts_at >= p_from and s.starts_at < p_to);
end;
$$;
revoke execute on function public.track_desk(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.track_desk(uuid, timestamptz, timestamptz) to authenticated;

-- The desk marks a driver as arrived (or undoes it). From 2 h before to 6 h after the start.
create or replace function public.mark_arrived(p_session uuid, p_user uuid, p_arrived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.sessions;
begin
  select * into v_s from public.sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  if not public.is_track_staff(v_s.track_id) then raise exception 'track_staff_only'; end if;
  if v_s.cancelled_at is not null then raise exception 'session_cancelled'; end if;
  if now() < v_s.starts_at - interval '2 hours' or now() > v_s.starts_at + interval '6 hours' then raise exception 'not_today'; end if;
  update public.session_members set checked_in_at = case when p_arrived then now() end
  where session_id = p_session and user_id = p_user and status in ('confirmed', 'attended');
  if not found then raise exception 'not_found'; end if;
end;
$$;
revoke execute on function public.mark_arrived(uuid, uuid, boolean) from public, anon;
grant execute on function public.mark_arrived(uuid, uuid, boolean) to authenticated;

-- The value KartUP brought to the track in a month (YYYY-MM, track time zone).
create or replace function public.track_partner_stats(p_track uuid, p_month text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  if not public.is_track_staff(p_track) then raise exception 'track_staff_only'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'bad_month'; end if;
  select timezone into v_tz from public.tracks where id = p_track;
  return (
    with seats as (
      select m.user_id, m.checked_in_at, s.id as session_id, s.starts_at, s.track_price_minor, s.currency,
             (s.starts_at at time zone v_tz) as local_start
      from public.session_members m
      join public.sessions s on s.id = m.session_id
      where s.track_id = p_track and s.cancelled_at is null and m.status in ('confirmed', 'attended', 'no_show')
        and to_char(s.starts_at at time zone v_tz, 'YYYY-MM') = p_month
    ),
    held as (select * from seats where starts_at <= now()),
    -- First KartUP booking ever at this track.
    firsts as (
      select m.user_id, min(s.starts_at) as first_at
      from public.session_members m join public.sessions s on s.id = m.session_id
      where s.track_id = p_track and s.cancelled_at is null and m.status in ('confirmed', 'attended', 'no_show')
      group by m.user_id
    )
    select jsonb_build_object(
      'month', p_month,
      'currency', coalesce((select currency from seats limit 1), 'RON'),
      'drivers', (select count(*) from held),
      'sessions', (select count(distinct session_id) from held),
      'uniqueDrivers', (select count(distinct user_id) from held),
      'newCustomers', (select count(*) from firsts f where to_char(f.first_at at time zone v_tz, 'YYYY-MM') = p_month and f.first_at <= now()),
      'revenueMinor', (select coalesce(sum(track_price_minor), 0) from held),
      -- Off-peak: Monday–Friday before 17:00, local time.
      'offPeakDrivers', (select count(*) from held where extract(isodow from local_start) <= 5 and extract(hour from local_start) < 17),
      'arrived', (select count(*) from held where checked_in_at is not null),
      'upcomingDrivers', (select count(*) from seats where starts_at > now()),
      'upcomingSessions', (select count(distinct session_id) from seats where starts_at > now())
    )
  );
end;
$$;
revoke execute on function public.track_partner_stats(uuid, text) from public, anon;
grant execute on function public.track_partner_stats(uuid, text) to authenticated;

-- The month's list for one track (CSV in the app), for staff too.
create or replace function public.partner_report(p_track uuid, p_month text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_track_staff(p_track) then raise exception 'track_staff_only'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'bad_month'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'code', m.booking_code, 'driver', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
      'startsAt', s.starts_at, 'sessionId', s.id, 'status', m.status, 'arrivedAt', m.checked_in_at)
      order by s.starts_at, p.last_name), '[]')
    from public.session_members m
    join public.sessions s on s.id = m.session_id
    join public.tracks t on t.id = s.track_id
    left join public.profiles p on p.id = m.user_id
    where s.track_id = p_track and s.cancelled_at is null and s.starts_at <= now()
      and m.status in ('confirmed', 'attended', 'no_show')
      and to_char(s.starts_at at time zone t.timezone, 'YYYY-MM') = p_month);
end;
$$;
revoke execute on function public.partner_report(uuid, text) from public, anon;
grant execute on function public.partner_report(uuid, text) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261108000200', 'track_partners');

-- ═════ 20261109000100_notifications ═════
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

insert into supabase_migrations.schema_migrations (version, name) values ('20261109000100', 'notifications');

commit;
select 'Gata: 11 actualizări aplicate.' as rezultat;
