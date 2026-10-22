# KartUP on your Mac: complete setup, step by step

This guide goes from a Mac with nothing installed to KartUP running:
- **A:** in your browser (web preview with phone frame + debug panel),
- **B:** on a simulated iPhone,
- **C:** on your own iPhone, with the in-app **Developer menu**.

Do the parts in order. **Part 1 is only needed once.**

---

## Part 1: Install the tools (once, about 1–2 hours, mostly waiting)

| What | Why | Size |
|---|---|---|
| Xcode | Builds iPhone apps, includes the iPhone simulator | ~15 GB + ~8 GB simulator |
| Homebrew | Installs developer tools from Terminal | small |
| Node.js, Git, CocoaPods | Run and build the app | small |
| GitHub Desktop | Downloads the KartUP code from your GitHub and updates it | small |

Make sure you have **about 40 GB free** (Apple menu → About This Mac → More Info → Storage).

### 1.1 Xcode (from the App Store)
1. Open the **App Store** app (not Safari), search **Xcode**, and click **Get / Install**. It's free and big, so start it first and do the next steps while it downloads.
2. When it's done, open **Xcode** once:
   - click **Agree** on the license and enter your Mac password if asked;
   - when it asks *"Select the platforms you'd like to develop for"*, tick **iOS** and click **Download & Install**;
   - wait for it to finish, then quit Xcode (⌘Q).

### 1.2 Open Terminal
Press **⌘ + Space**, type **Terminal**, and press **Enter**. Paste each command below and press **Enter**. Wait until it finishes before pasting the next one.

> Tip: when Terminal asks for your **password**, nothing appears while you type. That's normal. Type it and press Enter.

### 1.3 Homebrew
In **Safari** you can read about it at **https://brew.sh**. To install, paste this into Terminal:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
- Press **Enter** when it asks, then type your Mac password.
- **Important:** at the end it prints **"Next steps"** with 2–3 commands (they start with `echo` and `eval`). Copy and run them too. Then **close Terminal and open it again**.
- Check it worked: `brew --version` should print a version number.

### 1.4 Node.js, Git and CocoaPods
```bash
brew install node git cocoapods
```
Check: `node --version` prints **v20** or newer.

If Xcode is already installed, also run:
```bash
sudo xcode-select --switch /Applications/Xcode.app
```
It asks for your Mac password.

### 1.5 GitHub Desktop (to get the code)
1. In **Safari**, go to **https://desktop.github.com** and click **Download for macOS**.
2. Open the downloaded file (in **Downloads**). If it's a .zip, double-click it, then drag **GitHub Desktop** into **Applications**.
3. Open **GitHub Desktop**, click **Sign in to GitHub.com**, and sign in with the GitHub account that owns **manolachestefan1321/karting-lobby-app**.
4. Click **File → Clone Repository…**, select **karting-lobby-app** in the list.
5. In **Local path**, choose your **Documents** folder, so the project ends up in `Documents/karting-lobby-app`. Click **Clone**.

*(Optional) For the web preview, **Google Chrome** works best: download it from **https://www.google.com/chrome** in Safari. Safari also works.*

### 1.6 Install the app's packages
In Terminal:
```bash
cd ~/Documents/karting-lobby-app
npm install
```
This takes a few minutes. Yellow "warn" lines are normal.

✅ Part 1 is done. You never need to do it again.

---

## Part A: See the app in the browser (fastest)
```bash
cd ~/Documents/karting-lobby-app
npm run web
```
When it says **"Waiting on http://localhost:8081"**, open **http://localhost:8081** in Chrome or Safari.

- On the left you'll see the iPhone/Android frame. On the right is the **debug panel**: time, users, GPS, fake drivers, email inbox.
- Log in with **andrei@kartup.test / kartup123**, or tap **Fill in test account**.
- What to click: **docs/PREVIEW-TESTING.md**.
- Stop with **Ctrl + C** in Terminal.

---

## Part B: See it on a simulated iPhone (on your Mac's screen)
First time (the build takes 10–20 minutes):
```bash
cd ~/Documents/karting-lobby-app
npm run ios
```
The **Simulator** opens with an iPhone and KartUP starts.

Every time after that (about 1 minute):
```bash
cd ~/Documents/karting-lobby-app
npm start
```
When it's ready, press **i**. Changes to the code reload instantly.

Simulator tips:
- Click = tap, and click-and-drag = scroll.
- **⌘ + Shift + H** = Home, **⌘ + K** = keyboard.
- To pick another model: **File → Open Simulator → iOS → iPhone …**

---

## Part C: Put it on your own iPhone (free, with a cable)
1. **Add your Apple ID to Xcode:** open Xcode, then **Xcode → Settings → Accounts → +** at the bottom left → **Apple ID** → sign in. Close the window.
2. **Plug the iPhone into the Mac** with its cable, unlock it, and tap **Trust** and enter your passcode.
3. **Turn on Developer Mode** on the iPhone: **Settings → Privacy & Security → Developer Mode → On**. The iPhone restarts; then tap **Turn On**.
   *If you don't see Developer Mode yet, do step 4 once, and it appears.*
4. **Build and install:**
   ```bash
   cd ~/Documents/karting-lobby-app
   npm run iphone
   ```
   Pick **your iPhone** from the list with the arrow keys and press Enter. The first build takes 10–20 minutes.
5. **Trust the app** (first time only): on the iPhone go to **Settings → General → VPN & Device Management → [your Apple ID] → Trust**.
6. Open **KartUP** from the home screen and log in with **andrei@kartup.test / kartup123**.

This build works **on its own**: the Mac doesn't need to stay on.

**If signing fails:**
1. Run `open ~/Documents/karting-lobby-app/apps/mobile/ios/*.xcworkspace`.
2. In Xcode's left sidebar, click **KartUP** (blue icon), then the **KartUP** target, then **Signing & Capabilities**.
3. Tick **Automatically manage signing** and choose **Team: [your name] (Personal Team)**.
4. If it says the bundle identifier is taken, change it to e.g. `com.yourname.kartup`.
5. Select your iPhone at the top and press **▶**.

**Free Apple ID limits:** the app stops opening after **7 days**. Plug in the iPhone and run `npm run iphone` again to renew it.

---

## The Developer menu (statistics + test controls)
In the app (iPhone, simulator or browser), you can open it two ways:
- **Profile → ⚙ Settings → Developer menu**, or
- on the welcome screen, tap the yellow **"Demo version"** badge.

What it has:
- **Statistics:** users, hosts, banned users, sessions (upcoming / awaiting results / finished / cancelled / disputed), paid seats, money collected, **your platform fees**, paid to hosts, refunds, no-shows, appeals, reports, chat messages, notifications, XP awarded, km driven, drivers per rank (8 ranks), and a **per-track** table (sessions, seats, revenue).
- **Time:** move the demo clock (−1 h, +15 min, +1 h, +6 h, +1 day, back to real time).
- **Signed in as:** switch to any demo user, or sign out. **Simulated GPS:** at the track / 5 km away.
- **Session:** pick a session, open its lobby, jump the clock (3 h before, 2 h before, 61 / 59 min before, 10 min before, 16 min after, +25 h), make other drivers join, pay, cancel, chat or check in, confirm or dispute results, approve as admin, or have the track cancel.
- **Progression & admin:** "Results final immediately (demo)" switch, sign in as the admin, mark an official event, approve or reject self-reported results.
- **Ban appeals:** approve or reject.
- **Email inbox:** open the link from sign-up and password-reset emails.
- **Reset demo data.**

The demo data is saved on the phone, so it stays after you close the app. **Reset demo data** starts over.

---

## Getting updates later
When I push changes:
1. Open **GitHub Desktop** and click **Fetch origin**, then **Pull origin**.
2. In Terminal:
   ```bash
   cd ~/Documents/karting-lobby-app
   npm install
   ```
3. Then run what you want: `npm run web`, `npm start` (press `i`), or `npm run iphone`.

---

## Common problems
| You see | Do this |
|---|---|
| `command not found: brew` | Run the "Next steps" lines Homebrew printed in 1.3, then close and reopen Terminal. |
| `command not found: npm` or `node` | `brew install node`, then reopen Terminal. |
| `xcode-select: error` / `xcrun: error` | `sudo xcode-select --switch /Applications/Xcode.app`, then open Xcode once and accept the license. |
| `Port 8081 is being used` | Type **y** and press Enter (it uses another port), or close the other Terminal window that's running the app. |
| `CocoaPods` / `pod install` error | `cd ~/Documents/karting-lobby-app/apps/mobile/ios && pod install`, then try again. |
| `No devices found` | Unlock the iPhone, check the cable, tap **Trust**, and make sure Developer Mode is on. |
| "Untrusted Developer" on the iPhone | Settings → General → VPN & Device Management → Trust. |
| Anything else in red | Copy the last 20–30 lines from Terminal and send them to me. |
