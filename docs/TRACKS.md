# Seeded karting tracks: sources and what to verify

These are real tracks in Romania. Prices were looked up on **20 October 2026** from the tracks' websites and public listings. Every price is stored with `verified: false`, so the app shows **"Price to verify with the track"** with a link to the source.

The data lives in `apps/mobile/src/data/mock/tracks.ts`. The same list will seed the real database.

**Before launch, for each track:** call or check the website, then confirm or correct the price (adult, standard kart, one session, non-member), the session length, the maximum karts on track, the opening hours and the exact address. **Also check the map coordinates**: they are approximate and check-in depends on them (300 m radius). Then set `verified: true`.

| Track | City | Price used | Session | Source | Notes / doubts |
|---|---|---|---|---|---|
| AMC Kart | București (Tunari, Ilfov) | **100 lei** | 10 min | [amckart.ro/pricing](https://www.amckart.ro/pricing/) | 6.5 CP kart, non-member. 13 CP kart = 120 lei. Members pay 10 lei less. Balaclava 15 lei. Older listings show 65–85 lei. Phone 0741 100 700. |
| VMax Electric Indoor Karting Romexpo | București (Bd. Mărăști 65–67, Pavilion C4–C5) | **120 lei** | 10 min? | [vmaxromexpo.ro packages](https://vmaxromexpo.ro/categorie-produs/pachete-sesiuni/) | 1-session online package, balaclava included. The events page also shows 50 lei (Mon–Fri) / 70 lei (weekend) per *extra* session. Reviews mention a 10-min session including a 2-min briefing. |
| VMax Karting Titan | București (Bd. 1 Decembrie 1918 nr. 1J, Sector 3) | **100 lei** | 10 min? | [vmaxtitan.ro shop](https://vmaxtitan.ro/en/shop/) · [prices](https://vmaxtitan.ro/en/preturi/) | 1-session package bought online, balaclava included (3 sessions = 190 lei). The price page lists 70–90 lei per adult session, but it's unclear which column is members. Mini Grand Prix 10 min = 90–120 lei. Electric karts with boost. Phone 0771 240 237 (from an older listing). *(looked up 21 Oct)* |
| Tomis Kart Mamaia | Constanța | **30 lei** | 6 min | [infopensiuni.ro](https://www.infopensiuni.ro/cazare-mamaia/obiective-turistice-mamaia/clubul-de-karting-tomis-kart-mamaia_9641) | Two sources say 30 lei / 6 min. [faSport](https://fasport.ro/karting/Constanta/Tomis-Kart.html) says 25 lei / 10 min. Address unclear (Pavilionul Expozițional vs Bd. Mamaia 331). |
| T&T Karting Transilvania | Dej (Cluj county) | **75 lei** | 10 min | [kartingtransilvania.ro](https://kartingtransilvania.ro/orar-si-tarife/) | GX 270 kart. GX 200 = 65 lei, GX 390 = 95 lei. Online-booking prices. About 60 km from Cluj-Napoca; no in-city Cluj track with a price was found. |
| Green Kart Timișoara | Timișoara | **40 lei** | 10 min | [greenkart.ro](https://greenkart.ro/) | 30 lei Tue–Fri, 40 lei weekend. **Check that adults can drive**: some listings describe it as a kids' track. Phone +40 786 144 091. |
| Indoor Karting Calea Chișinăului | Iași | **80 lei** | 8 min | [Ziarul de Iași](https://www.ziaruldeiasi.ro/stiri/un-fost-pilot-de-formula-2-si-a-extins-afacerile-in-iasi-pista-de-karting-acoperita-pe-calea-chisinaului--375021.html) | "From 80 lei / 8 min" in an article about 3 years old. **Confirm the name, that it's still open, and the price.** |
| Prejmer Raceway | Prejmer (Brașov county) | **60 lei** | 10 min | [prejmer-raceway.com](https://prejmer-raceway.com/pasionati.php) | Adult arrive & drive. |
| Masterkart Ghimbav | Ghimbav (Brașov county) | **50 lei** | 10 min | [faSport](https://www.fasport.ro/karting/Brasov/Masterkart.html) | 9 CP adult kart (6.5 CP = 35 lei). Undated listing, probably outdated. |
| Red Motor | Timișoara | **70 lei** | 10 min | [redmotor.ro/preturi](https://redmotor.ro/preturi/) | "Sprint" 10 min without qualifying. Grand Prix 12 min = 89 lei, 18 min = 135 lei. 720 m outdoor. The price page layout is jumbled, so confirm by phone: 0724 338 387. *(looked up 21 Oct)* |
| Drift Karting Craiova | Craiova | **50 lei** | 10 min | [findglocal listing](https://www.findglocal.com/RO/Craiova/220699854755572/Drift-Karting) · [Facebook](https://www.facebook.com/driftkartingtrack/) | Sat–Sun 10:00–19:00, walk-in only. Older listings say 20 lei. **Address uncertain** (former Regia de Tutun site). Check whether groups can book. *(looked up 21 Oct)* |
| Krea Karting | Oradea | **50 lei** | 10 min | [kreakarting.ro/tarife](https://www.kreakarting.ro/tarife.html) | Priced per 5-minute block: 25 lei / 5 min for a single kart, 30 lei / 5 min for a racing kart, so 10 min = 50 lei. Package: 20 min for 80 lei. Str. Rampei 11, 0747 056 701. *(looked up 21 Oct)* |

## Found, but not seeded (no current price or address)
- **Karting Isac**, Str. Ioan Slavici 71, Timișoara: the only price found is 25 lei / 10 min from a [2011 article](https://www.opiniatimisoarei.ro/kartingul-hobby-pentru-adulti-sport-de-performanta-pentru-copii/14/05/2011). Phone 0256 221 875.
- **VMax Electric Indoor Karting Timișoara** ([vmaxtimisoara.ro](https://vmaxtimisoara.ro/preturi/)): about 80–90 lei / 8 min, but no address in the results.
- **KiKi Karting Constanța**: no price found.
- **Municipal electric track, Parcul Nicolae Romanescu, Craiova**: 2022–2023 reports say 50–55 lei / 5 min ([CraiovaForum](https://www.craiovaforum.ro/stiri/actualitate/pista-de-karting-electric-de-la-craiova-a-fost-inaugurata-tarife-reduse-pentru-studenti-si-elevi.html)). It may be closed.

## How prices stay current later
With the real backend, each track gets a `PriceProvider`. It is either *scrape*, reading the price page on a daily schedule, or *manual*, where an admin types the price. The app always shows when the price was last updated. A price an admin has confirmed becomes `verified: true`, and the "to verify" chip disappears.
