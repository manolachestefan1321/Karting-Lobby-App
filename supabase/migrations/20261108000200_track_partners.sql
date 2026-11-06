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
