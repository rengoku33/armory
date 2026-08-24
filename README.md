# Armory

StrongLifts 5×5 powerlifting tracker. Web + native mobile from one Expo codebase.
OAuth sign-in (Google), every row of workout data scoped to the signed-in user via Postgres RLS.

## Stack

- Expo SDK 57 / React Native 0.86 / TypeScript (expo-router)
- Supabase: auth (Google OAuth + email fallback), Postgres storage, Row Level Security
- react-native-gifted-charts + react-native-svg for progress graphs

## Features

- Workout A/B alternation: A = Squat/Bench/Row 5×5 · B = Squat/OHP/Deadlift 1×5
- Auto-progression: +2.5 kg per successful session (+5 kg deadlift), lbs equivalents
- Failure tracking with automatic 10% deload after 3 failed sessions at a weight
- Warmup ramps, plate calculator, rest timer with countdown ring
- History log grouped by month, tap-through to full session detail
- Progress charts per lift: top weight / estimated 1RM (Epley) / volume

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Copy `.env.example` to `.env` and fill in your project URL + anon key
   (Project Settings → API).

### 2. Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com) create an OAuth client
   (type: Web application).
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. In Supabase Dashboard → Authentication → Providers → Google, paste the client ID +
   secret and save.
4. Authentication → URL Configuration → Redirect URLs, add:
   - `armory://auth/callback`
   - your dev origin, e.g. `http://localhost:8081` (web)
   - your Expo Go redirect printed by the app if needed (`exp://...`)

The app requests `skipBrowserRedirect`, opens an auth session, then exchanges the tokens
with `supabase.auth.setSession()` — see `src/lib/oauth.ts`.

### 3. Run

```sh
npm install
npx expo start        # press w for web, a for Android, i for iOS
```

## Extending beyond powerlifting

- `workouts.kind` defaults to `'strength'`; cardio sessions can reuse it (`kind='cardio'`)
- `workout_sets.distance_m` / `duration_s` columns already exist for runs
- `src/lib/exercises.ts` is the catalog — add activities there and extend program logic in `src/lib/program.ts`

## Scripts

```sh
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
```
