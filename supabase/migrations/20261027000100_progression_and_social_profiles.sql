-- =============================================================================
-- Rank progression (8 ranks by km AND XP) + real profiles for new users.
--
-- What this changes in EXISTING data (approved before running):
--  * rank_tiers: rows 1–3 keep their keys and get new thresholds;
--      row 4 'pro'   → 'contender', row 5 'elite' → 'pro' (renamed, not deleted);
--      rows 6–8 (apex, ace, veteran) are added. The key 'elite' no longer exists.
--  * Nothing is deleted. user_stats.total_points stays (unused from now on).
-- New columns get safe defaults: every existing and new user starts at
-- Rookie, 0 km, 0 XP until verified results are recorded.
-- The source of truth for names/thresholds is config/progression.ts — keep in sync.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rank tiers: km + XP thresholds (both must be met), name shown in every language.
-- -----------------------------------------------------------------------------
alter table public.rank_tiers
  add column name   text,
  add column min_km int check (min_km >= 0),
  add column min_xp int check (min_xp >= 0);

-- One row at a time, in this order, so the unique keys never clash.
update public.rank_tiers set name = 'Rookie',     min_km = 0,   min_xp = 0,    min_points = 0,    color = '#8A8F98' where id = 1;
update public.rank_tiers set name = 'Amateur',    min_km = 25,  min_xp = 300,  min_points = 300,  color = '#3FA34D' where id = 2;
update public.rank_tiers set name = 'Club Racer', min_km = 75,  min_xp = 1000, min_points = 1000, color = '#2F7DE1' where id = 3;
update public.rank_tiers set key = 'contender', name = 'Contender', min_km = 150, min_xp = 2500, min_points = 2500, color = '#0E9AA7' where id = 4;
update public.rank_tiers set key = 'pro',       name = 'Pro',       min_km = 300, min_xp = 5000, min_points = 5000, color = '#9B51E0' where id = 5;
insert into public.rank_tiers (id, key, name, min_km, min_xp, min_points, color) values
  (6, 'apex',    'Apex',    500,  9000,  9000,  '#E8762C'),
  (7, 'ace',     'Ace',     800,  15000, 15000, '#C9A227'),
  (8, 'veteran', 'Veteran', 1200, 25000, 25000, '#E00000')
on conflict (id) do nothing;

alter table public.rank_tiers
  alter column name set not null,
  alter column min_km set not null,
  alter column min_xp set not null;

comment on column public.rank_tiers.min_points is 'Legacy (points system). Kept equal to min_xp; use min_km + min_xp.';

-- Highest rank whose km AND XP thresholds are both met.
create or replace function public.rank_tier_for_progress(p_km numeric, p_xp int)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.rank_tiers
  where min_km <= greatest(p_km, 0) and min_xp <= greatest(p_xp, 0)
  order by id desc limit 1;
$$;

-- -----------------------------------------------------------------------------
-- User stats: km / XP / tracks visited and the highest rank reached.
-- rank_tier_id is stored because ranks never go down.
-- -----------------------------------------------------------------------------
alter table public.user_stats
  add column total_xp       int    not null default 0 check (total_xp >= 0),
  add column total_meters   bigint not null default 0 check (total_meters >= 0),
  add column tracks_visited int    not null default 0 check (tracks_visited >= 0),
  add column rank_tier_id   smallint not null default 1 references public.rank_tiers(id);

comment on column public.user_stats.total_points is 'Legacy (points system), no longer used. See total_xp / total_meters.';

-- -----------------------------------------------------------------------------
-- Profile photo from Apple / Google / Facebook, shown until the user uploads one.
-- Written only by the sign-up trigger (users cannot set it).
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column provider_avatar_url text
    check (provider_avatar_url is null or (provider_avatar_url like 'https://%' and char_length(provider_avatar_url) <= 2048));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first text;
  v_last  text;
  v_locale text;
  v_photo text;
begin
  v_first := nullif(trim(coalesce(m->>'first_name', m->>'given_name', split_part(m->>'full_name', ' ', 1), '')), '');
  v_last  := nullif(trim(coalesce(m->>'last_name', m->>'family_name',
               nullif(substr(m->>'full_name', length(split_part(m->>'full_name', ' ', 1)) + 2), ''), '')), '');
  v_locale := case when m->>'locale' in ('en', 'ro') then m->>'locale' else 'en' end;
  -- Google and Facebook send the photo as avatar_url and/or picture; Apple sends none.
  v_photo := coalesce(m->>'avatar_url', m->>'picture');
  if v_photo is null or v_photo not like 'https://%' or char_length(v_photo) > 2048 then
    v_photo := null;
  end if;

  insert into public.profiles (id, first_name, last_name, locale, terms_accepted_at, provider_avatar_url)
  values (
    new.id,
    left(v_first, 50),
    left(v_last, 50),
    v_locale,
    case when (m->>'terms_accepted')::boolean is true then now() end,
    v_photo
  );
  -- Every new driver starts as Rookie with 0 km and 0 XP (column defaults).
  insert into public.user_stats (user_id) values (new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Public profile view: now with km / XP / rank and the provider photo.
-- Same columns as before (total_points kept for compatibility), new ones at the end.
-- -----------------------------------------------------------------------------
create or replace view public.public_profiles
with (security_barrier = true)
as
select
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_path,
  p.bio,
  p.home_city_id,
  extract(year from age((now() at time zone public.config_text('default_timezone', 'Europe/Bucharest'))::date,
                        p.date_of_birth))::int as age,
  s.total_points,
  s.sessions_raced,
  s.tracks_raced,
  s.wins,
  s.rank_tier_id,
  p.created_at,
  s.total_xp,
  s.total_meters,
  s.tracks_visited,
  p.provider_avatar_url
from public.profiles p
join public.user_stats s on s.user_id = p.id
where p.onboarded_at is not null;

grant select on public.public_profiles to authenticated;
revoke execute on function public.rank_tier_for_progress(numeric, int) from public, anon;
grant execute on function public.rank_tier_for_progress(numeric, int) to authenticated;
