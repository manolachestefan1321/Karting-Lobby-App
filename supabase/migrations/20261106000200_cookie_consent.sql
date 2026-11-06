-- =============================================================================
-- Cookie consent (website): proof of each choice (GDPR Art. 7(1): we must be able
-- to show consent was given), and automatic deletion of old data as the privacy
-- policy promises: website statistics after 13 months, consent records after 3 years.
-- New table + triggers only — nothing existing is changed or deleted.
-- =============================================================================
create table public.consent_log (
  id          bigint generated always as identity primary key,
  consent_id  uuid not null,            -- random id kept with the choice in the browser
  analytics   boolean not null,
  version     text not null check (char_length(version) <= 20),
  locale      text not null default 'ro' check (locale in ('en', 'ro')),
  created_at  timestamptz not null default now()
);
create index consent_log_consent_idx on public.consent_log (consent_id, created_at);
alter table public.consent_log enable row level security;
grant insert (consent_id, analytics, version, locale) on public.consent_log to anon, authenticated;
create policy "anyone records their own choice" on public.consent_log for insert to anon, authenticated with check (true);
create policy "founder reads consent records" on public.consent_log for select to authenticated using (public.is_founder());

-- Retention: deletes what the privacy policy says we no longer keep.
create or replace function public.purge_expired_site_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.site_events where created_at < now() - interval '13 months';
  delete from public.consent_log where created_at < now() - interval '3 years';
$$;
revoke execute on function public.purge_expired_site_data() from public, anon, authenticated;

-- Runs the purge on about 1% of inserts, so no scheduler is needed.
create or replace function public.purge_expired_site_data_sometimes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if random() < 0.01 then
    perform public.purge_expired_site_data();
  end if;
  return null;
end;
$$;
revoke execute on function public.purge_expired_site_data_sometimes() from public, anon, authenticated;
create trigger site_events_retention after insert on public.site_events
  for each statement execute function public.purge_expired_site_data_sometimes();
create trigger consent_log_retention after insert on public.consent_log
  for each statement execute function public.purge_expired_site_data_sometimes();
