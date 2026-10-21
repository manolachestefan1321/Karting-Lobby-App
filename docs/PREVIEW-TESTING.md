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

## 10. Enter results (host), points and rank-up
1. Select **VMax Electric Indoor Karting Romexpo (host Andrei)**, which finished 2 hours ago. Open it and tap **Enter results**.
2. Tap the drivers in finishing order. Optionally type best laps (e.g. `48.512`) and attach a photo of a "timing printout" (any image). Tap **Submit results**.
3. Debug panel → **Others confirm results**. The results become **Final**, points are awarded, and you get a **"Rank up! 🏆 You are now Club Racer"** banner. Andrei had 966 points, and a win in a 6-driver field adds 81.
4. Open **View results** to see positions and points per driver. Check **Rankings** and **Profile → Points history**.

## 11. Confirm or dispute results (participant)
1. Select **AMC Kart (host Radu)** from yesterday. Its results are posted and waiting for Andrei's confirmation. Open it, then **View results**.
2. **Confirm results**: everyone has now confirmed, so the results become final and points are added.
3. Or tap **Dispute**, write a reason, and the results go to admin review. Use **Admin: approve results / reject results** in the debug panel.
4. Undisputed results also become final automatically after 24 hours: reset, then jump with **+1 day**.

## 12. Leaderboards
**Rankings** tab: Global / City / Track / Season (month). It updates live: finish a session in another tab and watch the points change.

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
