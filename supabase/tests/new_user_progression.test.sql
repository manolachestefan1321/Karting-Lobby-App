-- New users get a real profile (name, provider photo, Rookie / 0 km / 0 XP),
-- the 8 km + XP ranks are in place, and deleting the login removes the user's data.
begin;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'g@test.ro', '{"full_name":"Gabi Pop","avatar_url":"https://lh3.googleusercontent.com/a/photo.jpg","locale":"ro"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'f@test.ro', '{"name":"Fb User","picture":"http://insecure.example/p.jpg"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'a@test.ro', '{}');

-- Profile + stats for a new user --------------------------------------------
select is((select first_name || '|' || last_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
          'Gabi|Pop', 'name comes from the social provider');
select is((select provider_avatar_url from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
          'https://lh3.googleusercontent.com/a/photo.jpg', 'provider photo is kept');
select is((select provider_avatar_url from public.profiles where id = '00000000-0000-0000-0000-0000000000c2'),
          null, 'non-https photos are ignored');
select ok((select first_name is null from public.profiles where id = '00000000-0000-0000-0000-0000000000c3'),
          'Apple without a name: profile still created, name asked in onboarding');
select is((select total_xp || '|' || total_meters || '|' || tracks_visited || '|' || rank_tier_id
           from public.user_stats where user_id = '00000000-0000-0000-0000-0000000000c1'),
          '0|0|0|1', 'new driver starts as Rookie with 0 km and 0 XP');

-- Ranks ----------------------------------------------------------------------
select is((select string_agg(key, ',' order by id) from public.rank_tiers),
          'rookie,amateur,clubRacer,contender,pro,apex,ace,veteran', '8 ranks in order (no elite)');
select is((select string_agg(name, ',' order by id) from public.rank_tiers),
          'Rookie,Amateur,Club Racer,Contender,Pro,Apex,Ace,Veteran', 'rank names match config/progression.ts');
select is(public.rank_tier_for_progress(25, 300), 2::smallint, 'Amateur at 25 km AND 300 XP');
select is(public.rank_tier_for_progress(5000, 299), 1::smallint, 'lots of km but not enough XP stays Rookie');
select is(public.rank_tier_for_progress(1200, 25000), 8::smallint, 'Veteran at the top');

-- Users cannot set their own photo URL, stats or rank ------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select throws_ok($$ update public.profiles set provider_avatar_url = 'https://evil.example/x.jpg' where id = auth.uid() $$,
                 '42501', null, 'users cannot change the provider photo');
select throws_ok($$ update public.user_stats set total_xp = 99999 where user_id = auth.uid() $$,
                 '42501', null, 'users cannot change their XP');
reset role;

-- Public profile exposes km / XP / rank once onboarded ------------------------
update public.profiles set date_of_birth = '1995-01-01', home_city_id = (select id from public.cities where slug = 'bucuresti'),
  terms_accepted_at = now()
where id = '00000000-0000-0000-0000-0000000000c1';
select is((select total_xp || '|' || total_meters || '|' || rank_tier_id || '|' || provider_avatar_url
           from public.public_profiles where id = '00000000-0000-0000-0000-0000000000c1'),
          '0|0|1|https://lh3.googleusercontent.com/a/photo.jpg', 'public profile shows rank, km, XP and photo');

-- Delete account: removing the login removes profile, stats and experience ----
insert into public.track_experience (user_id, track_id, level, sessions_count)
select '00000000-0000-0000-0000-0000000000c1', id, 'beginner', 1 from public.tracks limit 1;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000c1';
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000c1')
        + (select count(*)::int from public.user_stats where user_id = '00000000-0000-0000-0000-0000000000c1')
        + (select count(*)::int from public.track_experience where user_id = '00000000-0000-0000-0000-0000000000c1'),
          0, 'deleting the account removes profile, stats and experience');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000c2'), 1,
          'other users are untouched');

select * from finish();
rollback;
