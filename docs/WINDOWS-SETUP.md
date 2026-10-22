# KartUP on Windows + your phone: step by step

Your Windows PC runs the app's code, and your phone shows the app through the free **Expo Go** app. You don't need an Apple or Google developer account.

> Why not a "real" install on the iPhone from Windows? Building an iPhone app needs Apple's Xcode, which only runs on a Mac (or a paid Apple developer account with cloud builds). Expo Go is the free way to see the demo on your iPhone today.

---

## Part 1: Install on the PC (once, about 20–30 minutes)

### 1.1 Node.js
1. Open **Edge or Chrome** and go to **https://nodejs.org**.
2. Click the big **LTS** download button (the "Recommended for most users" one).
3. Open the downloaded `.msi` file and click **Next → Next → … → Install**.
   - On the "Tools for Native Modules" page, you can leave the box **unticked**.
4. When it's done, restart the PC. That makes sure Node is found everywhere.

### 1.2 GitHub Desktop (gets the KartUP code)
1. Go to **https://desktop.github.com** and click **Download for Windows**, then run the installer.
2. Sign in with the GitHub account that owns **manolachestefan1321/karting-lobby-app**.
3. Click **File → Clone repository…**, choose **karting-lobby-app**, and keep the suggested **Local path**. It's usually `C:\Users\<you>\Documents\GitHub\karting-lobby-app`. Click **Clone**.

### 1.3 Open a terminal in the project
1. In GitHub Desktop, click **Repository → Open in Command Prompt**.
   - If it asks to install Git, click **Install** and follow the steps, then try again.
   - Or: open the **Start menu**, type **PowerShell**, open it, and run `cd $HOME\Documents\GitHub\karting-lobby-app`.
2. Install the app's packages:
   ```
   npm install
   ```
   This takes a few minutes. Yellow "warn" lines are normal.

### 1.4 Install Expo Go on your phone
- **iPhone:** App Store → search **"Expo Go"** → Get.
- **Android:** Play Store → search **"Expo Go"** → Install.

Open it once and allow what it asks for.

---

## Part 2: See KartUP on your phone (every time)

1. **The PC and the phone must be on the same Wi-Fi.**
2. In the terminal, in the project folder, run:
   ```
   npm run phone
   ```
3. The first time, **Windows Firewall** asks whether to allow **Node.js**. Tick **Private networks** and click **Allow access**. If you click Cancel, the phone can't connect.
4. A big **QR code** appears in the terminal.
   - **iPhone:** open the normal **Camera** app, point it at the QR code, and tap the **"Open in Expo Go"** banner.
   - **Android:** open **Expo Go** and tap **Scan QR code**.
5. The first load takes 30–60 seconds. Then the KartUP splash appears, followed by the welcome screen.
6. Log in with **andrei@kartup.test / kartup123**, or tap **Fill in test account**.
7. **Developer menu** (statistics, time travel, switching users, fake drivers): **Profile → ⚙ Settings → Developer menu**, or tap the yellow **Demo version** badge on the welcome screen.

Keep the terminal window open while you use the app. Press **Ctrl + C** to stop.

### If the phone can't connect
- **Same Wi-Fi?** Phone and PC must use the same network (not mobile data, not a guest network).
- **Wi-Fi set to "Public" on Windows?** Settings → Network & internet → Wi-Fi → your network → **Private network**.
- **Still nothing?** Use the tunnel, which works even on different networks:
  ```
  npm run phone:tunnel
  ```
  Then scan the new QR code. (The tunnel tool comes with the project, so there is nothing extra to install.)

---

## Part 3: The browser version (optional, on the PC)
```
npm run web
```
Open **http://localhost:8081** in Chrome or Edge. You get the phone frame plus the debug panel. Test guide: **docs/PREVIEW-TESTING.md**.

---

## Getting updates later
1. In **GitHub Desktop**, click **Fetch origin**, then **Pull origin**.
2. In the terminal: `npm install`
3. Run `npm run phone` again and rescan the QR code. Changes also reload live while it's running.

---

## Common problems
| You see | Do this |
|---|---|
| `'npm' is not recognized` | Node.js isn't installed, or the PC wasn't restarted after installing it. Do 1.1 again. |
| `running scripts is disabled on this system` (PowerShell) | Use **Command Prompt** instead (GitHub Desktop → Repository → Open in Command Prompt), or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once in PowerShell and answer **Y**. |
| Expo Go says **"Project is incompatible with this version of Expo Go"** | Update Expo Go from the App Store / Play Store. If it still says so, send me the message. |
| Phone stuck on "Downloading…" or "Could not connect" | Check the firewall step and Wi-Fi above, or use `npm run phone:tunnel`. |
| `Port 8081 is being used` | Type **y** and press Enter, or close the other terminal that's already running the app. |
| A red error screen in the app | Take a screenshot (iPhone: Side + Volume Up) and send it to me. |
| Anything red in the terminal | Copy the last 20–30 lines and send them to me. |

---

## Later: a "real" installed app on the phone
- **Android:** I can make an installable **.apk** in the cloud with a free Expo account. You download it on the phone and tap to install, with no PC needed afterwards.
- **iPhone:** a permanent install needs either a **Mac** (free, see `docs/MAC-SETUP.md`) or the **Apple Developer Program** ($99/year), which allows cloud builds sent to your iPhone through TestFlight. That account is also needed for the App Store anyway.
