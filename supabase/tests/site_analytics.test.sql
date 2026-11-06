-- Site analytics: visitors can only send events; only the founder gets the report.
begin;
select plan(8);

set local role anon;
select lives_ok($$ insert into public.site_events (visitor_id, session_id, kind, path, device, utm_source)
                   values ('00000000-0000-0000-0000-00000000aaa1', '00000000-0000-0000-0000-00000000bbb1', 'pageview', '/join', 'mobile', 'instagram') $$,
                'a visitor can send a page view');
select throws_ok($$ select count(*) from public.site_events $$, '42501', null, 'visitors cannot read events');
reset role;
insert into public.site_events (visitor_id, session_id, kind, path, device) values
  ('00000000-0000-0000-0000-00000000aaa1', '00000000-0000-0000-0000-00000000bbb1', 'pageview', '/welcome', 'mobile'),
  ('00000000-0000-0000-0000-00000000aaa2', '00000000-0000-0000-0000-00000000bbb2', 'pageview', '/join', 'desktop');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'boss@test.ro', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'staff@test.ro', '{}');
select public.make_founder('boss@test.ro');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000e2';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select throws_ok($$ select public.analytics_report(3600, 12) $$, '42501', null, 'an admin who is not the founder gets nothing');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select is((public.analytics_report(3600, 12)->>'visitors')::int, 2, 'founder: 2 visitors');
select is((public.analytics_report(3600, 12)->>'pageviews')::int, 3, 'founder: 3 page views');
select is(jsonb_array_length(public.analytics_report(3600, 12)->'series'), 12, '12 time buckets');
select is((public.analytics_report(3600, 12)->>'bounceRate')::int, 50, 'one of two sessions bounced');
select is((public.analytics_report(3600, 12)->'karting'->>'active')::int, 0, 'karting sessions come from the database');
reset role;

select * from finish();
rollback;
