-- Booking codes (who sees them) and the monthly report per track (founder only).
begin;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'boss@test.ro', '{"full_name":"Stefan Manolache"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'ana@test.ro',  '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'ion@test.ro',  '{"full_name":"Ion Ene"}');
update public.profiles set date_of_birth = '1995-01-01', home_city_id = (select id from public.cities where slug = 'bucuresti'),
  terms_accepted_at = now(), onboarded_at = now();
select public.make_founder('boss@test.ro');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
insert into ids values ('s', public.create_session((select id from public.tracks where slug = 'vmax-titan'), now() + interval '1 day', 4, null, null, '', 'competitive'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
select matches((select my_booking_code from public.session_cards where id = (select id from ids where name = 's')), '^KUP-[A-Z2-9]{4}$', 'a reserved seat gets a code like KUP-4821');
select is((select count(booking_code)::int from public.lobby_members where session_id = (select id from ids where name = 's')), 1, 'a driver sees only their own code');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select is((select count(booking_code)::int from public.lobby_members where session_id = (select id from ids where name = 's')), 2, 'the host sees every code (for the desk)');
select throws_ok($$ select public.track_report(to_char(now(), 'YYYY-MM')) $$, 'P0001', 'admin_only', 'only the founder gets the report');
reset role;
select is((select count(distinct booking_code)::int from public.session_members), 2, 'codes are unique');

-- The session took place: it counts in this month's report.
update public.sessions set starts_at = now() - interval '2 hours' where id = (select id from ids where name = 's');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is((public.track_report(to_char((now() - interval '2 hours') at time zone 'Europe/Bucharest', 'YYYY-MM'))->0->>'trackName'), 'VMax Titan', 'report per track');
select is((public.track_report(to_char((now() - interval '2 hours') at time zone 'Europe/Bucharest', 'YYYY-MM'))->0->>'drivers')::int, 2, '2 drivers brought by KartUP');
reset role;
update public.sessions set cancelled_at = now() where id = (select id from ids where name = 's');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is(jsonb_array_length(public.track_report(to_char((now() - interval '2 hours') at time zone 'Europe/Bucharest', 'YYYY-MM'))), 0, 'cancelled sessions are not invoiced');
reset role;

select * from finish();
rollback;
