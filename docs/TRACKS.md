# Seeded karting tracks: sources and what to verify

These are real tracks in Romania. Prices were looked up on **20 October 2026** from the tracks' websites and public listings. Every price is stored with `verified: false`, so the app shows **"Price to verify with the track"** with a link to the source.

The data lives in `apps/mobile/src/data/mock/tracks.ts`. The same list will seed the real database.

**Before launch, for each track:** call or check the website, then confirm or correct the price (adult, standard kart, one session, non-member), the session length, the maximum karts on track, the opening hours and the exact address. **Also check the map coordinates**: they are approximate and check-in depends on them (300 m radius). Then set `verified: true`.

| Track | City | Price used | Session | Source | Notes / doubts |
|---|---|---|---|---|---|
| AMC Kart | București (Tunari, Ilfov) | **100 lei** | 10 min | [amckart.ro/pricing](https://www.amckart.ro/pricing/) | 6.5 CP kart, non-member. 13 CP kart = 120 lei. Members pay 10 lei less. Balaclava 15 lei. Older listings show 65–85 lei. Phone 0741 100 700. |
| VMax Electric Indoor Karting Romexpo | București | **120 lei** | 10 min? | [vmaxromexpo.ro packages](https://vmaxromexpo.ro/categorie-produs/pachete-sesiuni/) | 1-session online package, balaclava included. The events page also shows 50 lei (Mon–Fri) / 70 lei (weekend) per *extra* session. Reviews mention a 10-min session including a 2-min briefing. |
| Tomis Kart Mamaia | Constanța | **30 lei** | 6 min | [infopensiuni.ro](https://www.infopensiuni.ro/cazare-mamaia/obiective-turistice-mamaia/clubul-de-karting-tomis-kart-mamaia_9641) | Two sources say 30 lei / 6 min. [faSport](https://fasport.ro/karting/Constanta/Tomis-Kart.html) says 25 lei / 10 min. Address unclear (Pavilionul Expozițional vs Bd. Mamaia 331). |
| T&T Karting Transilvania | Dej (Cluj county) | **75 lei** | 10 min | [kartingtransilvania.ro](https://kartingtransilvania.ro/orar-si-tarife/) | GX 270 kart. GX 200 = 65 lei, GX 390 = 95 lei. Online-booking prices. About 60 km from Cluj-Napoca; no in-city Cluj track with a price was found. |
| Green Kart Timișoara | Timișoara | **40 lei** | 10 min | [greenkart.ro](https://greenkart.ro/) | 30 lei Tue–Fri, 40 lei weekend. **Check that adults can drive**: some listings describe it as a kids' track. Phone +40 786 144 091. |
| Indoor Karting Calea Chișinăului | Iași | **80 lei** | 8 min | [Ziarul de Iași](https://www.ziaruldeiasi.ro/stiri/un-fost-pilot-de-formula-2-si-a-extins-afacerile-in-iasi-pista-de-karting-acoperita-pe-calea-chisinaului--375021.html) | "From 80 lei / 8 min" in an article about 3 years old. **Confirm the name, that it's still open, and the price.** |
| Prejmer Raceway | Prejmer (Brașov county) | **60 lei** | 10 min | [prejmer-raceway.com](https://prejmer-raceway.com/pasionati.php) | Adult arrive & drive. |
| Masterkart Ghimbav | Ghimbav (Brașov county) | **50 lei** | 10 min | [faSport](https://www.fasport.ro/karting/Brasov/Masterkart.html) | 9 CP adult kart (6.5 CP = 35 lei). Undated listing, probably outdated. |

## Found, but not seeded (no price published)
- **Red Motor**, Str. Ovidiu Cotruș 30, Timișoara: 720 m outdoor track, +40 724 338 387.
- **Karting Isac**, Str. Ioan Slavici 71, Timișoara: 0256 221 875 / 0722 348 274.
- **KiKi Karting Constanța**.

No tracks were found for **Craiova** or **Oradea**, so those cities show the "no sessions / no tracks" empty state in the preview.

## How prices stay current later
With the real backend, each track gets a `PriceProvider`. It is either *scrape*, reading the price page on a daily schedule, or *manual*, where an admin types the price. The app always shows when the price was last updated. A price an admin has confirmed becomes `verified: true`, and the "to verify" chip disappears.
