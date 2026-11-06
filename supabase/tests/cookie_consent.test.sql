-- Cookie consent: anyone records a choice; nobody but the founder reads them; old data is purged.
begin;
select plan(4);

set local role anon;
select lives_ok($$ insert into public.consent_log (consent_id, analytics, version) values ('00000000-0000-0000-0000-00000000ccc1', true, '2026-11-06') $$,
                'a visitor records their choice');
select throws_ok($$ select count(*) from public.consent_log $$, '42501', null, 'visitors cannot read consent records');
reset role;

-- Retention: 13 months for statistics, 3 years for consent records; newer rows stay.
insert into public.site_events (visitor_id, session_id, kind, path, device) values
  ('00000000-0000-0000-0000-00000000aaa9', '00000000-0000-0000-0000-00000000bbb9', 'pageview', '/join', 'mobile'),
  ('00000000-0000-0000-0000-00000000aaa8', '00000000-0000-0000-0000-00000000bbb8', 'pageview', '/join', 'mobile');
update public.site_events set created_at = now() - interval '14 months' where visitor_id = '00000000-0000-0000-0000-00000000aaa9';
select public.purge_expired_site_data();
select is((select count(*)::int from public.site_events where visitor_id in ('00000000-0000-0000-0000-00000000aaa9', '00000000-0000-0000-0000-00000000aaa8')), 1,
          'statistics older than 13 months are deleted, recent ones kept');
select has_trigger('public', 'site_events', 'site_events_retention', 'retention trigger is installed');

select * from finish();
rollback;
