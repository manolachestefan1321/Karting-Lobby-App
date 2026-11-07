# KartUP pe Google și în asistenții AI (fără reclame)

Nimeni nu poate garanta locul 1 pe Google sau că ChatGPT / Claude / Gemini te recomandă.
Ce putem face: site-ul să fie perfect din punct de vedere tehnic (gata, vezi mai jos) și să existe cât mai multe
locuri credibile care vorbesc despre KartUP (asta e treaba ta, pașii sunt mai jos). Google și asistenții AI
recomandă ce găsesc menționat des, în surse independente, cu informații clare.

## Ce e gata în site (tehnic)

- **O pagină pe limbă**: `kartup.ro/` în română (principala) și `kartup.ro/en/` în engleză, cu legături între ele
  (`hreflang`). Înainte, Google vedea probabil pagina în engleză (limba robotului) și pierdeam căutările românești.
- **Titlu și descriere** pentru Google în fiecare limbă (sub 60 / 155 de caractere), din `src/i18n` (`seo.title`, `seo.description`).
- **Întrebări frecvente** vizibile pe pagină + aceleași în format structurat (`FAQPage`): exact ce citesc Google și
  asistenții AI când cineva întreabă „ce aplicație de karting e în București?”. Conțin cuvintele căutate:
  karting București, VMax Romexpo, VMax Titan, AMC Kart, gratuit, ranguri, începători.
- **Date structurate** despre firmă și site (`Organization`, `WebSite`).
- **`/llms.txt`**: un rezumat scurt, în text simplu, pentru asistenții AI (standard propus; nu strică, poate ajuta).
- **`sitemap.xml`** cu cele două limbi, **`robots.txt`** care permite tot ce e public (inclusiv roboții AI).
- **Viteză**: pagina are 17 KB și merge în 0,1–0,25 s. Viteza pe telefon contează în clasamentul Google.
- `/join` (adresa veche) arată aceeași pagină, dar îi spune lui Google că adresa principală e `/` (fără dubluri).

Textele întrebărilor frecvente le poți schimba în `apps/mobile/src/i18n/ro.ts` și `en.ts` (`join.faq`), apoi `npm run site:build`.
**Țin-le adevărate**: dacă se schimbă ceva (preț, piste, lansare), le actualizăm.

## Ce faci tu, în ordine

### 1. În prima zi după ce site-ul e online
1. **Google Search Console** (search.google.com/search-console): „Adaugă proprietate” → **Domeniu** → `kartup.ro`.
   Verifici cu înregistrarea TXT pe care ți-o dă (o pui la firma de unde ai domeniul).
   Apoi: **Sitemaps** → `https://kartup.ro/sitemap.xml` → Trimite. **Inspectare URL** → `https://kartup.ro/` → „Solicită indexarea”; la fel pentru `/en/`.
2. **Bing Webmaster Tools** (bing.com/webmasters): „Importă din Google Search Console”. Unii asistenți AI, inclusiv ChatGPT,
   folosesc și rezultatele Bing, deci contează.
3. **Dacă pui site-ul pe Cloudflare**: în panoul domeniului, verifică setarea de blocare a roboților AI („AI Crawl Control” /
   „Block AI bots”). Dacă e pornită, ChatGPT, Claude și Perplexity nu pot citi site-ul. Las-o oprită dacă vrei să te recomande.

### 2. Același nume și aceeași descriere peste tot
Instagram, TikTok, Facebook (și mai târziu App Store / Google Play): numele **KartUP**, o descriere de o propoziție
(„KartUP – aplicația de karting din București: găsește-ți echipa, intră în lobby, urcă în ranguri”) și link spre `kartup.ro`.
Trimite-mi linkurile profilurilor: le adaug în datele structurate (`sameAs`), ca Google să știe că sunt ale tale.
Verifică și dacă mai există alte firme „KartUP” / „Kart Up”: dacă da, spune mereu „KartUP România” sau „aplicația KartUP”.

### 3. Linkuri spre site (cel mai important pentru Google)
Fiecare site serios care pune un link spre `kartup.ro` te urcă. În ordinea valorii:
- **Pistele partenere**: o pagină sau un anunț pe site-ul VMax / AMC Kart cu link spre KartUP (cere asta în parteneriat).
- **Presă locală și site-uri de evenimente din București**: evenimentul de lansare e un subiect bun (comunicat scurt + poze).
- **Bloguri și pagini auto / moto / karting**, grupuri de studenți, firme de team building.
- **Reddit (r/bucuresti, r/Romania), grupuri Facebook de karting**: postări sincere de la tine („am făcut o aplicație…”), nu spam.
Asistenții AI învață mai ales din astfel de mențiuni independente: cu cât sunt mai multe și mai clare, cu atât te recomandă mai des.

### 4. Conținut care răspunde la ce caută oamenii
Câte un articol la 2 săptămâni, pe site, de exemplu:
„Unde faci karting în București”, „Karting pentru începători: ce să știi”, „Cum organizezi o cursă de karting cu prietenii”,
„Ce înseamnă un timp bun pe tur la VMax Romexpo”. Spune-mi când vrei să adăugăm secțiunea de articole.

### 5. După lansarea aplicației
Recenzii în App Store și Google Play, profilul aplicației complet (descriere cu „karting București”), link spre site.

## La ce să te aștepți (realist)

| Căutare | Când poți apărea sus |
|---|---|
| „KartUP” / „KartUP karting” | câteva zile – 2 săptămâni după indexare |
| căutări precise („aplicație karting București”, „găsește echipă karting”) | 1–3 luni, cu linkuri și conținut |
| „karting București” (concurezi cu pistele însele) | luni, doar cu multe linkuri și articole |
| ChatGPT / Claude / Gemini te recomandă | după ce există mențiuni în presă, pe forumuri și pe site-urile pistelor |

**Cum măsori**: în Search Console vezi căutările pentru care apari și poziția. O dată pe lună, întreabă ChatGPT, Claude și
Gemini „ce aplicație de karting e în București?” și notează dacă apare KartUP.
