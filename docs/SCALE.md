# KartUP cu 100 / 200 / 500 de oameni deodată

„Deodată” înseamnă oameni cu aplicația **deschisă în același moment** (de ex. seara evenimentului),
nu oameni înscriși. 500 de înscriși pe waitlist ≠ 500 conectați simultan.

## Ce am măsurat și optimizat (site-ul)

Telefon simulat, procesor de 4× mai lent, build-ul real (`npm run site:build`):

| | 4G slab (1,6 Mbps) | 4G normal (10 Mbps) |
|---|---|---|
| Apare conținutul (înainte) | 9,4 s | – |
| **Apare conținutul (acum)** | **0,3 s** | **0,2 s** |
| Site-ul complet funcțional | ~6,1 s (înainte 9,5 s) | **~2,2 s** |
| Scroll | 60 fps, 0 cadre pierdute | 60 fps |
| Elemente care sar (CLS) | 0,064 (bun: sub 0,1) | 0 |

Ce s-a schimbat:
- **Primul ecran apare instant**: e scris direct în pagină (HTML), nu mai așteaptă codul aplicației.
- **Cod mai mic**: polyfill-urile pentru telefoane nu mai ajung pe site, iconițele se încarcă doar din setul folosit,
  iar build-ul de site elimină codul nefolosit. JavaScript: 1,3 MB → 0,78 MB (comprimat).
- **Fonturile** nu mai fac textul să sară când se încarcă.
- **Fonturile pornesc odată cu pagina** (preîncărcate din `public/fonts`), nu după ce pornește aplicația.
- **zod fără cele ~45 de limbi** pe care nu le folosim (setat în `metro.config.js`).
- **Butonul „Lock in my spot” merge din prima secundă**: dacă e apăsat înainte să se încarce tot, pagina se deschide direct la formular.
- **Cache corect** (`apps/mobile/public/_headers`): la a doua vizită telefonul nu mai descarcă nimic din nou.

### Unde pui site-ul
`npm run site:build` creează folderul `apps/mobile/dist`. Îl urci pe **Netlify** sau **Cloudflare Pages**
(gratuite, servere în toată lumea). Fișierele `_headers` și `_redirects` sunt deja incluse.
Un site static pe CDN duce fără probleme mii de vizitatori simultan: nu are server propriu care să cadă.

### Pagina de waitlist e acum o pagină separată, ultra-ușoară

`kartup.ro/` și `/join` nu mai încarcă aplicația: sunt o pagină simplă (HTML + CSS + puțin JavaScript),
construită de `scripts/build-site.ts` din fișierele din `site/`. Arată și se comportă la fel ca înainte
(aceleași texte, ranguri, animații, formular, banner de cookies, statistici, același tabel în Supabase).

| | Pagina din aplicație | Pagina nouă |
|---|---|---|
| Mărime (comprimat) | ~740 KB | **17 KB** (+ ~53 KB animații, după) |
| Butoane și formular gata (4G normal) | 2,2 s | **0,1 s** |
| Butoane și formular gata (4G slab) | 6,1 s | **0,24 s** |
| Animațiile pornesc (4G slab) | 6,1 s | **1,4 s** |

Ce trebuie știut:
- Textele vin din `apps/mobile/src/i18n` (en.ts / ro.ts), rangurile din `config/progression.ts`: schimbi acolo, apoi `npm run site:build`.
- Aspectul paginii: `site/landing.css`; comportamentul: `site/landing.js`; animațiile: `site/motion.js`.
- Un test (`siteParity.test.ts`) verifică la fiecare rulare că formularul acceptă și refuză exact ce acceptă aplicația
  și că fiecare pagină a aplicației e servită corect pe site.
- `npm run site:preview` arată site-ul construit pe calculatorul tău (http://localhost:8080).
- `src/app/join.tsx` (versiunea din aplicație) rămâne pentru demo și dezvoltare (`npm run web`).

## Aplicația: ce am reparat în cod

Problema principală era la noi, nu la Supabase: fiecare schimbare (un mesaj în chat, o rezervare) făcea ca
**toți** utilizatorii conectați să reîncarce aproape toate listele. La 500 de oameni, un singur mesaj = mii de cereri.

Acum:
- fiecare schimbare reîncarcă doar ecranul pe care îl privește (o sesiune, notificările tale etc.);
- mai multe schimbări într-o clipă = o singură reîncărcare;
- lista comună de sesiuni se reîncarcă cu o mică întârziere aleatoare, ca 500 de telefoane să nu lovească baza de date în aceeași secundă;
- mesajele de chat ajung doar la cei care au deschisă acea sesiune; notificările doar la destinatar (filtrate pe server).

## Ce trebuie să faci tu înainte de un eveniment mare

1. **Email propriu (SMTP), obligatoriu chiar și pentru 20 de oameni.** Emailul inclus în Supabase trimite
   doar câteva emailuri pe oră și **doar către membrii echipei tale**, deci oamenii noi nu primesc confirmarea contului.
   Soluția: Resend (gratuit: 3.000 emailuri pe lună, maximum 100 pe zi) → Supabase → Authentication → SMTP. Apoi la
   Authentication → Rate Limits crești limita de emailuri.
2. **Planul Supabase:**
   - **Free**: maximum **200** de oameni conectați live în același timp. Proiectul se pune pe pauză după o săptămână fără activitate.
   - **Pro (25 $/lună)**: **500** incluși, apoi 10 $ la fiecare 1.000 în plus. Pentru 500 deodată ai nevoie de Pro.
   - Treci pe Pro cu câteva zile înainte de eveniment, nu în ziua lui.
3. **Testul de încărcare** (vezi mai jos) la 100, 200 și 500, pe proiectul tău, înainte de eveniment.
4. **În seara evenimentului**: Supabase → Reports (Realtime, API, Database) deschis pe laptop.

## Testul de încărcare

Simulează N oameni cu aplicația deschisă: conexiune live, lista de sesiuni la 15–30 s, clasamentul la ~1 min.
Nu creează și nu șterge nimic (în afară de mesajele de chat, dacă le pornești).

```
LOADTEST_EMAIL=contul-de-test@... LOADTEST_PASSWORD=... USERS=100 DURATION=180 npm run load:test
LOADTEST_EMAIL=... LOADTEST_PASSWORD=... USERS=200 DURATION=180 npm run load:test
LOADTEST_EMAIL=... LOADTEST_PASSWORD=... USERS=500 DURATION=300 npm run load:test
```
Opțional, cu chat: adaugi `LOADTEST_SESSION=<id-ul unei sesiuni în care contul de test are loc>`.

Cum citești rezultatul: **errors 0**, **refused 0**, **p95 sub 800 ms** → `PASSED`.
Pe planul Free, la 500 vei vedea conexiuni refuzate peste 200: e limita planului, nu o eroare de cod.
Trimite-mi rezultatul dacă apare altceva.
