-- =============================================================================
-- "Join the race": sign-ups for the launch event, from the website.
-- Anyone (even without an account) can sign up; only admins can read the list.
-- New table only — nothing existing is changed or deleted.
-- =============================================================================
create table public.launch_signups (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null check (char_length(trim(first_name)) between 1 and 50),
  last_name   text not null check (char_length(trim(last_name)) between 1 and 50),
  phone       text not null check (phone ~ '^\+?[0-9 ()\-.]{9,25}$'),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  locale      text not null default 'ro' check (locale in ('en', 'ro')),
  consent_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
-- One sign-up per email (case-insensitive).
create unique index launch_signups_email_key on public.launch_signups (lower(email));
alter table public.launch_signups enable row level security;

grant insert (first_name, last_name, phone, email, locale) on public.launch_signups to anon, authenticated;
grant select on public.launch_signups to authenticated;
create policy "anyone can join the race" on public.launch_signups for insert to anon, authenticated with check (true);
create policy "admins read sign-ups"     on public.launch_signups for select to authenticated using (public.is_admin());
