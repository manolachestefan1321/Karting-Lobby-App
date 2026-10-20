-- =============================================================================
-- Seed data so the app works out of the box.
-- Runs after migrations on `supabase db reset` (local) — for production run it
-- once via the SQL editor (see README).
-- =============================================================================

insert into public.countries (code, name_en, name_ro, currency) values
  ('RO', 'Romania', 'România', 'RON')
on conflict (code) do nothing;

insert into public.cities (country_code, name, slug, location, timezone) values
  ('RO', 'București',   'bucuresti',   'SRID=4326;POINT(26.1025 44.4268)', 'Europe/Bucharest'),
  ('RO', 'Cluj-Napoca', 'cluj-napoca', 'SRID=4326;POINT(23.6236 46.7712)', 'Europe/Bucharest'),
  ('RO', 'Timișoara',   'timisoara',   'SRID=4326;POINT(21.2087 45.7489)', 'Europe/Bucharest'),
  ('RO', 'Iași',        'iasi',        'SRID=4326;POINT(27.6014 47.1585)', 'Europe/Bucharest'),
  ('RO', 'Constanța',   'constanta',   'SRID=4326;POINT(28.6348 44.1598)', 'Europe/Bucharest'),
  ('RO', 'Brașov',      'brasov',      'SRID=4326;POINT(25.5887 45.6427)', 'Europe/Bucharest'),
  ('RO', 'Craiova',     'craiova',     'SRID=4326;POINT(23.7949 44.3302)', 'Europe/Bucharest'),
  ('RO', 'Oradea',      'oradea',      'SRID=4326;POINT(21.9189 47.0465)', 'Europe/Bucharest')
on conflict (slug) do nothing;
