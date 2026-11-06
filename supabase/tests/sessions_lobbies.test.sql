-- Sessions and lobbies, "pay at the track" mode: create, reserve, leave, remove, cancel.
begin;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'host@test.ro', '{"full_name":"Host Driver"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'ana@test.ro',  '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'radu@test.ro', '{"full_name":"Radu Stan"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'ion@test.ro',  '{"full_name":"Ion Ene"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'mia@test.ro',  '{"full_name":"Mia Dan"}');
update public.profiles set date_of_birth = '1995-01-01', home_city_id = (select id from public.cities where slug = 'bucuresti'),
  terms_accepted_at = now(), onboarded_at = now();

select is((select price_per_driver_minor from public.track_details where slug = 'vmax-romexpo'), 12000, 'track details: VMax Romexpo price');
select ok((select lat between 44 and 45 and lng between 25 and 27 from public.track_details where slug = 'vmax-romexpo'), 'track details: coordinates as numbers');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok($$ select public.create_session((select id from public.tracks where slug = 'vmax-romexpo'), now() + interval '1 hour', 4, null, null, '', 'competitive') $$,
                 'P0001', 'start_too_soon', 'sessions must start at least 4 hours ahead');
select throws_ok($$ select public.create_session((select id from public.tracks where slug = 'vmax-romexpo'), now() + interval '1 day', 40, null, null, '', 'competitive') $$,
                 'P0001', 'invalid_max_drivers', 'no more drivers than the track allows');
insert into ids values ('s', public.create_session((select id from public.tracks where slug = 'vmax-romexpo'), now() + interval '1 day', 4, null, null, 'Rolling start', 'competitive'));
select is((select fee_minor || '|' || track_price_minor from public.sessions where id = (select id from ids where name = 's')), '0|12000',
          'pay at the track: no KartUP fee, track price kept');
select is((select status from public.session_members where session_id = (select id from ids where name = 's') and user_id = auth.uid()), 'confirmed',
          'the host has a seat');
select is((select paid_count || '|' || my_status from public.session_cards where id = (select id from ids where name = 's')), '1|confirmed', 'card: 1 seat taken, mine');
select throws_ok($$ select public.leave_session((select id from ids where name = 's')) $$, 'P0001', 'host_cannot_leave', 'the host cancels instead of leaving');

-- Three more drivers fill the 4 seats; a fifth is refused.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok($$ select public.reserve_seat((select id from ids where name = 's')) $$, 'Ana reserves a seat');
select lives_ok($$ select public.reserve_seat((select id from ids where name = 's')) $$, 'reserving twice is harmless');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
select throws_ok($$ select public.reserve_seat((select id from ids where name = 's')) $$, 'P0001', 'session_full', 'no seat when the lobby is full');
select is((select count(*)::int from public.lobby_members where session_id = (select id from ids where name = 's') and status = 'confirmed'), 4, 'lobby shows 4 drivers');

-- Ana leaves; Mia takes the seat; the host removes Radu.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok($$ select public.leave_session((select id from ids where name = 's')) $$, 'Ana gives up her seat');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
select lives_ok($$ select public.reserve_seat((select id from ids where name = 's')) $$, 'the freed seat can be taken');
select throws_ok($$ select public.remove_member((select id from ids where name = 's'), '00000000-0000-0000-0000-0000000000a3') $$, 'P0001', 'not_host', 'only the host removes drivers');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok($$ select public.remove_member((select id from ids where name = 's'), '00000000-0000-0000-0000-0000000000a3') $$, 'the host removes Radu');

-- Nobody writes tables directly; only the host cancels.
select throws_ok($$ update public.sessions set max_drivers = 10 $$, '42501', null, 'no direct edits to sessions');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select throws_ok($$ select public.cancel_session((select id from ids where name = 's'), 'x') $$, 'P0001', 'not_host', 'a driver cannot cancel the session');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select public.cancel_session((select id from ids where name = 's'), 'rain');
select is((select string_agg(status, ',' order by status) from public.session_members where session_id = (select id from ids where name = 's')),
          'cancelled,cancelled,cancelled,cancelled,removed', 'cancelling frees every seat');
reset role;

select * from finish();
rollback;
