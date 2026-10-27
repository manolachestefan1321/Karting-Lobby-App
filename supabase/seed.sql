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

-- The tracks KartUP works with: the 5 VMax venues + AMC Kart Tunari.
-- Coordinates are APPROXIMATE — verify before launch (check-in uses them). Sources: docs/TRACKS.md
insert into public.tracks (city_id, name, slug, address, location)
select c.id, t.name, t.slug, t.address, t.location::extensions.geography
from (values
  ('bucuresti',   'AMC Kart',                              'amc-kart',        'Șoseaua de Centură nr. 5A, Tunari, Ilfov',             'SRID=4326;POINT(26.1285 44.5465)'),
  ('bucuresti',   'VMax Electric Indoor Karting Romexpo',  'vmax-romexpo',    'Bd. Mărăști 65–67, Romexpo Pavilion C4–C5, București', 'SRID=4326;POINT(26.0628 44.4766)'),
  ('bucuresti',   'VMax Karting Titan',                    'vmax-titan',      'Bd. 1 Decembrie 1918 nr. 1J, Sector 3, București',     'SRID=4326;POINT(26.1665 44.4235)'),
  ('cluj-napoca', 'VMax Karting Cluj',                     'vmax-cluj',       'Bd. Muncii 14, Cluj-Napoca',                           'SRID=4326;POINT(23.6280 46.7810)'),
  ('brasov',      'VMax Karting Brașov',                   'vmax-brasov',     'Str. Henri Coandă nr. 2, Hala H14 (Coresi), Brașov',   'SRID=4326;POINT(25.6170 45.6730)'),
  ('timisoara',   'VMax Karting Timișoara',                'vmax-timisoara',  'Calea Stan Vidrighin 5, Timișoara',                    'SRID=4326;POINT(21.2620 45.7400)')
) as t(city_slug, name, slug, address, location)
join public.cities c on c.slug = t.city_slug
on conflict (slug) do nothing;

-- If an older version of this seed was already run, hide the tracks that are no
-- longer offered. They are NOT deleted (so no data is lost); re-enable with is_active = true.
update public.tracks set is_active = false
where slug not in ('amc-kart', 'vmax-romexpo', 'vmax-titan', 'vmax-cluj', 'vmax-brasov', 'vmax-timisoara');
