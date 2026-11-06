# Testarea aplicației reale (pas cu pas)

Pentru testele de mai jos îți trebuie **2 conturi**:
- **A:** contul tău de Founder, deschis în Chrome normal;
- **B:** un al doilea cont (alt email), deschis într-o fereastră **Incognito**, cu **Cmd + Shift + N**.

## 0. Pregătire (o singură dată)
1. GitHub Desktop: **Fetch origin**, apoi **Pull origin**.
2. Terminal: `npm install`
3. Terminal: `npx supabase db push`. Răspunzi **Y**. Se aplică 7 migrări noi și nu se șterge nimic.
4. Terminal: `npm run web:real`, apoi deschizi **http://localhost:8081**.
5. Opțional, ca rezultatele să devină finale singure după 24 h: Supabase → **Database → Extensions** → pornești **pg_cron**, apoi rulezi din nou `npx supabase db push`. Fără pg_cron, rezultatele devin finale oricum, prima dată când cineva le deschide sau deschide clasamentul.

## 1. Site-ul (fără cont)
Deschide **localhost:8081** în Incognito.

| Ce verifici | Ce trebuie să vezi |
|---|---|
| Prima pagină | JOIN THE RACE și bannerul de cookies jos |
| „Refuz toate” | Bannerul dispare și nu mai apare la reîncărcare |
| „Setări cookie” (jos pe pagină) | Panoul cu categoriile. Statisticile sunt oprite. |
| Formularul waitlist | „Ești pe listă!”. Apare în Supabase → Table Editor → `launch_signups`. |
| Același email din nou | „Ești deja înscris” |
| Butoanele RO/EN și ☀/☾ din meniu | Se schimbă limba și tema |
| HOME | Te duce la crearea contului |

## 2. Cont și profil
| Ce verifici | Ce trebuie să vezi |
|---|---|
| Contul B: înregistrare cu email | Primești emailul de confirmare. Completezi profilul. |
| Contul A: profil | Veteran, Founder Racer, 600 km, butonul **Analytics** |
| Contul B: profil | Rookie, 0 km, fără Analytics |

## 3. Sesiuni și lobby (pasul 1)
| Cine | Ce faci | Ce trebuie să vezi |
|---|---|---|
| A | **Creează**: VMax Romexpo, mâine, 4 piloți | Prețul „120 RON, plătești la pistă”, apoi lobby-ul cu tine înăuntru |
| A | Încearcă o oră peste mai puțin de 4 ore | Eroare: „cel puțin 4 ore” |
| B | **Sesiuni** → deschide sesiunea lui A | „Rezervă locul” |
| B | **Rezervă locul** | „Loc rezervat! Plătești la pistă.”, „Ești înscris” și **„Codul tău KartUP”**, de exemplu KUP-4821 |
| A (organizator) | Lista de piloți din lobby | Lângă fiecare pilot, codul lui. B vede doar codul lui. |
| A | Lasă lobby-ul deschis | B apare **singur**, fără să reîncarci pagina |
| B | **Renunț la loc** | Locul se eliberează. La A scade numărul de piloți. |
| B | Rezervă din nou | Merge |
| A | Scoate-l pe B din lobby | B nu mai e în listă |
| A | **Anulează sesiunea** (pe o sesiune de test) | Banner roșu „Anulată” |

## 4. Chat (pasul 2)
| Cine | Ce faci | Ce trebuie să vezi |
|---|---|---|
| A și B, în același lobby | Scrieți mesaje | Apar **live** la amândoi |
| — | Când B intră sau iese | În chat apare „B s-a alăturat” / „B a plecat” |
| Un al treilea cont, care nu e în lobby | Deschide lobby-ul | „Intră în lobby ca să scrii.” și niciun mesaj vizibil |
| B | Apasă pe un mesaj de la A → **Raportează mesajul** | Raportul apare în Supabase → `reports` |
| B | **Blochează** pe A | Mesajele lui A dispar doar pentru B |
| B | Scrie 11 mesaje foarte repede | „Prea multe mesaje deodată” |

## 5. Rezultate (pasul 3)
Rezultatele se pot introduce doar **după ora de start**. Pentru test, creează o sesiune și mută-i ora în trecut din Supabase → **SQL Editor**:
```
update public.sessions set starts_at = now() - interval '1 hour'
where id = (select id from public.sessions order by created_at desc limit 1);
```

| Cine | Ce faci | Ce trebuie să vezi |
|---|---|---|
| A (organizatorul) | Lobby → **Introdu rezultatele**: ordinea, turele, cel mai bun tur, poza fișei | „Rezultate trimise”, cu starea „În confirmare” |
| B | Deschide rezultatele → **Confirmă** | Starea devine **Final**. Fiecare are XP și km. |
| A și B | Profil | km, XP, curse și victorii crescute. La B apare pista nouă. |
| A și B | Profil → **Istoric curse** | Cursa apare cu XP-ul ei |
| Pe altă sesiune, B | **Contestă** | Starea devine „Contestat” |
| A | Profil → ⚙️ → **Instrumente administrator** → **Rezultate contestate** | Contestația, cu motivul. **Aprobă** dă XP-ul. |
| — | Sesiune **Casual** | Rezultatele se salvează în istoric, dar fără XP și fără km |

## 6. Clasament (pasul 4)
| Ce verifici | Ce trebuie să vezi |
|---|---|
| Tab **Clasament → Global** | Tu sus (600 km din istoric), apoi B |
| **Oraș / Pistă / Sezon** | Doar cursele de acolo. Sezonul e luna curentă. |

## 7. Analytics (contul A)
Profil → **Analytics**:
- jos, la **Raport piste**: luna curentă, piloții aduși pe fiecare pistă (doar din sesiunile care au avut loc), iar **Descarcă lista (CSV)** se deschide în Excel cu pista, data, pilotul, codul și starea;
- vizitatori și înscrieri pe waitlist;
- **sesiuni karting active**, acum cu date reale;
- încasările rămân „—” până pornim plățile.

## 8. Panou pistă (pentru recepția VMax)
1. Fă-ți un cont de test pentru „recepție” (de exemplu receptie.test@gmail.com) și completează profilul.
2. În Supabase → SQL Editor rulezi:
   ```
   select public.add_track_staff('receptie.test@gmail.com', 'vmax-romexpo');
   ```
3. Intră cu contul ăla: în Profil apare **Panou pistă**.

| Ce verifici | Ce trebuie să vezi |
|---|---|
| Recepție → Azi / Mâine | Sesiunile VMax Romexpo cu piloții și codurile lor |
| Căutare „KUP-…” sau un nume | Doar pilotul căutat |
| **A sosit** (de la 2 h înainte de start până la 6 h după) | Bifă verde „A sosit” |
| Statistici | Piloți aduși, clienți noi, bani aduși pistei, orele slabe, câți au venit, rezervări viitoare |
| Descarcă lista lunii | CSV cu pista, data, pilotul, codul și „a sosit” |
| Contul de recepție, la altă pistă | Nu are acces |

Tu, ca Founder, vezi panoul pentru toate pistele.

## Ce NU există încă în aplicația reală (e normal)
- Plata în aplicație. Acum e „plătești la pistă”, fără comision.
- Check-in la pistă și penalizări pentru neprezentare.
- Notificări push.
- Rezultate raportate de pilot (self-report).

Dacă ceva nu arată ca în tabel, fă o poză și trimite-o, cu numărul secțiunii (de exemplu „3, rândul 4”).
