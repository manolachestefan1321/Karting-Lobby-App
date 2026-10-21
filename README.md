# KartUP

**Find your team & race.**

KartUP is a social app for karting: find drivers in your city, join a session lobby, pay your share, race, and climb the rankings.

| Folder | What it is |
|---|---|
| `apps/mobile` | The app (Expo / React Native). The same code runs on iPhone, Android and as the web preview. |
| `packages/domain` | Business rules with tests: prices, refunds, bans, points, results. |
| `supabase/` | Real backend: database, security rules, server functions, email templates. |
| `config/brand.ts` | Name, slogan, colors and app IDs. Change branding here only. |
| `legal/` | Privacy policy and terms templates (edit these). |
| `docs/` | **[Windows + phone setup](docs/WINDOWS-SETUP.md)** · **[Mac setup, step by step](docs/MAC-SETUP.md)** · [Preview testing guide](docs/PREVIEW-TESTING.md) · [Tracks & prices](docs/TRACKS.md) · [Architecture](docs/ARCHITECTURE.md) |

## Where we are

**Now: local web preview.** The whole app runs in your browser inside a phone frame. It uses fake data, a fake login, fake payments and a debug panel, and needs no accounts or keys. Once you approve the preview, we connect the real backend (Supabase, Stripe, sign-in providers, push notifications) and make the native builds.

---

## Run the preview on your Mac

> **On Windows? Follow [docs/WINDOWS-SETUP.md](docs/WINDOWS-SETUP.md)** (see it on your phone with Expo Go).
> **New Mac? Follow [docs/MAC-SETUP.md](docs/MAC-SETUP.md)**: it covers everything to install (Xcode, Homebrew, GitHub Desktop) and how to run KartUP in the browser, on the iPhone simulator and on your own iPhone.

You only need to do steps 1 and 2 once.

**1. Install Node.js.** Open **Terminal** (press ⌘+Space, type "Terminal", press Enter) and paste:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
At the end it prints 2–3 lines under "Next steps". Copy and run them too. Then run:
```bash
brew install node git
```

**2. Download the code and install:**
```bash
cd ~/Documents
git clone https://github.com/manolachestefan1321/karting-lobby-app.git
cd karting-lobby-app
npm install
```

**3. Start the preview** (every time):
```bash
cd ~/Documents/karting-lobby-app
npm run web
```
Wait until it says **"Waiting on http://localhost:8081"**, then open **http://localhost:8081** in Chrome.

- The preview only runs on your computer (`localhost`). Nobody else can see it.
- Live reload is on: when the code changes, the page updates by itself.
- To stop it, press `Ctrl + C` in Terminal.
- To get the latest version later, run `git pull` and then `npm install` before `npm run web`.

**Test login:** `andrei@kartup.test`, password `kartup123`. On the login screen, the "Fill in test account" button types these in for you. Every demo user has the same password.

All demo data is stored in your browser. **Reset demo data** in the debug panel brings back the starting data. The **tracks and their prices are real** but marked **"to verify"** (see [docs/TRACKS.md](docs/TRACKS.md)); the people, sessions and results are fictional.

See **[docs/PREVIEW-TESTING.md](docs/PREVIEW-TESTING.md)** for exactly what to click to test each flow.

---

## Rebranding

1. Edit `config/brand.ts`: name, slogan, colors, bundle IDs, contact email and company name.
2. Run `npm run brand:sync`. This regenerates the placeholder logo, the app icon and splash images, the email templates (`supabase/templates/`) and the in-app legal texts.
3. When the real logo exists, put the image files in `apps/mobile/assets/images/` with the same names and sizes. From then on, run `npm run brand:sync -- --skip-images` so your logo isn't overwritten.

The placeholder logo is the text "KartUP" in the accent color with a small checkered flag.

## Developer commands

```bash
npm run web          # web preview with fake backend (http://localhost:8081)
npm test             # all unit + integration tests
npm run typecheck    # TypeScript checks
npm run db:test      # database migrations + security tests (needs local Postgres + PostGIS + pgTAP)
npm run brand:sync   # regenerate logo images, email templates, legal texts from config/brand.ts
```

## Later: real backend and store builds

These steps are **not needed for the preview**. When you approve the preview, we will:
1. Connect Supabase. Auth, profiles and cities are already written for it in `apps/mobile/src/data/supabase`. Sessions, payments and results come next.
2. Set up Stripe: test mode first, with Connect Express payouts to hosts.
3. Set up sign-in with Google, Apple and Facebook, and push notifications.
4. Make EAS builds for iPhone and Android, and publish to App Store Connect and Google Play Console.

Each of these steps will come with exact account-setup instructions for macOS.
