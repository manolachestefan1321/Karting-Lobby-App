/**
 * The karting tracks KartUP works with: the five VMax venues (București Romexpo and
 * Titan, Cluj, Brașov, Timișoara) and AMC Kart Tunari. Prices looked up from the
 * tracks' websites and public listings (Oct 2026). Every price is marked `verified: false`
 * ("to verify") until someone confirms it with the track — the app shows that.
 *
 * ⚠️ Coordinates are APPROXIMATE (from the address) — check them on a map before
 *    launch, because check-in uses them (300 m radius).
 * ⚠️ maxDrivers is an estimate where the track doesn't publish it.
 * ⚠️ lapLengthM (used for km) is "to verify" for EVERY track: sources disagree or
 *    there is none. The list with sources is in docs/PREVIEW-TESTING.md.
 *
 * Sources and what to check for each track: docs/TRACKS.md
 */
import type { Track } from '../types';

const LOOKED_UP = '2026-10-20T12:00:00.000Z';
const TZ = 'Europe/Bucharest';

type Seed = Omit<Track, 'price' | 'timezone' | 'lapLengthVerified'> & {
  priceLei: number;
  sourceUrl: string;
  priceNote: string;
};

const SEEDS: Seed[] = [
  {
    id: 't-amckart',
    cityId: 'c-buc',
    name: 'AMC Kart',
    address: 'Șoseaua de Centură nr. 5A, Tunari, Ilfov',
    lat: 44.5465,
    lng: 26.1285,
    website: 'https://www.amckart.ro',
    phone: '0741 100 700',
    openingHours: 'Daily from 10:00 (to verify) · floodlit at night',
    kartTypes: ['6.5 CP', '13 CP', 'Two-seater 9 CP'],
    sessionLengthMin: 10,
    maxDrivers: 12,
    checkinRadiusM: null,
    indoor: false,
    lapLengthM: 1240,
    priceLei: 100,
    sourceUrl: 'https://www.amckart.ro/pricing/',
    priceNote: '10 min, 6.5 CP kart, non-member (13 CP kart: 120 lei). Members −10 lei. Balaclava 15 lei extra.',
  },
  {
    id: 't-vmax-romexpo',
    cityId: 'c-buc',
    name: 'VMax Electric Indoor Karting Romexpo',
    address: 'Bd. Mărăști 65–67, Romexpo Pavilion C4–C5, București',
    lat: 44.4766,
    lng: 26.0628,
    website: 'https://vmaxromexpo.ro',
    phone: '+40 760 100 855',
    openingHours: 'Booking required (to verify)',
    kartTypes: ['Electric'],
    sessionLengthMin: 10,
    maxDrivers: 10,
    checkinRadiusM: null,
    indoor: true,
    lapLengthM: 700,
    priceLei: 120,
    sourceUrl: 'https://vmaxromexpo.ro/categorie-produs/pachete-sesiuni/',
    priceNote: '1-session package bought online, balaclava included. Event page also lists 50 lei (Mon–Fri) / 70 lei (weekend) per extra session.',
  },
  {
    id: 't-vmax-titan',
    cityId: 'c-buc',
    name: 'VMax Karting Titan',
    address: 'Bd. 1 Decembrie 1918 nr. 1J, Sector 3, București',
    lat: 44.4235,
    lng: 26.1665,
    website: 'https://vmaxtitan.ro',
    phone: '0771 240 237',
    openingHours: 'Mon–Sun · groups of 8+ by reservation (to verify)',
    kartTypes: ['Electric (with boost)'],
    sessionLengthMin: 10,
    maxDrivers: 10,
    checkinRadiusM: null,
    indoor: true,
    lapLengthM: 600,
    priceLei: 100,
    sourceUrl: 'https://vmaxtitan.ro/en/shop/',
    priceNote: '1-session package bought online, balaclava included (3 sessions: 190 lei). Price page also lists 70–90 lei per adult session (member/non-member columns unclear). Mini Grand Prix 10 min: 90–120 lei.',
  },
  {
    id: 't-vmax-cluj',
    cityId: 'c-cj',
    name: 'VMax Karting Cluj',
    address: 'Bd. Muncii 14, Cluj-Napoca',
    lat: 46.781,
    lng: 23.628,
    website: 'https://vmaxcluj.ro',
    phone: '+40 771 588 344',
    openingHours: 'See website (to verify)',
    kartTypes: ['Electric (Sodi RSX2)'],
    sessionLengthMin: 8,
    maxDrivers: 13,
    checkinRadiusM: null,
    indoor: true,
    lapLengthM: 500,
    priceLei: 80,
    sourceUrl: 'https://vmaxcluj.ro/en/preturi/',
    priceNote: '8 min adult session, weekend price (weekdays 70 lei; members 10 lei less). Another listing gives Str. Fabricii de Zahăr 165 as the address: confirm the entrance.',
  },
  {
    id: 't-vmax-brasov',
    cityId: 'c-bv',
    name: 'VMax Karting Brașov',
    address: 'Str. Henri Coandă nr. 2, Hala H14 (Coresi), Brașov',
    lat: 45.673,
    lng: 25.617,
    website: 'https://vmaxbrasov.ro',
    phone: '+40 774 959 913',
    openingHours: 'Mon–Thu 15–23, Fri 15–24, Sat 11–24, Sun 11–23 (to verify)',
    kartTypes: ['Electric (Sodi RSX2)'],
    sessionLengthMin: 8,
    maxDrivers: 13,
    checkinRadiusM: null,
    indoor: true,
    lapLengthM: 600,
    priceLei: 90,
    sourceUrl: 'https://vmaxbrasov.ro/en/preturi/',
    priceNote: '8 min adult session, non-member (members 80 lei on weekdays). Multi-level track; events page says 650 m.',
  },
  {
    id: 't-vmax-timisoara',
    cityId: 'c-tm',
    name: 'VMax Karting Timișoara',
    address: 'Calea Stan Vidrighin 5, Timișoara',
    lat: 45.74,
    lng: 21.262,
    website: 'https://vmaxtimisoara.ro',
    phone: '+40 772 232 034',
    openingHours: 'See website (to verify)',
    kartTypes: ['Electric (Sodi RSX2)'],
    sessionLengthMin: 8,
    maxDrivers: 13,
    checkinRadiusM: null,
    indoor: true,
    lapLengthM: 600,
    priceLei: 90,
    sourceUrl: 'https://vmaxtimisoara.ro/preturi/',
    priceNote: '8 min adult session, non-member (members 80 lei on weekdays). Track length: sources say 500 or 600 m.',
  },
];

export const REAL_TRACKS: Track[] = SEEDS.map(({ priceLei, sourceUrl, priceNote, ...t }) => ({
  ...t,
  timezone: TZ,
  // Every lap length is "to verify" — list + sources in docs/PREVIEW-TESTING.md.
  lapLengthVerified: false,
  price: {
    perDriverMinor: priceLei * 100,
    currency: 'RON',
    updatedAt: LOOKED_UP,
    source: 'manual',
    sourceUrl,
    verified: false,
    note: priceNote,
  },
}));
