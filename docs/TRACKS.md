# KartUP tracks: sources and what to verify

KartUP works with **6 tracks**: the five VMax venues (București Romexpo and Titan, Cluj, Brașov, Timișoara) and AMC Kart Tunari. The same 6 are in the demo and in the real database (`supabase/seed.sql`). Prices were looked up in **October 2026** from the tracks' websites and public listings. Every price is stored with `verified: false`, so the app shows **"Price to verify with the track"** with a link to the source.

The data lives in `apps/mobile/src/data/mock/tracks.ts`. The same list will seed the real database.

**Before launch, for each track:** call or check the website, then confirm or correct the price (adult, standard kart, one session, non-member), the session length, the maximum karts on track, the opening hours and the exact address. **Also check the map coordinates**: they are approximate and check-in depends on them (300 m radius). Then set `verified: true`.

| Track | City | Price used | Session | Source | Notes / doubts |
|---|---|---|---|---|---|
| AMC Kart | București (Tunari, Ilfov) | **100 lei** | 10 min | [amckart.ro/pricing](https://www.amckart.ro/pricing/) | 6.5 CP kart, non-member. 13 CP kart = 120 lei. Members pay 10 lei less. Balaclava 15 lei. Older listings show 65–85 lei. Phone 0741 100 700. |
| VMax Electric Indoor Karting Romexpo | București (Bd. Mărăști 65–67, Pavilion C4–C5) | **120 lei** | 10 min? | [vmaxromexpo.ro packages](https://vmaxromexpo.ro/categorie-produs/pachete-sesiuni/) | 1-session online package, balaclava included. The events page also shows 50 lei (Mon–Fri) / 70 lei (weekend) per *extra* session. Reviews mention a 10-min session including a 2-min briefing. |
| VMax Karting Titan | București (Bd. 1 Decembrie 1918 nr. 1J, Sector 3) | **100 lei** | 10 min? | [vmaxtitan.ro shop](https://vmaxtitan.ro/en/shop/) · [prices](https://vmaxtitan.ro/en/preturi/) | 1-session package bought online, balaclava included (3 sessions = 190 lei). The price page lists 70–90 lei per adult session, but it's unclear which column is members. Mini Grand Prix 10 min = 90–120 lei. Electric karts with boost. Phone 0771 240 237 (from an older listing). *(looked up 21 Oct)* |
| VMax Karting Cluj | Cluj-Napoca (Bd. Muncii 14) | **80 lei** | 8 min | [vmaxcluj.ro/preturi](https://vmaxcluj.ro/en/preturi/) | Weekend price; weekdays 70 lei, members 10 lei less (column labels unclear). **Address doubt:** other listings give Str. Fabricii de Zahăr 165 (same building, side street?). 13 karts, 500 m. Phone +40 771 588 344. |
| VMax Karting Brașov | Brașov (Str. Henri Coandă nr. 2, Hala H14, Coresi) | **90 lei** | 8 min | [vmaxbrasov.ro/preturi](https://vmaxbrasov.ro/en/preturi/) | Non-member; members 80 lei on weekdays. 13 karts. Track 600 m (events page says 650 m). Phone +40 774 959 913. |
| VMax Karting Timișoara | Timișoara (Calea Stan Vidrighin 5) | **90 lei** | 8 min | [vmaxtimisoara.ro/preturi](https://vmaxtimisoara.ro/preturi/) | Non-member; members 80 lei on weekdays. 13 karts. **Track length doubt:** 500 or 600 m. Phone +40 772 232 034. |

**Coordinates for the three new VMax venues are rough estimates** (about 0.5–1.5 km): check them on Google Maps before launch.

Other tracks (Tomis Kart, T&T Dej, Green Kart, Red Motor, Prejmer, Masterkart, Drift Craiova, Krea, Iași) were removed from the app. If a database was already seeded with them, the new seed hides them (`is_active = false`) instead of deleting them.

## How prices stay current later
With the real backend, each track gets a `PriceProvider`. It is either *scrape*, reading the price page on a daily schedule, or *manual*, where an admin types the price. The app always shows when the price was last updated. A price an admin has confirmed becomes `verified: true`, and the "to verify" chip disappears.
