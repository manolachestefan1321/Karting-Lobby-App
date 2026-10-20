# KartApp (placeholder name)

A social app for karting: find drivers in your city, join a session lobby, pay your share, race, and climb the rankings.

- **Mobile app:** `apps/mobile`, built with Expo (React Native) for iOS and Android.
- **Backend:** `supabase/`, which holds the database, security rules, server functions and seed data.
- **Business rules:** `packages/domain`, pure TypeScript with tests.
- **Branding:** `config/brand.ts`. The name, colors, logo and app IDs live only in this file.
- **Architecture and decisions:** see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Build progress

| Step | Status |
|---|---|
| 1. Auth & profiles | ✅ done |
| 2. Cities, tracks, prices | ⏳ next |
| 3. Sessions & lobby | |
| 4. Payments & refunds | |
| 5. Check-in & bans | |
| 6. Results & ranking | |
| 7. Notifications | |
| 8. Admin panel | |
| 9. Store preparation | |

---

## Part A: One-time setup on your Mac

Type the commands in **Terminal** (press ⌘+Space, type "Terminal", then press Enter). Copy and paste one line at a time.

### A1. Install the tools

1. **Homebrew** (the package manager for macOS):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   At the end it prints 2–3 lines under "Next steps". Copy and run them too.
2. **Node.js and Git:**
   ```bash
   brew install node git
   ```
3. **Docker Desktop.** The local database runs inside it. Download it from https://www.docker.com/products/docker-desktop/, open it once and leave it running.
4. **Xcode** (for the iPhone simulator). Install it from the Mac App Store; it's free and about 10 GB. Open it once and accept the license. Then run:
   ```bash
   xcode-select --install
   ```
5. **Android Studio** (optional, for the Android emulator). Download it from https://developer.android.com/studio. In *More Actions → Virtual Device Manager*, create a Pixel device.

### A2. Get the code and install

```bash
git clone <your-repo-url> kartapp
cd kartapp
npm install
```

### A3. Run the backend locally (no accounts needed)

```bash
npx supabase start
```
The first run downloads Docker images and takes a few minutes. When it finishes, it prints an **API URL** and an **anon key**. Keep them.

```bash
npx supabase db reset      # creates all tables and loads the seed data
npx supabase test db       # runs the database security tests
```

Open http://127.0.0.1:54323 to browse the database in Supabase Studio.
Emails sent by the local backend (confirmation, password reset) appear at http://127.0.0.1:54324.

### A4. Run the app in the simulator

```bash
cp apps/mobile/.env.example apps/mobile/.env
open -e apps/mobile/.env     # paste the API URL and anon key from step A3
cd apps/mobile
npx expo run:ios             # first build takes 5–10 minutes
# or, for Android:  npx expo run:android
```

> **Why not Expo Go?** Google sign-in and (later) Stripe use native code that Expo Go doesn't contain. `expo run:ios` builds a custom development version of the app. You only rebuild when native libraries change. Day-to-day code changes reload instantly.

With the local backend, **email sign-up works right away.** Open the confirmation email at http://127.0.0.1:54324. Google, Apple and Facebook sign-in need the accounts from Part B.

### A5. Run all tests

```bash
npm test                 # business rules (Vitest) + app tests (Jest)
npm run typecheck        # TypeScript checks
npx supabase test db     # database security (RLS) tests
```

---

## Part B: Accounts and keys (do these when you're ready to go online)

### B1. Supabase (hosted backend, free to start)
1. Create an account at https://supabase.com and create a **New project**. Choose region *Central EU (Frankfurt)* and save the database password somewhere safe.
2. Connect your code to the project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <the id from your project URL>
   npx supabase db push --include-seed    # creates the tables and loads the starter data
   npx supabase functions deploy delete-account
   ```
   If the seed step fails, paste the contents of `supabase/seed.sql` into **SQL Editor** on the Supabase website and click *Run*. It is safe to run more than once.
3. Under **Project Settings → API**, copy the *Project URL* and *anon public* key into `apps/mobile/.env`.
4. Under **Authentication → URL Configuration**:
   - Set *Site URL* to `kartapp://`.
   - Add these *Redirect URLs*: `kartapp://**`, `exp://**`.
5. Under **Authentication → Sign In / Providers → Email**, turn on *Confirm email*. Set the minimum password length to 8.
6. **Before launch:** under **Authentication → Emails → SMTP Settings**, connect a real email service, for example Resend or Brevo. Supabase's built-in email only sends a few messages per hour and is meant for testing.

### B2. Google sign-in
1. Go to https://console.cloud.google.com and create a project. Open **APIs & Services → OAuth consent screen**, choose *External* and fill in the app name and support email.
2. Under **Credentials → Create credentials → OAuth client ID**, create three clients:
   - **Web application.** Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
   - **iOS.** Bundle ID: `com.kartapp.app`.
   - **Android.** Package: `com.kartapp.app`. For the SHA-1, run `npx eas-cli credentials` in `apps/mobile` and use the fingerprint it shows.
3. In Supabase, under **Authentication → Providers → Google**:
   - Enable the provider.
   - In *Client IDs*, paste `WEB_ID,IOS_ID,ANDROID_ID` (comma-separated).
   - In *Client Secret*, paste the web client's secret.
   - Turn on **Skip nonce checks**. Native iOS sign-in needs this.
4. In `apps/mobile/.env`, set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

### B3. Apple sign-in (needs the Apple Developer Program, $99/year)
1. Join at https://developer.apple.com/programs/.
2. Go to **Certificates, IDs & Profiles → Identifiers** and register the App ID `com.kartapp.app` with **Sign In with Apple** enabled. EAS can also create this for you on the first build.
3. In Supabase, under **Authentication → Providers → Apple**, enable the provider and put `com.kartapp.app` in *Client IDs*. Native iOS sign-in doesn't need a secret.

### B4. Facebook sign-in
1. Go to https://developers.facebook.com and choose **Create App → Authenticate and request data from users with Facebook Login**.
2. Under **Facebook Login → Settings → Valid OAuth Redirect URIs**, add `https://<your-project>.supabase.co/auth/v1/callback`.
3. Copy the **App ID** and **App Secret** from **App settings → Basic**, and paste them into Supabase under **Authentication → Providers → Facebook**.
4. Before launch, switch the Facebook app to **Live** mode. This requires the privacy policy URL.

### B5. Expo / EAS (cloud builds, free tier available)
```bash
cd apps/mobile
npx eas-cli login          # create an account at https://expo.dev first
npx eas-cli init           # links the project and fills EAS_PROJECT_ID
npx eas-cli build --profile development --platform ios       # dev build for your iPhone
npx eas-cli build --profile development --platform android   # dev build for Android
```
Store publishing instructions come in step 9.

---

## Project structure

```
config/brand.ts        name, logo, colors, bundle IDs (change branding here)
apps/mobile/           Expo app (Expo Router screens in src/app)
packages/domain/       business rules + unit tests
supabase/migrations/   database schema + security rules
supabase/functions/    server-side Edge Functions
supabase/tests/        database security tests (pgTAP)
supabase/seed.sql      starter data (Romanian cities, tracks in step 2)
docs/                  architecture & decisions
```

## Notes for developers
- **Strings:** every visible string is in `apps/mobile/src/i18n/en.ts` and `ro.ts`. A test fails if the two files have different keys.
- **Database:** RLS is enabled on every table. Clients get column-level grants only. Anything involving money, seats, bans or points goes through Edge Functions or `SECURITY DEFINER` SQL.
- **Testing without Docker:** `npm run db:test` runs migrations and pgTAP tests against a throw-away Postgres. It's used in CI and needs Postgres 16+, PostGIS and pgTAP installed.
