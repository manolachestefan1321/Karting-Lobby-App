# KartUP – ce mai avem de făcut, în ordinea importanței

Stare la 7 nov. 2026: ~65% din aplicația gata de lansat. Site-ul, waitlist-ul, conturile, emailurile
și baza de date sunt live pe kartup.ro. Lipsesc mai ales partea de telefon și testul cu oameni reali.

Legendă: 👤 faci tu · 🤖 fac eu · 👥 împreună · ⏱ durata aproximativă

---

## 🔴 1. Obligatoriu înainte de orice lansare

- [ ] **1. Test real cu 5–10 prieteni pe kartup.ro** 👥 ⏱ 1 seară
      Fac cont → creează o sesiune la VMax → alții rezervă loc (primesc cod KUP) → chat → host-ul pune rezultatele
      → ceilalți confirmă → XP, rang și clasament se actualizează. Notează tot ce e ciudat sau nu merge.
      Ghid pas cu pas: `docs/TEST-REAL-APP.md`. Trimite-mi capturi la orice problemă.
- [ ] **2. Datele firmei** 👤 ⏱ 10 min (+ cât durează PFA/SRL)
      În `config/brand.ts`: email de suport real, numele PFA/SRL, adresa. Fără ele nu putem trimite la Apple
      și nu poți factura pistele.
- [ ] **3. `support@kartup.ro` care primește emailuri** 👥 ⏱ 30 min
      Necesar pentru App Store, politica de confidențialitate și ca oamenii să-ți poată scrie.
      Tot atunci: poza de profil KartUP la expeditorul emailurilor (cont Google pe adresa de trimitere).
- [ ] **4. Textele legale verificate de un avocat** 👤 ⏱ câteva zile
      Termeni + politica de confidențialitate (sunt șabloane bune, dar nu verificate juridic).

## 🟠 2. Aplicația pe telefon (după ce Apple îți aprobă contul)

- [ ] **5. Primul build pe iPhone prin TestFlight** 👥 ⏱ 1–2 ore
      Plus APK pentru Android (merge și fără cont plătit).
- [ ] **6. Notificări push pe telefon** 🤖 ⏱ 1 zi
      „S-a umplut sesiunea”, „mesaj nou în chat”, „rezultate postate”. Fără ele oamenii nu revin în aplicație.
- [ ] **7. Login cu Apple** 👥 ⏱ 30 min — obligatoriu pentru App Store când există Google.
- [ ] **8. Login cu Facebook** 👥 ⏱ 30 min
- [ ] **9. Trimitere la Apple și Google Play** 👥 ⏱ 2 ore + 1–3 zile review
      Ghid: `docs/APP-STORE-REVIEW.md` (cont de test pentru Apple, capturi, App Privacy).

## 🟡 3. Siguranță și creștere

- [ ] **10. Sentry (vezi erorile utilizatorilor)** 🤖 ⏱ 1 oră + contul tău Sentry gratuit
- [ ] **11. Testul de încărcare pe proiectul real** 👥 ⏱ 30 min
      `npm run load:test` la 100 / 200 oameni (vezi `docs/SCALE.md`). Înainte de evenimentul de lansare: Supabase Pro.
- [ ] **12. Bing Webmaster Tools** 👤 ⏱ 2 min — „Import from Google Search Console”.
- [ ] **13. Profilurile sociale** 👤 — Instagram/TikTok cu link spre kartup.ro, apoi îmi trimiți linkurile
      (le leg de site pentru Google).
- [ ] **14. Parteneriatul VMax** 👤 — prezentarea e gata; după acord: cont de recepție în Panoul pistei.
- [ ] **15. Anunțul pentru waitlist** 👥 — emailul cu data evenimentului, trimis prin Resend.

## ⚪ 4. După lansare

- [ ] Logo-ul final (casca) pe site, aplicație și emailuri, peste tot odată.
- [ ] Plăți în aplicație (Stripe), dacă vrei să încasezi direct.
- [ ] Check-in la pistă cu locația, rezultate „self-report”.
- [ ] Resend plătit când treci de 100 emailuri pe zi.
- [ ] BIMI (logo oficial în Gmail/Apple Mail) după ce logo-ul e marcă înregistrată.

---

### De urmărit peste 2–3 zile
- Search Console → **Sitemapuri**: statusul trebuie să devină „Reușită”.
- Search Console → **Pagini**: kartup.ro și kartup.ro/en/ apar ca indexate.
