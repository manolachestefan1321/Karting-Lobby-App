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
