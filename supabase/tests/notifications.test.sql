-- In-app notifications: created by what happens in the app, private, switchable in Settings.
begin;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'host@test.ro', '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'ion@test.ro',  '{"full_name":"Ion Ene"}');
update public.profiles set first_name = split_part(email_tmp.full_name, ' ', 1), last_name = split_part(email_tmp.full_name, ' ', 2)
from (values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Ana Pop'), ('00000000-0000-0000-0000-0000000000c2'::uuid, 'Ion Ene')) as email_tmp(id, full_name)
where profiles.id = email_tmp.id;
update public.profiles set date_of_birth = '1995-01-01', home_city_id = (select id from public.cities where slug = 'bucuresti'),
  terms_accepted_at = now(), onboarded_at = now();
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
insert into ids values ('s', public.create_session((select id from public.tracks where slug = 'vmax-titan'), now() + interval '1 day', 4, null, null, '', 'competitive'));

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
select is((select count(*)::int from public.notifications), 0, 'a driver sees only their own notifications');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select data->>'name' from public.notifications where type = 'lobby_joined'), 'Ion E.', 'the host hears who reserved');
select is((select (data->>'free')::int from public.notifications where type = 'lobby_joined'), 1, 'pay-at-the-track sessions are marked free');
select public.send_message((select id from ids where name = 's'), 'Ne vedem la 18');
select is((select count(*)::int from public.notifications where type = 'chat_message'), 0, 'no notification for your own message');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select is((select data->>'preview' from public.notifications where type = 'chat_message'), 'Ne vedem la 18', 'the others get the chat message');
select public.set_notification_prefs(true, false, true, true, true);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select public.send_message((select id from ids where name = 's'), 'Al doilea mesaj');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select is((select count(*)::int from public.notifications where type = 'chat_message'), 1, 'switching chat off in Settings stops chat notifications');

select public.mark_notifications_read();
select is((select count(*)::int from public.notifications where read_at is null), 0, 'mark all as read');

select public.leave_session((select id from ids where name = 's'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select count(*)::int from public.notifications where type = 'lobby_left'), 1, 'the host hears when someone leaves');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select public.reserve_seat((select id from ids where name = 's'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select public.cancel_session((select id from ids where name = 's'), 'ploua');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select is((select count(*)::int from public.notifications where type = 'session_cancelled'), 1, 'drivers hear when the session is cancelled');
select is((select count(*)::int from public.notifications where type = 'removed_from_lobby'), 0, 'and are not told they were removed');

reset role;
update public.user_stats set rank_tier_id = rank_tier_id + 1 where user_id = '00000000-0000-0000-0000-0000000000c2';
select is((select (data->>'rankId')::int from public.notifications where type = 'rank_up' and user_id = '00000000-0000-0000-0000-0000000000c2'), 2, 'rank up');

select * from finish();
rollback;
