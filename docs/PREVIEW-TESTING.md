# KartUP web preview: what to click

Start with `npm run web` and open **http://localhost:8081** in Chrome. The phone is on the left and the **debug panel** is on the right.

- **Time** jumps the app's clock forward or back. Reminders, cancellation rules, check-in, no-shows and the 24-hour results window all follow this clock.
- **Signed in as** switches between demo users. **Simulated GPS** puts you at the track or 5 km away.
- **Session** picks a session, opens its lobby in the app, jumps the clock relative to its start, and makes the other (fake) drivers do things.
- **Email inbox** shows the sign-up and password-reset emails. "Click the link in the app" opens the link inside the phone.
- **Reset demo data** starts over. Do this between scenarios if things get confusing. Moving the clock *back* does not undo what already happened, just like in real life.

The **tracks and prices are real** (looked up on the tracks' websites on 20 Oct 2026) and marked **"to verify"**: see [TRACKS.md](TRACKS.md). People and sessions are fictional. Session times are generated relative to when the demo data was created. The first time you open the preview, they match the scenarios below.

---

## 0. Brand, splash and language
1. Click **↻ Replay splash**. You'll see the KartUP wordmark with "Find your team & race." on the dark splash, which then fades into the welcome screen.
2. Switch **iPhone / Android** at the top to check both screen sizes.
3. Later, in **Profile → ⚙ Settings**, switch the language to **Română** and the appearance to **Luminos** (light). The slogan stays in English.

## 1. Sign up, verify email, onboarding
1. Welcome → **Sign up with email**. Enter any email (e.g. `me@test.ro`) and a password like `test1234`, tick the terms, and tap **Sign up**.
2. You see "Check your email". In the debug panel, **Email inbox** now has a "Confirm your KartUP account" email. Click **Open** to see the branded email, then **Click the link in the app →**.
3. You land on **Set up your driver profile**. Add a photo (optional), names, a date of birth (try one under 16 to see the age check), city, and bio, then tap **Let's race**.
4. Also try **Forgot password?** on the login screen. The reset email appears in the inbox, and its link opens "Choose a new password".
5. **Continue with Google / Apple / Facebook** are simulated: they sign you in as a fake provider user and take you to onboarding.

## 2. Log in with the test account
Use **Signed in as → Andrei Popescu** in the debug panel, or Log in → **Fill in test account** → Log in.

## 3. Find sessions
1. **Sessions** tab: change the city at the top. Every city now has at least one real track. Cities where nobody has created a session yet (e.g. Craiova, Oradea, Iași) show the empty state with a **Create a session** button.
2. Use the filter chips: date, track, level, free spots.
3. **My sessions** at the top lists Andrei's active sessions.

## 3b. Both VMax tracks
In București you'll find sessions at **VMax Electric Indoor Karting Romexpo** (hosted by Maria, and the ones used in the steps below) and at **VMax Karting Titan** (hosted by Cristian tomorrow at 20:30, and by Vlad in 3 days for Amateur rank and up). Open the Titan lobby to see its price (100 + 5 = 105 RON) and the chat about the boost button.

## 4. Join a lobby and pay (fake payment)
1. In București, open **VMax Electric Indoor Karting Romexpo · hosted by Maria Ionescu** (tomorrow).
2. You see the countdown, price (120 RON track + 5 RON fee = **125 RON**), a yellow **"Price to verify with the track"** chip with a link to where the price came from, host's note, drivers and chat preview.
3. Tap **Join & pay 125 RON**. The test payment sheet opens. Tap **Pay 125 RON**. You get a "Seat confirmed" banner and "You're in".
4. To test a declined card: on another session, change the card number to `4000 0000 0000 0002`.
5. To test the race for the last seat: debug panel → session **AMC Kart (host Radu)** (7/8 drivers) → open it in the app → tap Join & pay. **Before** tapping Pay, click **Someone joins & pays** in the panel, then tap Pay. You'll see "The last seat was taken a moment ago. Your card was NOT charged."

## 5. Cancel before the last hour (refund)
1. In the Maria lobby you just paid for, the footer shows "Free cancellation until …".
2. Tap **Cancel my seat** → confirm. You get a "Seat cancelled. 125 RON refunded." banner, and a "Refund issued" alert. **Profile → ⚙ → Payment history** shows the payment as Refunded.

## 6. Cancel inside the last hour (blocked)
1. Pay for the Maria session again.
2. Debug panel → select **VMax Electric Indoor Karting Romexpo (host Maria)** → **59 min before**.
3. The footer now says "Cancellation closed: no refunds in the last hour", and the cancel button is gone.
4. Try **61 min before**: cancelling is allowed again.

## 7. Reminder 2 hours before
Debug panel → select a session you paid for → **2 h before**. A "Race in 2 hours ⏱ … last chance to cancel with a full refund, until HH:MM" banner appears, and the same notification appears in **Alerts**.

## 8. Host tools and auto-cancel (fewer than 4 drivers)
1. Select **AMC Kart (host Andrei)**, starting in a few hours. Andrei hosts it with only 3 paid drivers. Open it in the app.
2. You see the warning "Needs at least 4 paid drivers by …".
3. Remove the unpaid driver (Ioana) with the ⓧ next to her name: removed, no refund needed. Removing a *paid* driver asks for confirmation and refunds them.
4. Click **3 h before** in the panel. The session is **cancelled automatically** and everyone is refunded ("Session cancelled" banner).
5. Reset demo data, then instead click **Someone joins & pays** before **3 h before**. With 4 paid drivers it stays on.

## 9. Check-in, no-show and ban
1. Select **VMax Electric Indoor Karting Romexpo (host Vlad)**, starting soon, where Andrei has paid. Open it in the app.
2. Click **10 min before**. The "Check-in is open" banner appears and the lobby shows **I'm at the track — check in**.
3. To test being too far away: set **Simulated GPS → 5 km away** and tap check in. You'll see "You're 5000 m from the track".
4. **No-show path:** don't check in, and click **16 min after**. You get "No-show: joining blocked" with the ban end time (**1 hour** for the 1st no-show). The lobby says "You were marked as no-show", and the debug panel shows Andrei as BANNED.
5. Try to join any other session: it's refused with "You're blocked from joining sessions until …".
6. **Profile** shows a red ban card. Tap **Appeal**, write a message and send it. Then approve or reject it under **Ban appeals (admin)** in the debug panel.
7. The ban ladder escalates: 1st = 1 h, 2nd = 24 h, 3rd = 7 days, 4th and later = 30 days. To see the 2nd step, Reset, then repeat the no-show on another session after the first ban expires (**+1 h**).
8. **Happy path:** Reset, jump to **10 min before**, check in, then **16 min after**. No ban.
9. Bogdan Rusu already has an active ban. Open his profile from any leaderboard to see how a ban shows on a public profile.

## 10. Enter results (host), km, XP and rank-up
Andrei is a **Club Racer** sitting just below **Contender** (150 km and 2,500 XP): about 149 km and 2,480–2,495 XP. Check **Profile**: two progress bars (km and XP), both almost full.
1. Select **VMax Electric Indoor Karting Romexpo (host Andrei)**, which finished 2 hours ago. Open it and tap **Enter results**.
2. Tap the drivers in finishing order. For **every** driver type the **laps** completed (e.g. `12`). The **best lap** is optional (e.g. `48.512`). You can also attach a photo of a "timing printout" (any image). Tap **Submit results**.
3. **Demo mode: results are final immediately** (no 24-hour wait), so a full-screen **RANK UP · Contender** celebration appears right away. Any finishing position works, as long as Andrei has at least 2 laps.
4. Open **View results**: every driver shows **+XP** and **km**, with the breakdown (participation, position, podium, fastest lap, personal best, new track). Check **Profile** (new badge, the bars now point to **Pro**) and **Profile → Race history**.

Want the real 24-hour confirm/dispute window? Developer menu → **Progression & admin** → switch off **Results final immediately (demo)**. Then entered results stay "waiting for confirmations" until everyone confirms or 24 hours pass, and only then give km and XP.

## 11. Confirm or dispute results (participant)
1. Select **AMC Kart (host Radu)** from yesterday. Its results were posted before the demo started and are waiting for Andrei's confirmation. Open it, then **View results**.
2. **Confirm results**: everyone has now confirmed, so the results become final (verified) and km and XP are added. If you haven't done step 10 yet, this also ranks Andrei up.
3. Or tap **Dispute**, write a reason, and the results go to admin review. Use **Admin: approve results / reject results** in the debug panel.
4. Undisputed results also become final automatically after 24 hours: reset, then jump with **+1 day**.

## 12. Leaderboards
**Rankings** tab: Global (all-time XP) / City / Track / **Season** (XP earned that month only). Each row shows the driver's permanent **rank badge**, km, sessions and wins. Seasons restart every month; ranks never go down. It updates live: finish a session in another tab and watch the XP change.

## 13. Chat, report and block
1. Open any lobby you're in → chat card → type a message.
2. Debug panel → **Someone chats** to receive a message. A banner appears if you're on another screen.
3. Tap someone else's message → **Report message** or **Block**.
4. On a public profile: **Report** / **Block**.

## 14. Create a session
1. **Create** tab. The first time, you must **Verify payout account** (simulated Stripe Connect): hosts receive the track cost.
2. Pick a city, track (shows price, kart types, session length), day, start time (track local time; slots in the next 4 hours are disabled), max drivers, minimum rank and level, and a note.
3. **Create & pay my seat** opens the new lobby with the payment sheet for your own seat.

## 15. Notifications and settings
- **Alerts** tab: all notifications, unread dots, tap to open the related screen, "Mark all read". The tab shows an unread badge.
- **Settings**: language, theme, notification switches (payments/refunds/bans can't be switched off), payment history, privacy policy and terms (in-app), About (wordmark and slogan), Log out, Delete account.

## 16. Ranks, self-reported results and the admin
**The 8 ranks** (km **and** XP both needed): Rookie 0/0 · Amateur 25 km/300 XP · Club Racer 75/1,000 · Contender 150/2,500 · Pro 300/5,000 · Apex 500/9,000 · Ace 800/15,000 · Veteran 1,200/25,000. They are set in `config/progression.ts`.

The demo has drivers in every rank: **Cristian** (Veteran), **Radu** (Ace), **Vlad** (Apex), **Maria / Mihai** (Pro), **Ana / Ștefan / Larisa** (Contender), **Andrei / Elena / Alex / Paul / Sorin** (Club Racer), **Bianca / Diana / Gabriel / Raluca** (Amateur), **Ioana / Bogdan / Teodora** (Rookie). Their history is a mix of lobby sessions and older results imported from the tracks' timing sheets at VMax Romexpo, VMax Titan and AMC Kart. You see rank badges in lobbies, on leaderboards and on profiles.

**Self-reported result (unverified):**
1. **Profile → Add a race result**. Pick a track, date, position, number of drivers, laps and (optionally) best lap. **Save**.
2. **Profile → Race history** shows it with an **Unverified · Waiting for an admin** label and **no km or XP**. Andrei also already has one waiting (VMax Titan).

**Only admins can approve it, not lobby organizers** (so friends can't farm XP for each other):
1. Developer menu → **Progression & admin** → **Sign in as admin** (Irina Vasile, `admin@kartup.test`, password `kartup123`).
2. **Profile → ⚙ Settings → Admin tools** → **Self-reported results** → **Approve** or **Reject**. Approving adds the km and XP (and can rank the driver up).
   - Shortcut: the Developer menu's **Approve (as admin)** buttons do the same without switching user.
3. Switch back to Andrei: the result is now **Verified · Self-reported**, with XP.

**Admin tools** also let you:
- mark an upcoming session as an **Official KartUP event** (XP × 1.5); one is already set up (**KartUP Cup**, VMax Romexpo, in 5 days);
- enter results for **any** session that is waiting for results (they're final immediately).

## 17. Casual vs Competitive lobbies and XP penalties
**Lobby type:** every lobby shows a badge: **Competitive** (red) or **Casual – no ranking**.
- **Create** tab → **Lobby type**: Competitive (default) or Casual.
- Demo Casual lobbies: **VMax Timișoara** (Sorin, tomorrow) and **AMC Kart** (Ana, in 6 days). A few past sessions were Casual too.
- Casual results are saved in **Race history** with a **Casual – no ranking** label: position, laps and best lap, but no XP or km, and they don't count for the season leaderboard or personal-best bonuses.
- Official KartUP events are always Competitive (turning an event official switches it).

**XP penalties** (Competitive lobbies only; **your rank never goes down**, and XP never goes below 0):
| What | XP |
|---|---|
| No-show (paid, didn't check in, host didn't confirm) | −50 |
| Cancelling a paid seat less than 2 h before the start | −25 |
| Admin decides you reported false data (self-report or dispute) | −100 |

Try them:
1. **Late leave:** join and pay Maria's VMax Romexpo lobby (tomorrow), Developer menu → pick that session → jump to **61 min before**, then **Cancel my seat**. The dialog warns about −25 XP; you're still refunded.
2. **No-show:** select **VMax Romexpo (host Vlad)** in 45 minutes and jump to **16 min after**: Andrei never checked in → ban + −50 XP.
3. **False data:** sign in as admin → Admin tools → a self-report → **False data (−100 XP)**. Or dispute Radu's AMC results and use **Admin: approve, dispute was false (−XP)** in the Developer menu.

Penalties show in **Race history** as red **XP penalty** rows, plus an alert. Bogdan already has one (a recent no-show): sign in as Bogdan to see it.

The values are in `config/progression.ts` (`PENALTIES`).

## Lap lengths to verify before launch
Distance (km) = laps × lap length, so these numbers matter. **All are marked "to verify"** in the app (the lobby shows "Lap 700 m (to verify)"). Please confirm each with the track and tell me the correct values. The track websites couldn't be opened directly, so these come from search results, news articles and listings.

| Track | Used in app | Source | Confidence / notes |
|---|---|---|---|
| AMC Kart (Tunari) | **1,240 m** | [AMC Kart Facebook](https://www.facebook.com/AMCKART/videos/10158334153981713/) · [Adevărul](https://adevarul.ro/stiri-locale/bucuresti/viteza-si-adrenalina-la-karting-1378954.html) | High: the operator says 1,240 m, CIK-FIA certified (some directories say 1,250 m) |
| VMax Romexpo | **700 m** | [vmaxromexpo.ro/evenimente](https://vmaxromexpo.ro/evenimente/) · [kart-map](https://www.kart-map.com/en/circuits/vmax-karting-romexpo) | Medium: event pages say 700 m, the English homepage says 600 m, the gift page lists 700/650/500 m layouts. **Which layout is used?** |
| VMax Titan | **600 m** | [PGKart (track builder)](https://www.pgkart.com/en/works/vmax-karting-titan/) | Medium-high: "600 linear m"; the official site page still shows "0 M" |
| VMax Karting Cluj | **500 m** | [vmaxcluj.ro/circuitul](https://vmaxcluj.ro/en/circuitul/) | Medium: official circuit text says 500 m |
| VMax Karting Brașov | **600 m** | [vmaxbrasov.ro/circuitul](https://vmaxbrasov.ro/en/circuitul/) | Medium: events page says 650 m; multi-level track |
| VMax Karting Timișoara | **600 m** | [vmaxtimisoara.ro/circuitul](https://vmaxtimisoara.ro/en/circuitul/) | **Conflict:** some pages say 500 m |

To change a value, edit `lapLengthM` in `apps/mobile/src/data/mock/tracks.ts` (demo). In the real version it goes in the `tracks.lap_length_m` column, and an admin sets "verified" once confirmed.
