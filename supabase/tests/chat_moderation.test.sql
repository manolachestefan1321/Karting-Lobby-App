-- Lobby chat and moderation: members only, joined lines, blocking, reports.
begin;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'host@test.ro', '{"full_name":"Host Driver"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'ana@test.ro',  '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'out@test.ro',  '{"full_name":"Out Sider"}');
update public.profiles set date_of_birth = '1995-01-01', home_city_id = (select id from public.cities where slug = 'bucuresti'),
  terms_accepted_at = now(), onboarded_at = now();
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
insert into ids values ('s', public.create_session((select id from public.tracks where slug = 'vmax-titan'), now() + interval '1 day', 6, null, null, '', 'casual'));
select lives_ok($$ select public.send_message((select id from ids where name = 's'), 'Salut, ne vedem la 7!') $$, 'the host writes in the chat');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select throws_ok($$ select public.send_message((select id from ids where name = 's'), 'spam') $$, 'P0001', 'not_in_lobby', 'outsiders cannot write');
select is((select count(*)::int from public.chat_messages where session_id = (select id from ids where name = 's')), 0, 'outsiders cannot read the chat');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
select is((select body from public.chat_messages where session_id = (select id from ids where name = 's') and system), 'joined', 'joining adds a "joined" line');
select is((select first_name || ': ' || body from public.chat_messages where session_id = (select id from ids where name = 's') and not system), 'Host: Salut, ne vedem la 7!',
          'members read messages with the author name');
select lives_ok($$ select public.send_message((select id from ids where name = 's'), 'Vin și eu') $$, 'a member writes');

-- Ana blocks the host: his messages disappear for her only.
insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.chat_messages where session_id = (select id from ids where name = 's') and user_id = '00000000-0000-0000-0000-0000000000b1'), 0,
          'blocked people''s messages are hidden');
select lives_ok($$ select public.report_content('message', null, (select id from public.messages where body = 'Vin și eu'), 'spam') $$, 'a member reports a message');
select is((select count(*)::int from public.reports), 0, 'members see no reports (only admins do)');
reset role;
select is((select target_user_id::text || '|' || message_body from public.reports), '00000000-0000-0000-0000-0000000000b2|Vin și eu', 'the report keeps the author and a copy');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select public.leave_session((select id from ids where name = 's'));
reset role;
select is((select count(*)::int from public.messages where session_id = (select id from ids where name = 's') and body = 'left' and system), 1, 'leaving adds a "left" line');

select * from finish();
rollback;
