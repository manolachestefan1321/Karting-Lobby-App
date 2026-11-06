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
  ('bucuresti',   'VMax Romexpo',                          'vmax-romexpo',    'Bd. Mărăști 65–67, Romexpo Pavilion C4–C5, București', 'SRID=4326;POINT(26.0628 44.4766)'),
  ('bucuresti',   'VMax Titan',                            'vmax-titan',      'Bd. 1 Decembrie 1918 nr. 1J, Sector 3, București',     'SRID=4326;POINT(26.1665 44.4235)'),
  ('cluj-napoca', 'VMax Cluj',                             'vmax-cluj',       'Bd. Muncii 14, Cluj-Napoca',                           'SRID=4326;POINT(23.6280 46.7810)'),
  ('brasov',      'VMax Brașov',                           'vmax-brasov',     'Str. Henri Coandă nr. 2, Hala H14 (Coresi), Brașov',   'SRID=4326;POINT(25.6170 45.6730)'),
  ('timisoara',   'VMax Timișoara',                        'vmax-timisoara',  'Calea Stan Vidrighin 5, Timișoara',                    'SRID=4326;POINT(21.2620 45.7400)')
) as t(city_slug, name, slug, address, location)
join public.cities c on c.slug = t.city_slug
on conflict (slug) do nothing;

-- If an older version of this seed was already run, hide the tracks that are no
-- longer offered. They are NOT deleted (so no data is lost); re-enable with is_active = true.
update public.tracks set is_active = false
where slug not in ('amc-kart', 'vmax-romexpo', 'vmax-titan', 'vmax-cluj', 'vmax-brasov', 'vmax-timisoara');

-- Track details (price, lap length, session length, …): all "to verify", like in the demo.
update public.tracks set
  website = 'https://www.amckart.ro', phone = '0741 100 700', opening_hours = 'Daily from 10:00 (to verify) · floodlit at night',
  kart_types = array['6.5 CP', '13 CP', 'Two-seater 9 CP']::text[], session_length_min = 10, max_drivers = 12, indoor = false,
  lap_length_m = 1240, price_per_driver_minor = 10000, price_note = '10 min, 6.5 CP kart, non-member (13 CP kart: 120 lei). Members −10 lei. Balaclava 15 lei extra.', price_source_url = 'https://www.amckart.ro/pricing/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'amc-kart';
update public.tracks set
  website = 'https://vmaxromexpo.ro', phone = '+40 760 100 855', opening_hours = 'Booking required (to verify)',
  kart_types = array['Electric']::text[], session_length_min = 10, max_drivers = 10, indoor = true,
  lap_length_m = 700, price_per_driver_minor = 12000, price_note = '1-session package bought online, balaclava included. Event page also lists 50 lei (Mon–Fri) / 70 lei (weekend) per extra session.', price_source_url = 'https://vmaxromexpo.ro/categorie-produs/pachete-sesiuni/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-romexpo';
update public.tracks set
  website = 'https://vmaxtitan.ro', phone = '0771 240 237', opening_hours = 'Mon–Sun · groups of 8+ by reservation (to verify)',
  kart_types = array['Electric (with boost)']::text[], session_length_min = 10, max_drivers = 10, indoor = true,
  lap_length_m = 600, price_per_driver_minor = 10000, price_note = '1-session package bought online, balaclava included (3 sessions: 190 lei). Price page also lists 70–90 lei per adult session (member/non-member columns unclear). Mini Grand Prix 10 min: 90–120 lei.', price_source_url = 'https://vmaxtitan.ro/en/shop/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-titan';
update public.tracks set
  website = 'https://vmaxcluj.ro', phone = '+40 771 588 344', opening_hours = 'See website (to verify)',
  kart_types = array['Electric (Sodi RSX2)']::text[], session_length_min = 8, max_drivers = 13, indoor = true,
  lap_length_m = 500, price_per_driver_minor = 8000, price_note = '8 min adult session, weekend price (weekdays 70 lei; members 10 lei less). Another listing gives Str. Fabricii de Zahăr 165 as the address: confirm the entrance.', price_source_url = 'https://vmaxcluj.ro/en/preturi/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-cluj';
update public.tracks set
  website = 'https://vmaxbrasov.ro', phone = '+40 774 959 913', opening_hours = 'Mon–Thu 15–23, Fri 15–24, Sat 11–24, Sun 11–23 (to verify)',
  kart_types = array['Electric (Sodi RSX2)']::text[], session_length_min = 8, max_drivers = 13, indoor = true,
  lap_length_m = 600, price_per_driver_minor = 9000, price_note = '8 min adult session, non-member (members 80 lei on weekdays). Multi-level track; events page says 650 m.', price_source_url = 'https://vmaxbrasov.ro/en/preturi/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-brasov';
update public.tracks set
  website = 'https://vmaxtimisoara.ro', phone = '+40 772 232 034', opening_hours = 'See website (to verify)',
  kart_types = array['Electric (Sodi RSX2)']::text[], session_length_min = 8, max_drivers = 13, indoor = true,
  lap_length_m = 600, price_per_driver_minor = 9000, price_note = '8 min adult session, non-member (members 80 lei on weekdays). Track length: sources say 500 or 600 m.', price_source_url = 'https://vmaxtimisoara.ro/preturi/',
  price_updated_at = '2026-10-20T12:00:00.000Z'
where slug = 'vmax-timisoara';
