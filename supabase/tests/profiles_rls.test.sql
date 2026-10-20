-- RLS & rules for profiles, experience, stats and avatar storage.
begin;
select plan(20);

-- Fixtures (as superuser) --------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@test.ro',  '{"given_name":"Ana","family_name":"Pop","terms_accepted":true,"locale":"ro"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bogdan@test.ro','{"full_name":"Bogdan Ionescu Mare"}');

select is((select first_name || '|' || last_name || '|' || locale from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
          'Ana|Pop|ro', 'signup trigger copies names and locale from provider metadata');
select is((select first_name || '|' || last_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
          'Bogdan|Ionescu Mare', 'signup trigger splits full_name');
select ok((select terms_accepted_at is not null from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
          'terms acceptance recorded at signup');
select is((select count(*)::int from public.user_stats where user_id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b')),
          2, 'signup trigger creates stats rows');

insert into public.tracks (id, city_id, name, slug, address, location)
select '00000000-0000-0000-0000-0000000000f1', id, 'Test Track', 'test-track', 'Str. Test 1', 'SRID=4326;POINT(26.1 44.4)'
from public.cities where slug = 'bucuresti';

update public.profiles set first_name = 'Bogdan', last_name = 'Ionescu', date_of_birth = '1995-04-02',
  home_city_id = (select id from public.cities where slug = 'bucuresti')
where id = '00000000-0000-0000-0000-00000000000b';

select ok((select onboarded_at is not null from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
          'profile becomes onboarded when required fields are filled');

-- As Ana --------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'a user sees only their own private profile row');
select is((select count(*)::int from public.public_profiles where id = '00000000-0000-0000-0000-00000000000b'), 1,
          'other onboarded users are visible through public_profiles');
select is((select age from public.public_profiles where id = '00000000-0000-0000-0000-00000000000b') > 18, true,
          'public_profiles exposes age');
select throws_ok($$ select date_of_birth from public.public_profiles $$, '42703', null,
          'public_profiles does not expose date of birth');

select lives_ok($$ update public.profiles set bio = 'Fast on Sundays' where id = '00000000-0000-0000-0000-00000000000a' $$,
          'user can update own bio');
update public.profiles set bio = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';
select throws_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a' $$,
          '42501', null, 'user cannot make themselves admin');
select throws_ok($$ update public.profiles set date_of_birth = (current_date - interval '10 years')::date where id = '00000000-0000-0000-0000-00000000000a' $$,
          '22023', 'under_min_age', 'server rejects users under the minimum age');

select lives_ok($$ insert into public.track_experience (user_id, track_id, level, best_lap_ms, sessions_count)
                   values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'beginner', 45000, 3) $$,
          'user can add own track experience');
select throws_ok($$ insert into public.track_experience (user_id, track_id, level)
                    values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f1', 'advanced') $$,
          '42501', null, 'user cannot add experience for someone else');
select throws_ok($$ update public.user_stats set total_points = 99999 $$, '42501', null, 'stats are read-only for users');
select throws_ok($$ insert into public.tracks (city_id, name, slug, address, location)
                    select id, 'X', 'x', 'x', 'SRID=4326;POINT(0 0)' from public.cities limit 1 $$,
          '42501', null, 'non-admins cannot create tracks');

select lives_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000a/avatar.jpg') $$,
          'user can upload into own avatar folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000b/avatar.jpg') $$,
          '42501', null, 'user cannot upload into someone else''s avatar folder');

-- As anonymous ----------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anonymous users cannot read profiles');

-- Verify as superuser ---------------------------------------------------------
reset role;
select is((select bio from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), '',
          'user could not edit someone else''s profile');

select * from finish();
rollback;
