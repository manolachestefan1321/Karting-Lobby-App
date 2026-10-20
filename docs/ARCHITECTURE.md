# KartApp: architecture (v1, approved 2026-10-20)

## Decisions confirmed by the owner
| Topic | Decision |
|---|---|
| Who receives the money | The platform (you). Drivers pay in the app. |
| Who books the track slot | The host books it and pays the track at the desk. |
| Paying the host back | **Stripe Connect Express** payouts. A host verifies once (ID + IBAN) before creating a session. After the session took place, the app transfers `track price × paid drivers` to the host. Refunded seats are not paid out. Late cancellations and no-shows still pay the host. The payout is held if participants report that the session didn't happen. |
| Who pays | Every participant, the host included. |
| Minimum drivers | 4. If a session has fewer than 4 paid drivers at the auto-cancel cut-off, it is cancelled automatically and everyone gets a full refund. |
| Platform fee | 5 RON per driver, on top of the track price (configurable in `app_config`). Example: an 800 RON track price for 10 drivers means each pays 80 + 5 = 85 RON, you keep 50 RON and the host receives 800 RON. |
| Time display | Always the track's local time. |

> "KartApp" is a placeholder. All branding (name, slug, bundle IDs, colors, logo paths, support email, legal entity) lives in **`config/brand.ts`**, so renaming means editing one file.

---

## 1. High-level architecture

```
┌──────────────────────────┐        ┌──────────────────────────────────────────────┐
│  Mobile app (Expo, RN)   │        │                 Supabase                      │
│  iOS + Android           │◄──────►│  Auth (email, Google, Apple, Facebook)        │
│  Expo Router, TS         │  HTTPS │  Postgres + RLS (+ PostGIS, pg_cron, pg_net)  │
│  Stripe PaymentSheet     │  WSS   │  Realtime (lobby, chat, leaderboards)         │
│  Expo Notifications      │        │  Storage (avatars, track photos, printouts)   │
└──────────┬───────────────┘        │  Edge Functions (Deno), see section 4         │
           │                        └───────┬───────────────────────┬──────────────┘
           │ PaymentSheet                   │ webhooks / API        │ push
           ▼                                ▼                       ▼
     ┌───────────┐                    ┌───────────┐          ┌──────────────────┐
     │  Stripe   │◄───────────────────│  Stripe   │          │ Expo Push Service│
     └───────────┘                    └───────────┘          └──────────────────┘
┌──────────────────────────┐
│ Admin panel (Next.js)    │──► same Supabase project (admin role, service key on the server only)
│ + public /privacy /terms │    deployed on Vercel (free tier is enough)
└──────────────────────────┘
```

**Why Supabase and not Firebase:** everything in the spec is relational (sessions ↔ bookings ↔ payments ↔ results ↔ points ↔ bans). It needs transactional seat allocation, server-side rules and SQL leaderboards. Postgres + RLS covers this better than Firestore. Firebase has no clear advantage for any requirement here, so **no switch**.

### Main principles
1. **The server is the source of truth.** Money, seats, cancellations, check-in, bans, results and points change only through Edge Functions or `SECURITY DEFINER` SQL functions. RLS makes these tables read-only for clients.
2. **Business rules are pure TypeScript** in `packages/domain` (refund window, ban ladder, points formula, results-confirmation state machine, check-in window). Edge Functions import this code to enforce the rules. The app imports it only for display (for example, "you can cancel with refund until 18:00"). Unit tests run against this package.
3. **Tunable values live in config tables, not in code:** `app_config` (min age, check-in radius, fees, reminder times), `ban_ladder`, `points_config`, `rank_tiers`. Admins can edit them in the panel.
4. **Money is stored as integers in minor units** (bani). Currency is stored on every row, RON by default.
5. **Times are `timestamptz` (UTC)** everywhere. Each track has an IANA timezone (`Europe/Bucharest`). Session times show in the track's local time, which is the time that matters when you drive there. If the device is in a different zone, a small label shows it.

---

## 2. Payment design (important, please read)

**Problem:** "a seat is held only after successful payment" plus "no overbooking". Two people could pay for the last seat at the same moment.

**Solution: authorize first, then capture once the seat is confirmed.**
1. The user taps *Join & pay*. The `create-payment-intent` function checks the server-side rules: not banned, not already in, session open, rank/skill OK, spots left. It computes the amount from the DB price snapshot (never from the client) and creates a PaymentIntent with `capture_method=manual`.
2. PaymentSheet authorizes the card. The money is blocked but not taken.
3. The Stripe webhook (`payment_intent.amount_capturable_updated`) locks the session row (`SELECT … FOR UPDATE`). If a spot is still free, it creates a `confirmed` booking and captures the payment. If the session is full, it cancels the authorization, so the user is never charged and nothing needs refunding.
4. The app watches the booking through Realtime and shows "You're in!".

**Refunds** go through Stripe Refunds from the `cancel-booking` / `cancel-session` functions. Every Stripe object and event is mirrored in `payments` / `refunds` tables and is idempotent (keyed by Stripe event IDs).

---

## 3. Database schema

(Abbreviated. Every table has `created_at`/`updated_at`, and every table has RLS enabled.)

### Reference data
| Table | Key columns |
|---|---|
| `countries` | `code` (RO), `name_en`, `name_ro`, `currency` |
| `cities` | `id`, `country_code`, `name`, `slug`, `location geography(Point)`, `timezone` |
| `tracks` | `id`, `city_id`, `name`, `address`, `location geography(Point)`, `website`, `phone`, `opening_hours jsonb`, `kart_types text[]`, `session_length_min`, `max_drivers`, `timezone`, `checkin_radius_m` (null → global default), `price_provider` (`manual`/`scrape`/`api`), `price_provider_config jsonb`, `is_active` |
| `track_photos` | `track_id`, `storage_path`, `sort` |
| `track_prices` | `track_id`, `price_minor`, `currency`, `source`, `source_url`, `fetched_at`, `is_current`. History is kept, so "last updated" is always known. |

### Users
| Table | Key columns |
|---|---|
| `profiles` | `id` (= auth.users.id), `first_name`, `last_name`, `date_of_birth`, `home_city_id`, `bio`, `avatar_path`, `locale`, `theme`, `role` (`user`/`admin`), `deleted_at` |
| `track_experience` | `user_id`, `track_id`, `level` (beginner/intermediate/advanced), `best_lap_ms`, `sessions_count` (self-reported, plus a count verified from finalized sessions) |
| `user_stats` | `user_id`, `total_points`, `sessions_raced`, `tracks_raced`, `wins`, `no_show_count`, `rank_tier_id`. Maintained by triggers and used by leaderboards and Realtime. |
| `push_tokens` | `user_id`, `expo_token`, `platform` |
| `notification_prefs` | `user_id`, one boolean per notification type |
| `blocks` | `blocker_id`, `blocked_id` (Apple requires blocking for apps with user-generated content) |

### Sessions & lobby
| Table | Key columns |
|---|---|
| `sessions` | `id`, `track_id`, `host_id`, `starts_at` (UTC), `max_drivers`, `min_rank_tier_id`, `min_skill_level`, `note`, `status` (`open`/`full`/`locked`/`in_progress`/`awaiting_results`/`results_pending`/`disputed`/`final`/`cancelled`), `cancelled_by` (`host`/`track`/`admin`/`system`), **price snapshot:** `price_per_driver_minor`, `fee_minor`, `currency`, `price_updated_at` |
| `lobby_members` | `session_id`, `user_id`, `status` (`joined_unpaid`, `confirmed`, `cancelled`, `removed`, `no_show`, `attended`), `paid_at`, `cancelled_at`, `checked_in_at`, `checkin_location`, `host_confirmed_attendance` |
| `chat_messages` | `session_id`, `user_id`, `body`, `hidden_by_moderation` |

### Money
| Table | Key columns |
|---|---|
| `payments` | `lobby_member_id`, `stripe_payment_intent_id`, `amount_minor`, `currency`, `status`, `captured_at` |
| `refunds` | `payment_id`, `stripe_refund_id`, `amount_minor`, `reason` (`user_cancel`/`host_cancel`/`track_cancel`/`host_removed`/`admin`), `status` |
| `stripe_events` | `id` (Stripe event ID, used for idempotency), `type`, `payload`, `processed_at` |

### Penalties
| Table | Key columns |
|---|---|
| `ban_ladder` (config) | `offense_number`, `duration` (`interval`). Defaults: 1 → 1h, 2 → 24h, 3 → 7d, 4+ → 30d |
| `no_shows` | `user_id`, `session_id`, `created_at`, `voided` (an admin can void one after an appeal) |
| `bans` | `user_id`, `reason` (`no_show`/`admin`), `starts_at`, `ends_at` (null = permanent admin ban), `no_show_id`, `lifted_at` |
| `ban_appeals` | `ban_id`, `user_id`, `message`, `status`, `admin_note` |

### Results & ranking
| Table | Key columns |
|---|---|
| `session_results` | `session_id`, `submitted_by`, `submitted_at`, `printout_path`, `confirm_deadline` (submitted + 24h), `status` (`pending`/`disputed`/`final`/`rejected`) |
| `result_entries` | `session_id`, `user_id`, `position`, `best_lap_ms` |
| `result_responses` | `session_id`, `user_id`, `response` (`confirm`/`dispute`), `comment` |
| `points_config` (config) | formula parameters (see below) |
| `rank_tiers` (config) | `name_key`, `min_points`, `color`, `sort` |
| `seasons` | `id` (e.g. `2026-11`), `starts_at`, `ends_at` |
| `points_ledger` | `user_id`, `session_id`, `season_id`, `city_id`, `track_id`, `points`, `position`, `field_size`, `reason`. Append-only. Leaderboards are SUM queries and views over this table. |

### Moderation & ops
`reports` (`reporter_id`, `target_type` profile/message, `target_id`, `reason`, `status`), `notifications` (in-app inbox: `user_id`, `type`, `payload`, `read_at`, `push_sent_at`), `app_config` (key/value jsonb), `admin_audit_log`.

### Points formula (proposal, all parameters in `points_config`)
```
N   = number of classified drivers (min_field_size = 3 to award points)
pos = finishing position (1 = winner)
s   = (N − pos) / (N − 1)              # 1.0 for the winner, 0.0 for last place
m   = 1 + field_bonus · ln(N / 3)      # bigger field → bigger multiplier
points = round(participation + base · s · m)
defaults: participation = 10, base = 50, field_bonus = 0.6
```
Examples: winning a 3-driver race = 60 pts, winning an 8-driver race ≈ 89, winning a 12-driver race ≈ 102, last place = 10.
Anti-farming: points only for results that are final and for drivers marked `attended`, at most 3 ranked sessions per user per day (configurable).

### Default rank tiers
Rookie 0 · Amateur 250 · Club Racer 1 000 · Pro 3 000 · Elite 7 500. These can be edited in the admin panel.

### Key RLS rules (summary)
- Reference data (`tracks`, `cities`, prices, `rank_tiers`, configs): anyone signed in can read. Only admins can write.
- `profiles`: anyone signed in can read public columns, through a `public_profiles` view that hides `date_of_birth` and shows age only. You can update only your own row.
- `sessions`: anyone can read. Clients create sessions only through the `create_session()` RPC, which validates the track limit, bans and future start time.
- `lobby_members`, `payments`, `refunds`, `bans`, `no_shows`, `points_ledger`: **clients cannot write to these at all.** Only Edge Functions and RPCs write them.
- `chat_messages`: only lobby members can read or insert. Blocked users' messages are filtered out.
- pgTAP tests in `supabase/tests/` check each rule with real users that have different roles.

---

## 4. Edge Functions & scheduled jobs

| Function | Trigger | Job |
|---|---|---|
| `create-payment-intent` | app | validates join rules, creates a manual-capture PaymentIntent |
| `stripe-webhook` | Stripe | confirms the seat and captures, or cancels the authorization; records refunds |
| `cancel-booking` | app | user cancel: full refund if `now < starts_at − 1h`, otherwise refused |
| `cancel-session` | app/admin | host, track or admin cancel: full refund for everyone |
| `remove-member` | app | host removes an unpaid member (or a paid member with a full refund) |
| `check-in` | app | validates the time window (−30/+15 min) and distance to the track (PostGIS) |
| `submit-results` / `respond-results` | app | host submits the results, participants confirm or dispute |
| `delete-account` | app | anonymizes the profile, keeps payment records for accounting, deletes the auth user |
| `refresh-prices` | pg_cron daily | runs each track's `PriceProvider` and caches the results in `track_prices` |
| `tick` | pg_cron every minute | 2h reminders, closing check-in → no-shows → bans, ban-ended notices, finalizing results after 24h, awarding points, minimum-drivers auto-cancel |
| `send-push` | internal | reads `notifications`, applies user prefs, sends through Expo Push, cleans invalid tokens |

**PriceProvider interface** (`supabase/functions/_shared/prices/`):
```ts
interface PriceProvider {
  id: 'manual' | 'scrape' | 'api';
  fetch(track: Track): Promise<PriceQuote | null>; // { priceMinor, currency, sourceUrl, fetchedAt }
}
```
`ManualPriceProvider` reads the price an admin entered. `ScrapePriceProvider` parses the track website using a per-track config (URL plus selector or regex). `ApiPriceProvider` is a stub for tracks that offer an API. If an automatic provider fails, the last known price stays in place with its original "last updated" date.

---

## 5. Folder structure (monorepo, npm workspaces)

```
kartapp/
├── config/
│   └── brand.ts                  # ← name, logo, colors, bundle IDs: change everything here
├── apps/
│   ├── mobile/                   # Expo app
│   │   ├── app/                  # Expo Router screens
│   │   │   ├── (auth)/           # welcome, sign-in, sign-up, verify-email, reset-password, onboarding
│   │   │   ├── (tabs)/           # sessions, leaderboard, create, notifications, profile
│   │   │   ├── session/[id]/     # lobby, chat, check-in, results
│   │   │   ├── user/[id].tsx     # public profile
│   │   │   ├── track/[id].tsx
│   │   │   └── settings/         # language, theme, notifications, account, legal, delete account
│   │   ├── src/
│   │   │   ├── components/       # UI kit: Button, Card, Avatar, RankBadge, Countdown, EmptyState, Skeleton…
│   │   │   ├── features/         # auth, profile, tracks, sessions, lobby, payments, checkin, results, ranking, notifications, moderation
│   │   │   ├── lib/              # supabase client, stripe, push, location, image (crop/compress)
│   │   │   ├── i18n/             # en.json, ro.json, setup (expo-localization + i18next)
│   │   │   └── theme/            # dark/light tokens, typography (bold condensed font)
│   │   ├── assets/               # placeholder icon, splash, adaptive icon
│   │   ├── app.config.ts         # reads config/brand.ts and env vars
│   │   └── eas.json              # development / preview / production
│   └── admin/                    # Next.js admin panel + public /privacy and /terms pages
├── packages/
│   ├── domain/                   # pure TS business rules + Vitest unit tests
│   │   └── src/ refunds.ts, bans.ts, points.ts, ranks.ts, results.ts, checkin.ts, money.ts
│   └── db-types/                 # generated Supabase TypeScript types
├── supabase/
│   ├── migrations/               # schema, RLS, functions, triggers, cron jobs
│   ├── seed.sql                  # countries, Romanian cities, tracks, configs, demo data
│   ├── functions/                # Edge Functions (+ _shared/)
│   └── tests/                    # pgTAP RLS tests
├── tests/integration/            # join/pay/cancel flows against local Supabase + Stripe test mode
├── legal/                        # privacy-policy.md, terms.md (editable templates)
├── docs/                         # this file, setup guides
├── .env.example
└── README.md                     # macOS setup + store publishing guide
```

### Libraries
Expo SDK (latest stable), Expo Router, TanStack Query, Zustand (light UI state), react-hook-form + zod, i18next + expo-localization, @stripe/stripe-react-native, expo-notifications, expo-location, expo-image-picker + expo-image-manipulator, expo-apple-authentication, @react-native-google-signin/google-signin, react-native-reanimated, Vitest, jest-expo + React Native Testing Library, pgTAP.

---

## 6. Things to know up front

- **Expo Go is not enough.** Stripe, Google and Apple sign-in need a *development build* (a custom version of Expo Go built with EAS). It's free to build, but iOS builds on a real phone need an **Apple Developer account ($99/year)**. Google Play costs **$25 once**.
- **Apple guideline 1.2** (user-generated content) requires report, **block user**, content filtering and an agreement to the terms. I added blocking and a terms checkbox at sign-up.
- **Accounting:** the platform collects the money. Romania requires invoices (e-Factura) for B2C services. This is outside the app's scope, but you should talk to an accountant before launch.
- **What I can do in this cloud environment:** write the code, run unit tests, type checks and Expo bundling, and preview screens on Expo Web. Docker isn't available here, so local-Supabase tests (RLS, integration) are written by me and run on your Mac, where I'll give you exact commands. Running on iOS/Android simulators also happens on your Mac.
- **This workspace is temporary.** The code needs a GitHub repository to survive. Please create an empty private repo and connect it to this session, or tell me to keep going and I'll push as soon as one is connected.
