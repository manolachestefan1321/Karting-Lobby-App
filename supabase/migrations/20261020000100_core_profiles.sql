-- =============================================================================
-- Step 1: core helpers, configuration, places (countries/cities/tracks base),
-- profiles, karting experience, stats placeholder and avatar storage.
--
-- Security model:
--   * RLS is enabled on EVERY table.
--   * Clients get the narrowest column-level grants possible.
--   * Anything sensitive is changed only by SECURITY DEFINER functions / Edge Functions.
-- =============================================================================

create extension if not exists postgis with schema extensions;

-- Supabase grants ALL on new tables/functions to anon + authenticated by default.
-- We flip that: nothing is exposed unless a migration grants it explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- App configuration (key/value). Editable by admins from the admin panel.
-- -----------------------------------------------------------------------------
create table public.app_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);
alter table public.app_config enable row level security;
create trigger app_config_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();

insert into public.app_config (key, value, description) values
  ('min_age',          '16',                    'Minimum age (years) to create a profile.'),
  ('default_timezone', '"Europe/Bucharest"',    'Time zone used for date-only rules such as age.'),
  ('default_currency', '"RON"',                 'Currency for new tracks and sessions.');

-- Typed reader used by other SQL functions.
create or replace function public.config_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::int from public.app_config where key = p_key), p_default);
$$;

create or replace function public.config_text(p_key text, p_default text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value #>> '{}' from public.app_config where key = p_key), p_default);
$$;

-- -----------------------------------------------------------------------------
-- Places
-- -----------------------------------------------------------------------------
create table public.countries (
  code      char(2) primary key,
  name_en   text not null,
  name_ro   text not null,
  currency  char(3) not null default 'RON'
);
alter table public.countries enable row level security;

create table public.cities (
  id            uuid primary key default gen_random_uuid(),
  country_code  char(2) not null references public.countries(code),
  name          text not null,
  slug          text not null unique,
  location      extensions.geography(Point, 4326) not null,
  timezone      text not null default 'Europe/Bucharest',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.cities enable row level security;
create index cities_country_idx on public.cities (country_code);

-- Track details (photos, prices, opening hours …) are added in the step-2 migration.
create table public.tracks (
  id                  uuid primary key default gen_random_uuid(),
  city_id             uuid not null references public.cities(id),
  name                text not null,
  slug                text not null unique,
  address             text not null,
  location            extensions.geography(Point, 4326) not null,
  timezone            text not null default 'Europe/Bucharest',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.tracks enable row level security;
create index tracks_city_idx on public.tracks (city_id);
create trigger tracks_updated_at before update on public.tracks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin');
create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');

create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  first_name         text check (char_length(first_name) between 1 and 50),
  last_name          text check (char_length(last_name) between 1 and 50),
  date_of_birth      date,
  home_city_id       uuid references public.cities(id),
  bio                text not null default '' check (char_length(bio) <= 280),
  avatar_path        text,
  locale             text not null default 'en' check (locale in ('en', 'ro')),
  role               public.user_role not null default 'user',
  terms_accepted_at  timestamptz,
  onboarded_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.profiles enable row level security;
create index profiles_home_city_idx on public.profiles (home_city_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Server-side age check (the app checks too, but the database is the authority).
create or replace function public.profiles_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tz      text := public.config_text('default_timezone', 'Europe/Bucharest');
  v_min_age int  := public.config_int('min_age', 16);
  v_today   date := (now() at time zone v_tz)::date;
begin
  if new.date_of_birth is not null then
    if new.date_of_birth < date '1900-01-01' or new.date_of_birth > v_today then
      raise exception 'invalid_date_of_birth' using errcode = '22023';
    end if;
    if extract(year from age(v_today, new.date_of_birth)) < v_min_age then
      raise exception 'under_min_age' using errcode = '22023',
        detail = format('Minimum age is %s', v_min_age);
    end if;
  end if;

  -- A profile is "onboarded" once the required fields are present.
  if new.onboarded_at is null
     and new.first_name is not null and new.last_name is not null
     and new.date_of_birth is not null and new.home_city_id is not null then
    new.onboarded_at := now();
  end if;
  return new;
end;
$$;
create trigger profiles_validate before insert or update on public.profiles
  for each row execute function public.profiles_validate();

-- -----------------------------------------------------------------------------
-- Karting experience per track
-- -----------------------------------------------------------------------------
create table public.track_experience (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  track_id        uuid not null references public.tracks(id) on delete cascade,
  level           public.experience_level not null,
  best_lap_ms     int check (best_lap_ms between 5000 and 600000),
  sessions_count  int not null default 0 check (sessions_count between 0 and 10000),
  updated_at      timestamptz not null default now(),
  primary key (user_id, track_id)
);
alter table public.track_experience enable row level security;
create trigger track_experience_updated_at before update on public.track_experience
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Rank tiers (config) and per-user stats (maintained by the server).
-- Points logic arrives in step 6; the table exists now so profiles can show it.
-- -----------------------------------------------------------------------------
create table public.rank_tiers (
  id          smallint primary key,
  key         text not null unique,          -- i18n key suffix: ranks.<key>
  min_points  int not null unique check (min_points >= 0),
  color       text not null
);
alter table public.rank_tiers enable row level security;

insert into public.rank_tiers (id, key, min_points, color) values
  (1, 'rookie',    0,    '#8A8F98'),
  (2, 'amateur',   250,  '#3FA34D'),
  (3, 'clubRacer', 1000, '#2F7DE1'),
  (4, 'pro',       3000, '#9B51E0'),
  (5, 'elite',     7500, '#E10600');

create table public.user_stats (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  total_points     int not null default 0,
  sessions_raced   int not null default 0,
  tracks_raced     int not null default 0,
  wins             int not null default 0,
  no_show_count    int not null default 0,
  updated_at       timestamptz not null default now()
);
alter table public.user_stats enable row level security;

create or replace function public.rank_tier_for(p_points int)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.rank_tiers where min_points <= greatest(p_points, 0)
  order by min_points desc limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Create profile + stats automatically when an auth user is created.
-- Social providers put names in different metadata keys; we take what we can.
-- -----------------------------------------------------------------------------
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
begin
  v_first := nullif(trim(coalesce(m->>'first_name', m->>'given_name', split_part(m->>'full_name', ' ', 1), '')), '');
  v_last  := nullif(trim(coalesce(m->>'last_name', m->>'family_name',
               nullif(substr(m->>'full_name', length(split_part(m->>'full_name', ' ', 1)) + 2), ''), '')), '');
  v_locale := case when m->>'locale' in ('en', 'ro') then m->>'locale' else 'en' end;

  insert into public.profiles (id, first_name, last_name, locale, terms_accepted_at)
  values (
    new.id,
    left(v_first, 50),
    left(v_last, 50),
    v_locale,
    case when (m->>'terms_accepted')::boolean is true then now() end
  );
  insert into public.user_stats (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Public profile view: everything another user may see. Hides date of birth
-- (shows age instead) and private fields. Runs with the view owner's rights
-- (bypasses profiles RLS on purpose) and exposes only safe columns.
-- Extended in later steps with ban status.
-- -----------------------------------------------------------------------------
create view public.public_profiles
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
  public.rank_tier_for(s.total_points) as rank_tier_id,
  p.created_at
from public.profiles p
join public.user_stats s on s.user_id = p.id
where p.onboarded_at is not null;

-- -----------------------------------------------------------------------------
-- Grants (column-level) and RLS policies
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Reference data: readable by signed-in users and anon (so the sign-up screen can list cities).
grant select on public.countries, public.cities, public.tracks, public.rank_tiers to anon, authenticated;
create policy "countries readable" on public.countries for select using (true);
create policy "cities readable"    on public.cities    for select using (is_active or public.is_admin());
create policy "tracks readable"    on public.tracks    for select using (is_active or public.is_admin());
create policy "rank tiers readable" on public.rank_tiers for select using (true);

-- Admin writes on reference data
grant insert, update, delete on public.countries, public.cities, public.tracks, public.rank_tiers to authenticated;
create policy "countries admin write" on public.countries for all using (public.is_admin()) with check (public.is_admin());
create policy "cities admin write"    on public.cities    for all using (public.is_admin()) with check (public.is_admin());
create policy "tracks admin write"    on public.tracks    for all using (public.is_admin()) with check (public.is_admin());
create policy "rank tiers admin write" on public.rank_tiers for all using (public.is_admin()) with check (public.is_admin());

-- App config: readable by everyone (no secrets here), writable by admins.
grant select on public.app_config to anon, authenticated;
grant insert, update, delete on public.app_config to authenticated;
create policy "config readable"    on public.app_config for select using (true);
create policy "config admin write" on public.app_config for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: you can read and edit only your own row (admins: all).
-- Other users are seen through public_profiles. Columns like role cannot be changed by users.
grant select on public.profiles to authenticated;
grant update (first_name, last_name, date_of_birth, home_city_id, bio, avatar_path, locale, terms_accepted_at)
  on public.profiles to authenticated;
create policy "profiles self read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

grant select on public.public_profiles to authenticated;

-- Experience: everyone signed in can read; you manage only your own.
grant select, insert, update, delete on public.track_experience to authenticated;
create policy "experience readable" on public.track_experience for select using (auth.uid() is not null);
create policy "experience own insert" on public.track_experience for insert with check (user_id = auth.uid());
create policy "experience own update" on public.track_experience for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "experience own delete" on public.track_experience for delete using (user_id = auth.uid());

-- Stats: read-only for clients.
grant select on public.user_stats to authenticated;
create policy "stats readable" on public.user_stats for select using (auth.uid() is not null);

-- Functions: lock down, then expose what the app needs.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profiles_validate() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage: avatars bucket. Public read (avatars are shown everywhere); a user may
-- write only inside the folder named after their user id: avatars/<uid>/<file>.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
