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

-- Real karting tracks (details, prices and "to verify" flags are added with the
-- tracks/prices migration). Coordinates are APPROXIMATE — verify before launch.
-- Sources: docs/TRACKS.md
insert into public.tracks (city_id, name, slug, address, location)
select c.id, t.name, t.slug, t.address, t.location::extensions.geography
from (values
  ('bucuresti',   'AMC Kart',                              'amc-kart',               'Șoseaua de Centură nr. 5A, Tunari, Ilfov',            'SRID=4326;POINT(26.1285 44.5465)'),
  ('bucuresti',   'VMax Electric Indoor Karting Romexpo',  'vmax-romexpo',           'Bd. Mărăști 65–67, Romexpo Pavilion C4–C5, București', 'SRID=4326;POINT(26.0628 44.4766)'),
  ('bucuresti',   'VMax Karting Titan',                    'vmax-titan',             'Bd. 1 Decembrie 1918 nr. 1J, Sector 3, București',    'SRID=4326;POINT(26.1665 44.4235)'),
  ('constanta',   'Tomis Kart Mamaia',                     'tomis-kart-mamaia',      'Parcarea Pavilionului Expozițional, Constanța',        'SRID=4326;POINT(28.6385 44.2049)'),
  ('cluj-napoca', 'T&T Karting Transilvania (Dej)',        'tt-karting-transilvania','Dej, jud. Cluj',                                      'SRID=4326;POINT(23.8750 47.1430)'),
  ('timisoara',   'Green Kart Timișoara',                  'green-kart-timisoara',   'Str. Albăstrelelor 6A, Timișoara',                    'SRID=4326;POINT(21.2510 45.7830)'),
  ('iasi',        'Indoor Karting Calea Chișinăului',      'indoor-karting-iasi',    'Calea Chișinăului, Iași',                             'SRID=4326;POINT(27.6260 47.1560)'),
  ('brasov',      'Prejmer Raceway',                       'prejmer-raceway',        'Prejmer, jud. Brașov',                                'SRID=4326;POINT(25.7690 45.7270)'),
  ('brasov',      'Masterkart Ghimbav',                    'masterkart-ghimbav',     'Ghimbav, jud. Brașov',                                'SRID=4326;POINT(25.5070 45.6640)'),
  ('timisoara',   'Red Motor',                             'red-motor',              'Str. Ovidiu Cotruș 30, Timișoara',                    'SRID=4326;POINT(21.2620 45.7745)'),
  ('craiova',     'Drift Karting Craiova',                 'drift-karting-craiova',  'Fosta Regie de Tutun, Craiova (to verify)',           'SRID=4326;POINT(23.8150 44.3245)'),
  ('oradea',      'Krea Karting',                          'krea-karting',           'Str. Rampei 11, Oradea',                              'SRID=4326;POINT(21.9430 47.0580)')
) as t(city_slug, name, slug, address, location)
join public.cities c on c.slug = t.city_slug
on conflict (slug) do nothing;
