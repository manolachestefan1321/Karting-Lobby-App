# Real sign-in: setup checklist (Apple, Google, Facebook, email)

The app code for real accounts is ready. What remains is account and console setup. Only you can do it, in this order.
Values you copy go into **environment variables**, never into the code.

**App IDs used everywhere**

| Build | iOS bundle ID | Android package | Uses |
|---|---|---|---|
| Real app (`production`) | `com.kartup.app` | `com.kartup.app` | real backend |
| Internal test (`preview`) | `com.kartup.app.preview` | `com.kartup.app.preview` | real backend |
| Track demo (`demo`) | `com.kartup.app.demo` | `com.kartup.app.demo` | demo data (fake drivers) |

**Deep link (redirect) for the app:** `kartup://auth/callback`

---

## 1. Supabase project
1. Create a project at **supabase.com**. Choose the region **Frankfurt (eu-central-1)**.
2. Note your **Project URL** (`https://<ref>.supabase.co`) and the **anon key**: Project Settings → API.
   - The `service_role` key stays secret. Never put it in the app or in Git.
3. On your PC, in the project folder:
   ```
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   `db push` runs the migrations. ⚠️ The migration `20261027000100_progression_and_social_profiles.sql` renames rank rows 4–5 and adds rows 6–8. It deletes nothing.
4. Supabase → **SQL Editor** → paste and run `supabase/seed.sql`. It adds the country, the 8 cities and the 12 tracks. It contains **no demo users**.
5. Deploy the delete-account function:
   ```
   npx supabase functions deploy delete-account
   ```
6. Supabase → **Authentication → URL Configuration**:
   - **Site URL:** `kartup://auth/callback`
   - **Redirect URLs:** add `kartup://**`, plus for testing on your PC and in Expo Go: `http://localhost:8081/**` and `exp://**`
7. Supabase → **Authentication → Providers → Email**: keep it enabled with **Confirm email** on.
8. Later, before launch: set up a custom email sender under **Authentication → SMTP** (for example Resend or Brevo). Supabase's built-in sender is limited to a few emails per hour.

## 2. Apple (Sign in with Apple)
You need the **Apple Developer Program** (99 $/year).
1. **developer.apple.com → Certificates, IDs & Profiles → Identifiers**: the App ID `com.kartup.app` must have **Sign In with Apple** enabled.
   - EAS turns this on automatically on the first `eas build` (`usesAppleSignIn`). Check it's ticked.
2. Supabase → **Authentication → Providers → Apple**: enable it.
   - **Client IDs:** `com.kartup.app`
   - **Secret Key:** leave it empty. It's only needed for Apple sign-in on the web, and the app shows the Apple button only on iPhone.
3. Nothing to add to the app's environment variables.

## 3. Google (Sign in with Google)
In **console.cloud.google.com**:
1. Create a project, for example "KartUP".
2. Open **APIs & Services → OAuth consent screen** and fill it in:
   - app name **KartUP**, support email, logo;
   - links to your privacy policy and terms;
   - scopes: `email`, `profile`, `openid`.
   - Then **Publish app**.
3. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**, three times:
   - **Web application**, named "KartUP Supabase". Under **Authorized redirect URIs** add `https://<ref>.supabase.co/auth/v1/callback`. Copy the **Client ID** and the **Client secret**.
   - **iOS**, with bundle ID `com.kartup.app`. Copy the **Client ID**.
   - **Android**, with package `com.kartup.app` and the **SHA-1 fingerprint**:
     - from `eas credentials` → Android → production keystore;
     - after the first Play Store upload, create **a second Android client** with the SHA-1 from **Play Console → Setup → App signing**.
4. In Supabase → **Authentication → Providers → Google**, enable it:
   - **Client IDs:** `<web client id>,<ios client id>,<android client id>` (comma-separated, web first)
   - **Client Secret:** the web client secret
   - **Skip nonce checks:** ON (needed for native Google sign-in on iPhone)

## 4. Facebook (Sign in with Facebook)
In **developers.facebook.com**:
1. **Create app**, use case **Authenticate and request data from users with Facebook Login**.
2. **Facebook Login → Settings → Valid OAuth Redirect URIs:** `https://<ref>.supabase.co/auth/v1/callback`
3. **Permissions:** `email` and `public_profile`. These are standard; no review is needed for them.
4. **App settings → Basic**:
   - privacy policy URL;
   - **User data deletion**: a URL with deletion instructions;
   - app icon and category.
   - Copy the **App ID** and the **App Secret**.
5. Switch the app from **Development** to **Live**. Until then, only people added as testers can log in.
6. In Supabase → **Authentication → Providers → Facebook**, enable it and paste the App ID and App Secret.

## 5. Environment variables
**In the app** (EAS → your project → **Environment variables**, environment **production**, and **preview** if you use it). They can also go in a local `apps/mobile/.env` file, which is never committed:

| Variable | Value | Secret? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | no (public) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | no (public by design) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google **Web** client ID | no |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google **iOS** client ID | no |
| `EAS_PROJECT_ID` | from `eas init` | no |

`EXPO_PUBLIC_DATA_SOURCE` is already set by `eas.json`: `supabase` for production and preview, `mock` for demo.

Command line alternative: `eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://... --visibility plaintext`

**Only on the backend** (Supabase dashboard, or the root `.env` for the local stack). **Secret, never in the app:**

| Variable | Where |
|---|---|
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | Google web client secret |
| `SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET` | Facebook App Secret |
| `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` | only if you add Apple sign-in on the web later |
| `SUPABASE_SERVICE_ROLE_KEY` | provided automatically to Edge Functions; never copy it anywhere |

## 6. Store requirements for accounts
- **Apple:** Sign in with Apple is offered next to Google and Facebook (✅ in the app). Accounts can be deleted inside the app (✅ Settings → Delete account).
- **Google Play:**
  - the in-app deletion is done (✅);
  - Play also requires a **web link** where people can ask for their account to be deleted (for example a page on your website, or your support email with instructions). Add it in **Play Console → App content → Data safety**.

## 7. Builds
```
cd apps\mobile
eas build --platform all --profile production   # real app for the stores
eas build --platform ios --profile demo         # demo for track visits (TestFlight)
```
A `production` or `preview` build stops with an error if it would contain the demo.

**Testing real accounts before any build:** put the Supabase URL and anon key in `apps/mobile/.env`, then:
- `npm run web:real` opens it in Chrome at http://localhost:8081;
- `npm run phone:real` opens it in Expo Go.

Email, Google and Facebook work there (Google uses the browser instead of the native picker). The native Google picker and Sign in with Apple need a `preview` build.
`npm run web` and `npm run phone:tunnel` stay on the demo.
