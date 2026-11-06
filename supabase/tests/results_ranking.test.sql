-- Results → verified XP / km / rank, disputes, casual lobbies, leaderboards.
begin;
select plan(24);

-- XP rules: same numbers as config/progression.ts and packages/domain tests.
select is((public.session_xp(1, 5, true, false, true, false)->>'total')::int, 275, 'P1 of 5, fastest lap, new track = 275 XP');
select is((public.session_xp(5, 5, false, false, false, false)->>'total')::int, 25, 'last of 5 = participation only');
select is((public.session_xp(2, 3, false, false, false, false)->>'total')::int, 100, 'P2 of 3: 25 + 75, no podium under 4 drivers');
select is((public.session_xp(1, 4, false, true, false, true)->>'total')::int, 360, 'official event ×1.5: (25+150+50+15) × 1.5 = 360');
select is((public.session_xp(1, 1, false, false, false, false)->>'total')::int, 25, 'racing alone: participation only');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'host@test.ro', '{"full_name":"Host Driver"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'ana@test.ro',  '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'radu@test.ro', '{"full_name":"Radu Stan"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'ion@test.ro',  '{"full_name":"Ion Ene"}'),
  ('00000000-0000-0000-0000-0000000000d5', 'admin@test.ro', '{"full_name":"Ad Min"}');
update public.profiles set date_of_birth = '1995-01-01', home_city_id = (select id from public.cities where slug = 'bucuresti'),
  terms_accepted_at = now(), onboarded_at = now();
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000d5';
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- A Competitive session at VMax Romexpo (700 m lap) with 4 drivers, then moved into the past.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
insert into ids values ('s', public.create_session((select id from public.tracks where slug = 'vmax-romexpo'), now() + interval '1 day', 6, null, null, '', 'competitive'));
select throws_ok($$ select public.submit_results((select id from ids where name = 's'), '[]', null) $$, 'P0001', 'results_too_early', 'no results before the start');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
reset role;
update public.sessions set starts_at = now() - interval '1 hour' where id = (select id from ids where name = 's');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select throws_ok($$ select public.submit_results((select id from ids where name = 's'), '[]', null) $$, 'P0001', 'not_host', 'only the host enters results');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select throws_ok($$ select public.submit_results((select id from ids where name = 's'),
  '[{"user_id":"00000000-0000-0000-0000-0000000000d1","position":1,"laps":14},{"user_id":"00000000-0000-0000-0000-0000000000d2","position":3,"laps":14}]', null) $$,
  'P0001', 'results_bad_positions', 'positions must be 1..N');
select throws_ok($$ select public.submit_results((select id from ids where name = 's'),
  '[{"user_id":"00000000-0000-0000-0000-0000000000d5","position":1,"laps":14}]', null) $$,
  'P0001', 'results_unknown_driver', 'only drivers in the lobby');
select lives_ok($$ select public.submit_results((select id from ids where name = 's'), '[
  {"user_id":"00000000-0000-0000-0000-0000000000d1","position":1,"laps":14,"best_lap_ms":48500},
  {"user_id":"00000000-0000-0000-0000-0000000000d2","position":2,"laps":14,"best_lap_ms":49100},
  {"user_id":"00000000-0000-0000-0000-0000000000d3","position":3,"laps":13,"best_lap_ms":50200},
  {"user_id":"00000000-0000-0000-0000-0000000000d4","position":4,"laps":13}]', 'x/sheet.jpg') $$, 'the host enters 4 drivers');
select is(public.results_state((select id from ids where name = 's')), 'pending', 'results wait for confirmations');
select is((select total_xp from public.user_stats where user_id = '00000000-0000-0000-0000-0000000000d1'), 0, 'no XP while pending');

-- Ana and Radu confirm, Ion confirms last → final → verified.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select public.respond_results((select id from ids where name = 's'), 'confirm', null);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}';
select public.respond_results((select id from ids where name = 's'), 'confirm', null);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
select public.respond_results((select id from ids where name = 's'), 'confirm', null);
select is(public.results_state((select id from ids where name = 's')), 'final', 'everyone confirmed → final');
reset role;
-- Winner: 25 + 150 + 50 podium + 20 fastest lap + 30 new track = 275 XP; 14 laps × 700 m = 9.8 km.
select is((select total_xp || '|' || total_meters || '|' || wins || '|' || tracks_visited || '|' || sessions_raced from public.user_stats
           where user_id = '00000000-0000-0000-0000-0000000000d1'), '275|9800|1|1|1', 'winner: XP, km, win, new track');
select is((select total_xp from public.user_stats where user_id = '00000000-0000-0000-0000-0000000000d4'), 55, 'last of 4: 25 + 30 new track = 55 XP');
select is((select string_agg(status, ',' order by user_id) from public.session_members where session_id = (select id from ids where name = 's')),
          'attended,attended,attended,attended', 'classified drivers are marked as attended');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select is((select string_agg(first_name || ':' || xp, ',' order by xp desc) from public.leaderboard('track', null, (select id from public.tracks where slug = 'vmax-romexpo'), null)),
          'Host:275,Ana:185,Radu:120,Ion:55', 'track leaderboard');
select is((select (public.get_session_results((select id from ids where name = 's'))->'entries'->0->>'xp')::int), 275, 'results screen shows the XP');

-- A Casual session: history only. Then a dispute that an admin approves.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
insert into ids values ('c', public.create_session((select id from public.tracks where slug = 'vmax-titan'), now() + interval '1 day', 4, null, null, '', 'casual'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 'c'));
reset role;
update public.sessions set starts_at = now() - interval '2 hours' where id = (select id from ids where name = 'c');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select public.submit_results((select id from ids where name = 'c'), '[
  {"user_id":"00000000-0000-0000-0000-0000000000d2","position":1,"laps":12},
  {"user_id":"00000000-0000-0000-0000-0000000000d1","position":2,"laps":12}]', null);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select public.respond_results((select id from ids where name = 'c'), 'dispute', 'I lapped him twice');
select is(public.results_state((select id from ids where name = 'c')), 'disputed', 'a dispute goes to an admin');
select throws_ok($$ select public.admin_decide_results((select id from ids where name = 'c'), true) $$, 'P0001', 'admin_only', 'drivers cannot decide');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}';
select is((public.admin_disputed_results()->0->'disputes'->0->>'comment'), 'I lapped him twice', 'the admin sees the dispute and why');
select throws_ok($$ select public.set_official_event((select id from ids where name = 's'), true) $$, 'P0001', 'results_exist', 'no official switch after results');
select public.admin_decide_results((select id from ids where name = 'c'), true);
reset role;
select is((select string_agg(casual || ':' || xp || ':' || meters, ',') from public.race_ledger where session_id = (select id from ids where name = 'c')),
          'true:0:0,true:0:0', 'approved Casual results: history only, no XP or km');
select is((select total_xp from public.user_stats where user_id = '00000000-0000-0000-0000-0000000000d2'), 185, 'Casual race changed nothing for Ana');

select * from finish();
rollback;
