# KartUP pe App Store: aprobat din prima

Ce e deja făcut în aplicație și ce ai tu de făcut înainte să apeși „Submit for Review”.
Nimeni nu poate garanta 100% aprobarea, dar cu lista asta acoperi motivele pentru care Apple respinge de obicei o aplicație ca KartUP.

---

## A. Ce e deja în aplicație (nu mai ai nimic de făcut)

| Regula Apple | Ce are KartUP |
|---|---|
| 5.1.1(v) Ștergerea contului din aplicație | Setări → Șterge contul (șterge tot, inclusiv poza de profil) |
| 1.2 Conținut creat de utilizatori (chat, profiluri) | Raportează mesaj/profil, Blochează utilizator, mesajele celor blocați dispar, termeni „toleranță zero” acceptați la înscriere |
| 4.8 Sign in with Apple | Dacă pe iPhone apare Google sau Facebook, apare automat și Apple |
| 5.1.1 Confidențialitate | Politica de confidențialitate și Termenii în Setări, plus emailul de contact |
| 2.1 Fără butoane care nu merg | Notificările sunt reale (nou). În aplicația reală sunt ascunse „Adaugă cursă”, „Plăți” și mementourile, care vin mai târziu |
| 2.2 Fără demo-uri în App Store | Demo-ul nu poate fi construit ca „production” (build-ul se oprește) |
| Date de test/placeholder | Build-ul „production” se oprește dacă în `config/brand.ts` mai e un email sau o firmă de test |
| Export compliance | Declarat automat: aplicația nu folosește criptare proprie |
| iPad | Dezactivat (doar iPhone), deci nu-ți cere capturi de iPad |

---

## B. Ce faci tu, în ordinea asta

### 1. Datele firmei (obligatoriu)
În `config/brand.ts` înlocuiește:
- `supportEmail` → un email real pe care îl citești (de ex. `support@kartup.ro`)
- `legalEntity` → numele PFA-ului / SRL-ului
- `legalAddress` → adresa firmei

Apoi rulezi `npm run brand:sync` (actualizează și textele legale). Fără asta, build-ul de App Store se oprește intenționat.

### 2. Site-ul online
Apple cere două linkuri publice:
- **Privacy Policy URL:** `https://kartup.ro/legal/privacy`
- **Support URL:** `https://kartup.ro`

Deci domeniul și site-ul trebuie să fie publicate înainte de trimitere.

### 3. Supabase
```
npx supabase db push
npx supabase functions deploy delete-account
```
Apoi Authentication → Sign In / Providers → **Apple** → Enable. La „Client IDs” pui `com.kartup.app`.
Pentru login-ul nativ de pe iPhone e suficient; secretul e necesar doar pentru login cu Apple pe site.

În `.env` și în EAS pune `EXPO_PUBLIC_SOCIAL_LOGINS=apple,google`.

### 4. Contul de test pentru Apple (cel mai des motiv de respingere!)
Recenzentul Apple trebuie să poată intra și să vadă aplicația plină:
1. Fă un cont nou cu email (de ex. `apple-review@kartup.ro`), confirmă emailul și completează profilul.
2. De pe contul tău creează **2–3 sesiuni la VMax în zilele următoare**, ca lista să nu fie goală.
3. Cât timp aplicația e în review (1–3 zile), ține sesiuni în viitor; dacă expiră, mai creezi.

### 5. App Store Connect
- **Categorie:** Sports. **Secundară:** Social Networking.
- **Age rating:** la întrebări răspunde „Yes” la conținut generat de utilizatori și la chat.
- **Capturi de ecran:** iPhone 6.9" (1320 × 2868), minim 3. Ți le fac eu din aplicație.
- **App Privacy:** completezi ca în secțiunea C.
- **App Review Information:** emailul și parola contului de test, plus textul din secțiunea D.

### 6. Demo-ul
Aplicația **KartUP Demo** merge doar în TestFlight intern (tu și echipa ta, fără review).
**Nu apăsa niciodată „Submit for Review” pe demo:** Apple respinge demo-urile (regula 2.2).

---

## C. App Privacy (ce declari la Apple)

Tracking: **No** (aplicația nu urmărește utilizatorii în alte aplicații sau site-uri).

| Tip de date | Colectat | Legat de persoană | Pentru ce |
|---|---|---|---|
| Name | Da | Da | App Functionality |
| Email Address | Da | Da | App Functionality |
| Photos | Da (poză profil, foaie de timpi) | Da | App Functionality |
| Other User Content (chat) | Da | Da | App Functionality |
| User ID | Da | Da | App Functionality |
| Other Data (data nașterii, oraș, experiență) | Da | Da | App Functionality |
| Location, Contacts, Health, Financial, Browsing, Diagnostics | Nu | – | – |

Dacă adăugăm mai târziu plăți (Stripe), Sentry sau push, actualizăm tabelul.

---

## D. Textul pentru „Notes” la App Review (în engleză, cum îl cer ei)

```
KartUP helps karting drivers in Bucharest find people to race with at real karting tracks.
Drivers join a session (lobby) at a track, chat with the group, then race at the track.
Seats are paid at the track's front desk, not in the app (no digital goods are sold).

Demo account:
  Email: apple-review@kartup.ro
  Password: <parola>

How to test:
  1. Sessions tab → open any upcoming session → "Reserve my seat". You get a booking code.
  2. Open the lobby chat and send a message.
  3. Tap a driver → Report / Block (user-generated content moderation).
  4. Profile → Settings → Delete account.

Content moderation: users accept zero-tolerance community terms at sign-up, can report and
block users and messages, and reports are reviewed by our team within 24 hours.
```

---

## E. După trimitere
- Verifică zilnic rapoartele în Supabase (Table Editor → `reports`) și răspunde în 24 de ore. Apple poate verifica asta.
- Dacă totuși vine un mesaj de la Apple, nu retrimite direct: trimite-mi mesajul și reparăm exact ce cer.
