-- =============================================================================
-- Website analytics for the owner's dashboard (Profile → Analytics).
--  * site_events: anonymous page views + heartbeats from the website. No names,
--    emails or IPs: a random visitor id (kept in the browser) and a session id.
--  * analytics_report(): every number on the dashboard, for the FOUNDER only.
-- New table + functions only — nothing existing is changed or deleted.
-- =============================================================================
create table public.site_events (
  id          bigint generated always as identity primary key,
  visitor_id  uuid not null,
  session_id  uuid not null,
  kind        text not null check (kind in ('pageview', 'heartbeat')),
  path        text not null check (char_length(path) between 1 and 200),
  referrer    text check (char_length(referrer) <= 200),
  utm_source  text check (char_length(utm_source) <= 80),
  device      text not null check (device in ('mobile', 'tablet', 'desktop')),
  created_at  timestamptz not null default now()
);
create index site_events_created_idx on public.site_events (created_at);
create index site_events_session_idx on public.site_events (session_id, created_at);
alter table public.site_events enable row level security;

-- Visitors can only add events (with the server's clock); nobody reads them directly.
grant insert (visitor_id, session_id, kind, path, referrer, utm_source, device) on public.site_events to anon, authenticated;
create policy "anyone can send site events" on public.site_events for insert to anon, authenticated with check (true);

create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and 'founder' = any(badges));
$$;
revoke execute on function public.is_founder() from public, anon;
grant execute on function public.is_founder() to authenticated;

-- One call returns the whole dashboard for the last p_seconds, in p_buckets time buckets,
-- with the previous period of the same length for comparison.
create or replace function public.analytics_report(p_seconds int, p_buckets int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now   timestamptz := now();
  v_from  timestamptz;
  v_prev  timestamptz;
  v_step  double precision;
  v_out   jsonb;
begin
  if not public.is_founder() then
    raise exception 'founder_only' using errcode = '42501';
  end if;
  if p_seconds not between 300 and 400 * 86400 or p_buckets not between 1 and 120 then
    raise exception 'bad_range' using errcode = '22023';
  end if;
  v_from := v_now - make_interval(secs => p_seconds);
  v_prev := v_from - make_interval(secs => p_seconds);
  v_step := p_seconds::double precision / p_buckets;

  with cur as (select * from public.site_events where created_at >= v_from),
       prev as (select * from public.site_events where created_at >= v_prev and created_at < v_from),
       sess as (
         select session_id, count(*) filter (where kind = 'pageview') as views,
                extract(epoch from max(created_at) - min(created_at)) as secs
         from cur group by session_id
       ),
       series as (
         select b, coalesce(count(distinct e.visitor_id), 0) as visitors,
                coalesce(count(*) filter (where e.kind = 'pageview'), 0) as pageviews
         from generate_series(0, p_buckets - 1) b
         left join cur e on floor(extract(epoch from e.created_at - v_from) / v_step) = b
         group by b order by b
       )
  select jsonb_build_object(
    'visitors',        (select count(distinct visitor_id) from cur),
    'visitorsPrev',    (select count(distinct visitor_id) from prev),
    'sessions',        (select count(*) from sess),
    'sessionsPrev',    (select count(distinct session_id) from prev),
    'pageviews',       (select count(*) from cur where kind = 'pageview'),
    'pageviewsPrev',   (select count(*) from prev where kind = 'pageview'),
    'onlineNow',       (select count(distinct session_id) from public.site_events where created_at >= v_now - interval '5 minutes'),
    'avgSessionSecs',  (select coalesce(round(avg(secs)), 0) from sess),
    'bounceRate',      (select coalesce(round(100.0 * count(*) filter (where views <= 1) / nullif(count(*), 0)), 0) from sess),
    'waitlist',        (select count(*) from public.launch_signups where created_at >= v_from),
    'waitlistPrev',    (select count(*) from public.launch_signups where created_at >= v_prev and created_at < v_from),
    'waitlistTotal',   (select count(*) from public.launch_signups),
    'accounts',        (select count(*) from public.profiles where created_at >= v_from),
    'accountsPrev',    (select count(*) from public.profiles where created_at >= v_prev and created_at < v_from),
    'accountsTotal',   (select count(*) from public.profiles),
    'series',          (select coalesce(jsonb_agg(jsonb_build_object('visitors', visitors, 'pageviews', pageviews) order by b), '[]') from series),
    'topPages',        (select coalesce(jsonb_agg(jsonb_build_object('label', path, 'count', n) order by n desc), '[]')
                        from (select path, count(*) n from cur where kind = 'pageview' group by path order by n desc limit 6) t),
    'sources',         (select coalesce(jsonb_agg(jsonb_build_object('label', src, 'count', n) order by n desc), '[]')
                        from (select coalesce(utm_source, nullif(referrer, ''), 'direct') src, count(distinct session_id) n
                              from cur where kind = 'pageview' group by 1 order by n desc limit 6) t),
    'devices',         (select coalesce(jsonb_agg(jsonb_build_object('label', device, 'count', n) order by n desc), '[]')
                        from (select device, count(distinct visitor_id) n from cur group by device) t)
  ) into v_out;
  return v_out;
end;
$$;
revoke execute on function public.analytics_report(int, int) from public, anon;
grant execute on function public.analytics_report(int, int) to authenticated;
