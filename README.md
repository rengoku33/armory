# Armory — StrongLifts 5×5 Tracker

A powerlifting tracker built on **StrongLifts 5×5**, from a single Expo codebase for **Android + iOS + Web**.

Google OAuth + email sign-in. Every row of workout data is scoped to the signed-in user via
Postgres Row Level Security.

## Stack

- **Expo SDK 57** / **React Native 0.86** / **TypeScript** (expo-router file-based routing)
- **Supabase**: auth (Google OAuth + email password fallback), Postgres storage, Row Level Security
- **react-native-gifted-charts** + **react-native-svg** for lift progress graphs
- **react-native-reanimated** for animations (rest-timer countdown ring, transitions)

## Features

- **Workout A/B alternation** (auto-schedules the next day)
  - **A** = Squat / Bench / Overhead Press — 5×5
  - **B** = Squat / Barbell Row / Deadlift (1×5)
- **You set the weights**: no forced progression — each lift suggests your last working weight,
  and you log what you actually lift (missed sets are flagged)
- **Editable templates**: add / remove / reorder exercises per day, including your **custom exercises**
- **Warmup ramps**, **plate calculator**, and a **rest timer** with countdown ring
- **History log** grouped by month, tap-through to full session detail
- **Progress charts per lift**: top weight / estimated 1RM (Epley) / volume
- **Units**: switch kg / lbs in Settings, persisted to your profile

> Note: the original StrongLifts auto-progression/deload rules are **not** enforced — this build
> is intentionally "log what you lift". See `src/lib/program.ts`.

## Project structure

```
app/                    # expo-router routes
  (tabs)/               # today, history, progress, settings
  auth/callback.tsx     # deep-link handler for Google OAuth return
  edit-workout.tsx      # edit / add exercises to a workout
  onboarding.tsx        # first-run unit + starting-weight setup
  login.tsx / signup.tsx
src/
  lib/                  # supabase client, OAuth, queries, program logic, exercises
  store/                # auth context/provider
  components/           # shared UI (Button, Card, Field, Segmented, ConfirmDialog)
  theme.ts              # colors / spacing / radius tokens
supabase/migrations/    # 0001_init.sql, 0002_refactor.sql
eas.json                # EAS build profiles (+ prod env vars)
app.json                # Expo config (scheme armory, package com.rengoku.armory)
```

## Setup

### 1. Clone & install

```sh
git clone <your-repo-url>
cd armory
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/0001_init.sql` **then** `0002_refactor.sql` in the SQL editor.
3. Copy `.env.example` to `.env` and fill in your project URL + anon key
   (Project Settings → API).

   > The anon key is a **public** client-side key — it is safe to embed in the app.

### 3. Google OAuth (3 places must agree)

The Google sign-in flow is: **app → Google → supabase.co callback → back into the app**
via the `armory://` deep link. For it to work, the same redirect value must be allowed in
**three** places:

**Supabase → Authentication → URL Configuration**
- **Site URL:** `armory://auth/callback`
- **Redirect URLs:** add
  - `armory://auth/callback`
  - `http://localhost:8081` (for web dev, optional)

**Supabase → Authentication → Providers → Google**
- Enable Google provider, paste your **Client ID** + **Client Secret**, save.

**Google Cloud Console → Credentials (OAuth client, type: Web application)**
- Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
  (using your project's own ref, e.g. `https://hfrdnqqdfyrdgroqcojt.supabase.co/auth/v1/callback`)

The app uses `skipBrowserRedirect`, opens an auth session, then exchanges the tokens with
`supabase.auth.setSession()` — see `src/lib/oauth.ts` and `app/auth/callback.tsx`.

> **Common pitfall:** if the callback lands on `localhost:3000` / an "unmatched route", it means
> the Supabase `redirect_to` value did not match what the app returns. The app computes
> `armory://auth/callback` as its redirect — make sure that exact value is whitelisted.

### 4. Local dev

```sh
npx expo start        # press a for Android, i for iOS, w for web
```

## Production APK build (EAS)

`eas.json` already contains the build profiles and the Supabase env vars for `production`.

### Prerequisites

```sh
npm install -g eas-cli        # if not installed
eas login                     # expo.dev account
```

### Build an installable APK (sideload onto your phone)

```sh
# Uploads to Expo's cloud, compiles native code, ~20–40 min
eas build --platform android --profile production
```

- When prompted / in the terminal, choose the **production** profile (or run the command above
  which explicitly uses `production`).
- Wait for **FINISHED**, then download the APK:

```sh
eas build:download --platform android --build-id <build-id>
```

Or grab the **Install** URL from the Expo dashboard / `eas build:list` and load it on your phone.
Tap it and allow **Install unknown apps** for your file manager.

> The production profile produces a **signed**, sideloadable APK
> (`android.buildType = "apk"`). It is **not** play-store-signed — distribute it directly to
> friends/devices.

### Other EAS profiles (`eas.json`)

- `production` — signed APK, bundle builds from the committed `env` in `eas.json`.
- `preview` — internal distribution APK (`distribution: internal`).
- `development` — Expo dev-client build for development.

### ⚠️ Env vars in cloud builds (important)

`.env` is git-ignored, so **EAS cloud builds never see its contents**. That's why the production
profile hard-codes `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` under
`eas.json → build.production.env`. If you change your Supabase project, update **both** `.env`
and `eas.json` together, then rebuild.

To use expo's own dashboard-managed envs instead (optional):

```sh
eas env:create EXPO_PUBLIC_SUPABASE_URL --scope project --environment production
```

## Common issues

| Symptom | Cause / fix |
| --- | --- |
| "Supabase not configured" in APK | Env vars missing at build time — add them to `eas.json` `env` and rebuild. |
| Google sign-in → `localhost:3000` | Redirect mismatch — whitelist `armory://auth/callback` in Supabase auth config. |
| Google sign-in → "unmatched route" | Missing `app/auth/callback.tsx` route (now included). |

## Scripts

```sh
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
npm run start         # expo start
npm run android       # expo start --android
npm run ios           # expo start --ios
npm run web           # expo start --web
```

## Extending beyond powerlifting

- `workouts.kind` defaults to `'strength'`; cardio sessions can reuse it (`kind='cardio'`)
- `workout_sets.distance_m` / `duration_s` columns already exist for runs
- `src/lib/exercises.ts` is the exercise catalog — add activities there and extend program logic
  in `src/lib/program.ts`
