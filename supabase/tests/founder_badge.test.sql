-- Founder Racer badge: set only from the SQL editor, shown on the public profile.
begin;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'Owner@Test.ro', '{"full_name":"Stefan Manolache"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'other@test.ro', '{"full_name":"Other Driver"}');
update public.profiles set date_of_birth = '1995-01-01', home_city_id = (select id from public.cities where slug = 'bucuresti'),
  terms_accepted_at = now()
where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');

select is((select badges from public.profiles where id = '00000000-0000-0000-0000-0000000000f2'), '{}'::text[], 'new users have no badges');

select is(public.make_founder('owner@test.ro'), '00000000-0000-0000-0000-0000000000f1'::uuid, 'founder found by email (any case)');
select is((select badges || role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'),
          array['founder', 'admin'], 'founder badge + admin role');
select is((select rank_tier_id from public.user_stats where user_id = '00000000-0000-0000-0000-0000000000f1'), 8::smallint, 'Veteran rank');
select is((select badges from public.public_profiles where id = '00000000-0000-0000-0000-0000000000f1'), array['founder'], 'badge shown on the public profile');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select throws_ok($$ update public.profiles set badges = '{founder}' where id = auth.uid() $$, '42501', null, 'users cannot give themselves a badge');
select throws_ok($$ select public.make_founder('other@test.ro') $$, '42501', null, 'the app cannot call make_founder');
reset role;

select * from finish();
rollback;
