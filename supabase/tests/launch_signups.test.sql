-- Join the race: anyone can sign up once per email; only admins see the list.
begin;
select plan(6);

set local role anon;
select lives_ok($$ insert into public.launch_signups (first_name, last_name, phone, email) values ('Ana', 'Pop', '0722 123 456', 'ana@test.ro') $$,
                'a visitor without an account can sign up');
select throws_ok($$ insert into public.launch_signups (first_name, last_name, phone, email) values ('Ana', 'Pop', '0722 123 456', 'ANA@test.ro') $$,
                 '23505', null, 'the same email (any case) only once');
select throws_ok($$ insert into public.launch_signups (first_name, last_name, phone, email) values ('X', 'Y', 'abc', 'x@test.ro') $$,
                 '23514', null, 'invalid phone rejected');
select throws_ok($$ select count(*) from public.launch_signups $$, '42501', null, 'visitors cannot read the list');
reset role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'user@test.ro', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'admin@test.ro', '{}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000d2';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from public.launch_signups), 0, 'normal users see no sign-ups');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select is((select count(*)::int from public.launch_signups), 1, 'admins see the sign-ups');
reset role;

select * from finish();
rollback;
