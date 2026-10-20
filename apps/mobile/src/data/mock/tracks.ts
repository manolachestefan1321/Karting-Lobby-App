/**
 * REAL karting tracks in Romania, with prices looked up from the tracks' websites
 * and public listings on 2026-10-20. Every price is marked `verified: false`
 * ("to verify") until someone confirms it with the track — the app shows that.
 *
 * ⚠️ Coordinates are APPROXIMATE (from the address) — check them on a map before
 *    launch, because check-in uses them (300 m radius).
 * ⚠️ maxDrivers is an estimate where the track doesn't publish it.
 *
 * Sources and what to check for each track: docs/TRACKS.md
 */
import type { Track } from '../types';

const LOOKED_UP = '2026-10-20T12:00:00.000Z';
const TZ = 'Europe/Bucharest';

type Seed = Omit<Track, 'price' | 'timezone'> & {
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
    priceLei: 100,
    sourceUrl: 'https://www.amckart.ro/pricing/',
    priceNote: '10 min, 6.5 CP kart, non-member (13 CP kart: 120 lei). Members −10 lei. Balaclava 15 lei extra.',
  },
  {
    id: 't-vmax-romexpo',
    cityId: 'c-buc',
    name: 'VMax Electric Indoor Karting Romexpo',
    address: 'Romexpo, Pavilioanele C4–C5, Bd. Expoziției, București',
    lat: 44.4766,
    lng: 26.0628,
    website: 'https://vmaxromexpo.ro',
    phone: null,
    openingHours: 'Booking required (to verify)',
    kartTypes: ['Electric'],
    sessionLengthMin: 10,
    maxDrivers: 10,
    checkinRadiusM: null,
    indoor: true,
    priceLei: 120,
    sourceUrl: 'https://vmaxromexpo.ro/categorie-produs/pachete-sesiuni/',
    priceNote: '1-session package bought online, balaclava included. Event page also lists 50 lei (Mon–Fri) / 70 lei (weekend) per extra session.',
  },
  {
    id: 't-tomiskart',
    cityId: 'c-ct',
    name: 'Tomis Kart Mamaia',
    address: 'Parcarea Pavilionului Expozițional, Constanța',
    lat: 44.2049,
    lng: 28.6385,
    website: 'https://www.facebook.com/kartingconstanta/',
    phone: null,
    openingHours: 'Seasonal (to verify)',
    kartTypes: ['Honda'],
    sessionLengthMin: 6,
    maxDrivers: 8,
    checkinRadiusM: null,
    indoor: false,
    priceLei: 30,
    sourceUrl: 'https://www.infopensiuni.ro/cazare-mamaia/obiective-turistice-mamaia/clubul-de-karting-tomis-kart-mamaia_9641',
    priceNote: '6 min adult race (≈200 m track). Another listing says 25 lei / 10 min — sources disagree.',
  },
  {
    id: 't-tt-transilvania',
    cityId: 'c-cj',
    name: 'T&T Karting Transilvania (Dej)',
    address: 'Dej, jud. Cluj (≈60 km from Cluj-Napoca)',
    lat: 47.1430,
    lng: 23.8750,
    website: 'https://kartingtransilvania.com',
    phone: null,
    openingHours: 'See website (to verify)',
    kartTypes: ['RiMO GX 200', 'RiMO GX 270', 'RiMO GX 390'],
    sessionLengthMin: 10,
    maxDrivers: 12,
    checkinRadiusM: null,
    indoor: false,
    priceLei: 75,
    sourceUrl: 'https://kartingtransilvania.ro/orar-si-tarife/',
    priceNote: '10 min, GX 270 kart (GX 200: 65 lei, GX 390: 95 lei). Prices valid for online bookings only.',
  },
  {
    id: 't-greenkart-tm',
    cityId: 'c-tm',
    name: 'Green Kart Timișoara',
    address: 'Str. Albăstrelelor 6A, Cartierul Plopi, Timișoara',
    lat: 45.7830,
    lng: 21.2510,
    website: 'https://greenkart.ro',
    phone: '+40 786 144 091',
    openingHours: 'Tue–Sun (to verify)',
    kartTypes: ['Rental karts'],
    sessionLengthMin: 10,
    maxDrivers: 8,
    checkinRadiusM: null,
    indoor: false,
    priceLei: 40,
    sourceUrl: 'https://greenkart.ro/',
    priceNote: '10 min: 30 lei Tue–Fri, 40 lei weekend (weekend price used). Check whether adult karts are offered — listings mention children.',
  },
  {
    id: 't-iasi-indoor',
    cityId: 'c-is',
    name: 'Indoor Karting Calea Chișinăului',
    address: 'Calea Chișinăului, Iași',
    lat: 47.1560,
    lng: 27.6260,
    website: null,
    phone: null,
    openingHours: 'To verify',
    kartTypes: ['Indoor karts'],
    sessionLengthMin: 8,
    maxDrivers: 8,
    checkinRadiusM: null,
    indoor: true,
    priceLei: 80,
    sourceUrl: 'https://www.ziaruldeiasi.ro/stiri/un-fost-pilot-de-formula-2-si-a-extins-afacerile-in-iasi-pista-de-karting-acoperita-pe-calea-chisinaului--375021.html',
    priceNote: '"From 80 lei for 8 minutes" in a ~3-year-old news article — likely outdated. Confirm name, address and price.',
  },
  {
    id: 't-prejmer',
    cityId: 'c-bv',
    name: 'Prejmer Raceway',
    address: 'Prejmer, jud. Brașov',
    lat: 45.7270,
    lng: 25.7690,
    website: 'https://prejmer-raceway.com',
    phone: null,
    openingHours: 'See website (to verify)',
    kartTypes: ['Arrive & drive karts'],
    sessionLengthMin: 10,
    maxDrivers: 10,
    checkinRadiusM: null,
    indoor: false,
    priceLei: 60,
    sourceUrl: 'https://prejmer-raceway.com/pasionati.php',
    priceNote: 'Adult arrive & drive, 10 min.',
  },
  {
    id: 't-masterkart',
    cityId: 'c-bv',
    name: 'Masterkart Ghimbav',
    address: 'Ghimbav, jud. Brașov',
    lat: 45.6640,
    lng: 25.5070,
    website: null,
    phone: null,
    openingHours: 'To verify',
    kartTypes: ['6.5 CP', '9 CP', 'Kids 2.5–4 CP'],
    sessionLengthMin: 10,
    maxDrivers: 8,
    checkinRadiusM: null,
    indoor: false,
    priceLei: 50,
    sourceUrl: 'https://www.fasport.ro/karting/Brasov/Masterkart.html',
    priceNote: '10 min, adult 9 CP kart (6.5 CP: 35 lei). Undated listing — likely outdated.',
  },
];

/**
 * Tracks found without a published price (not seeded — add them once a price is known):
 *  - Red Motor, Str. Ovidiu Cotruș 30, Timișoara (720 m outdoor) · +40 724 338 387
 *  - Karting Isac, Str. Ioan Slavici 71, Timișoara · 0256 221 875
 *  - KiKi Karting Constanța
 * No tracks were found for Craiova and Oradea.
 */
export const REAL_TRACKS: Track[] = SEEDS.map(({ priceLei, sourceUrl, priceNote, ...t }) => ({
  ...t,
  timezone: TZ,
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
