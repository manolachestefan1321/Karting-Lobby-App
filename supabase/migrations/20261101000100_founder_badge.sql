-- =============================================================================
-- Profile badges (first one: "Founder Racer") + a way to make the owner a founder.
-- Nothing is deleted. Existing users get no badges (empty list).
-- =============================================================================

-- Badges shown on the profile. Only the database (SQL editor) sets them; users can't.
alter table public.profiles
  add column badges text[] not null default '{}'
    check (badges <@ array['founder']::text[]);

-- Public profile view: same columns as before, badges added at the end.
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
  p.provider_avatar_url,
  p.badges
from public.profiles p
join public.user_stats s on s.user_id = p.id
where p.onboarded_at is not null;

grant select on public.public_profiles to authenticated;

-- Run once from the Supabase SQL editor, after the owner signed up in the app:
--   select public.make_founder('your@email.com');
-- Gives the Founder Racer badge, the Veteran rank (ranks never go down) and the admin role
-- (owner tools). Not callable from the app.
create or replace function public.make_founder(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'No account with email %', p_email;
  end if;
  update public.profiles
     set badges = array(select distinct unnest(badges || array['founder'])),
         role = 'admin'
   where id = v_id;
  update public.user_stats
     set rank_tier_id = (select max(id) from public.rank_tiers)
   where user_id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.make_founder(text) from public, anon, authenticated;
