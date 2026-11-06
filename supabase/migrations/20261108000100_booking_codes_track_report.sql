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
