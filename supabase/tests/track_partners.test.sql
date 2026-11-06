-- Track partner panel: staff see only their track; desk arrivals; monthly value.
begin;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'boss@test.ro',  '{"full_name":"Stefan Manolache"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'desk@vmax.ro',  '{"full_name":"Desk Romexpo"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'ana@test.ro',   '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000e4', 'ion@test.ro',   '{"full_name":"Ion Ene"}');
update public.profiles set date_of_birth = '1995-01-01', home_city_id = (select id from public.cities where slug = 'bucuresti'),
  terms_accepted_at = now(), onboarded_at = now();
select public.make_founder('boss@test.ro');
select public.add_track_staff('desk@vmax.ro', 'vmax-romexpo');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
insert into ids values ('s', public.create_session((select id from public.tracks where slug = 'vmax-romexpo'), now() + interval '1 day', 4, null, null, '', 'competitive'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
reset role;
update public.sessions set starts_at = now() - interval '30 minutes' where id = (select id from ids where name = 's');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select is((select count(*)::int from public.my_partner_tracks()), 1, 'desk staff see one track');
select is(jsonb_array_length(public.track_desk((select id from public.tracks where slug = 'vmax-romexpo'), now() - interval '1 day', now() + interval '1 day')->0->'drivers'), 2,
          'the desk sees both drivers');
select matches(public.track_desk((select id from public.tracks where slug = 'vmax-romexpo'), now() - interval '1 day', now() + interval '1 day')->0->'drivers'->0->>'code',
               '^KUP-', 'with their booking codes');
select throws_ok($$ select public.track_desk((select id from public.tracks where slug = 'vmax-titan'), now() - interval '1 day', now()) $$,
                 'P0001', 'track_staff_only', 'not another track');
select lives_ok($$ select public.mark_arrived((select id from ids where name = 's'), '00000000-0000-0000-0000-0000000000e4', true) $$, 'the desk marks Ion as arrived');
select is((public.track_partner_stats((select id from public.tracks where slug = 'vmax-romexpo'), to_char(now() at time zone 'Europe/Bucharest', 'YYYY-MM'))->>'drivers')::int, 2, 'stats: 2 drivers brought');
select is((public.track_partner_stats((select id from public.tracks where slug = 'vmax-romexpo'), to_char(now() at time zone 'Europe/Bucharest', 'YYYY-MM'))->>'revenueMinor')::int, 24000,
          'stats: 240 RON brought to the track');
select is((public.track_partner_stats((select id from public.tracks where slug = 'vmax-romexpo'), to_char(now() at time zone 'Europe/Bucharest', 'YYYY-MM'))->>'arrived')::int, 1, 'stats: 1 arrival');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select is((select count(*)::int from public.my_partner_tracks()), 0, 'drivers have no partner panel');
select throws_ok($$ select public.add_track_staff('ion@test.ro', 'vmax-titan') $$, 'P0001', 'admin_only', 'only the founder adds track staff');
reset role;

select * from finish();
rollback;
