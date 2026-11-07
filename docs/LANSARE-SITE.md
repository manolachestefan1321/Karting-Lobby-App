# Lansarea site-ului pe kartup.ro: pas cu pas

Bifează pe rând. Unde scrie **„scrie-mi”**, te oprești și îmi trimiți mesajul.

---

## Varianta de pe TELEFON (fără laptop, recomandată)

Vercel construiește site-ul singur din GitHub. Bonus: la fiecare modificare pe care o urc pe GitHub, site-ul se actualizează automat.
Înlocuiește Pașii 0, 1 și 2.1 de mai jos; Pașii 2.2, 3, 4 și 5 rămân la fel.

1. Pe telefon, în browser: **vercel.com** → **Log in with GitHub** (contul `manolachestefan1321`).
2. **Add New…** → **Project** → la „Import Git Repository” alegi **karting-lobby-app** → **Import**.
   Dacă nu apare: **Adjust GitHub App Permissions** → dai acces la repository → revii.
3. Pe ecranul de configurare:
   - **Project Name**: `kartup`
   - **Framework Preset**: `Other` · **Root Directory**: lași `./` · la **Build and Output Settings** nu schimbi nimic (le ia din `vercel.json`).
   - **Environment Variables** → adaugi, una câte una (valorile le iei din Supabase → **Project Settings** → **API**):
     - `EXPO_PUBLIC_SUPABASE_URL` = Project URL
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = cheia **anon / publishable** (NICIODATĂ `service_role`)
     - `EXPO_PUBLIC_DATA_SOURCE` = `supabase`
     - `EXPO_PUBLIC_SOCIAL_LOGINS` = `google`
4. **Deploy**. Durează 3–6 minute. La final apasă pe imaginea site-ului → se deschide `kartup-....vercel.app`.
   👉 Dacă apare „Build Failed”, **scrie-mi** – mă uit eu în log.
5. În proiect → **Settings** → **Domains** → **Add** → `kartup.ro` → **Add** (alege varianta recomandată, cu `www` care redirecționează spre `kartup.ro`).
   Verifică: `www.kartup.ro` → **Redirect to `kartup.ro` (308)**; `kartup.ro` fără redirect.
6. Continuă cu **Pasul 2.3** (notezi nameserverele), apoi **Pasul 3** (Romarg, merge din browserul telefonului), **Pasul 4** și **Pasul 5**.

---

## Pasul 0 – Pregătire (o singură dată)

1. Deschide **GitHub Desktop** → **Fetch origin** → **Pull origin**.
2. Deschide **Terminal** în folderul proiectului (`karting-lobby-app`).
3. Rulează:
   ```
   npm install
   ```
4. Verifică în `apps/mobile/.env` că ai completate:
   - `EXPO_PUBLIC_SUPABASE_URL=...`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`
   - `EXPO_PUBLIC_SOCIAL_LOGINS=google`  ← adaugă rândul dacă nu există (activează butonul Google)

---

## Pasul 1 – Site-ul pe Vercel

1. Te conectezi la Vercel (se deschide browserul):
   ```
   npx vercel@latest login
   ```
2. Legi proiectul:
   ```
   npx vercel@latest link
   ```
   Răspunsuri: **Set up?** → `Y` · **scope** → contul tău · **Link to existing project?** → `N` ·
   **name** → `kartup` · **directory** → apasă Enter (`./`) · **modify settings?** → `N`
3. Construiești și urci site-ul (la fiecare actualizare repeți doar aceste 3 comenzi):
   ```
   npx vercel@latest pull --yes --environment=production
   npx vercel@latest build --prod
   npx vercel@latest deploy --prebuilt --prod
   ```
   La final primești un link `https://kartup-....vercel.app` → deschide-l și verifică că merge site-ul.

---

## Pasul 2 – Domeniile în Vercel

1. Rulează:
   ```
   npx vercel@latest domains add kartup.ro
   npx vercel@latest domains add www.kartup.ro
   ```
2. Pe **vercel.com** → proiectul **kartup** → **Settings** → **Domains**:
   - la `www.kartup.ro` → **Edit** → **Redirect to** → `kartup.ro` → **308** → **Save**;
   - `kartup.ro` rămâne fără redirect (e domeniul principal).
3. Tot acolo, la `kartup.ro`, notează **nameserverele** afișate de Vercel. De obicei sunt:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```

---

## Pasul 3 – Nameserverele în Romarg

1. Intră în **panoul de client Romarg** → domeniul **kartup.ro** → **Servere DNS / Nameservere**.
2. **Șterge toate patru**: `ns1.romarg.com`, `ns2.romarg.com`, `ns3.romarg.com`, `ns4.romarg.com`.
3. Pune în locul lor cele două de la Vercel (Pasul 2.3) → **Salvează**.
4. Nu lăsa niciun `romarg.com` amestecat cu cele noi.

👉 **Scrie-mi „gata nameservere”** – verific eu propagarea DNS, redirectul www și HTTPS-ul.
(Propagarea durează de obicei sub o oră, uneori până la 24–48 de ore.)

---

## Pasul 4 – Supabase (după ce merge kartup.ro)

1. **supabase.com** → proiectul tău → **Authentication** → **URL Configuration**.
2. **Site URL**: `https://kartup.ro`
3. **Redirect URLs** → **Add URL**: `https://kartup.ro/**` → **Save**.

Fără asta, emailurile de confirmare a contului pot trimite spre `localhost`.

---

## Pasul 5 – Verifici tu, în 2 minute

Pe telefon, pe `https://kartup.ro`:
- [ ] apare pagina „Join the race”;
- [ ] sus în stânga: **Intră în cont** / **Cont nou** (sau **Deschide aplicația** dacă ești logat);
- [ ] te înscrii pe waitlist cu un email de test → apare „Ești pe listă!”;
- [ ] **Cont nou** → **Continuă cu Google** funcționează;
- [ ] `www.kartup.ro` te duce pe `kartup.ro`, cu lacătul (HTTPS) în bara de adresă.

👉 **Scrie-mi ce a mers și ce nu.**

---

## Urmează (când zici)

1. **Facebook login** – creăm aplicația pe developers.facebook.com și o legăm de Supabase (~30 min).
2. **Apple login** – după ce îți aprobă Apple contul de developer.
3. **Google Search Console + Bing** – vezi `docs/SEO.md`, partea „În prima zi după ce site-ul e online”.
