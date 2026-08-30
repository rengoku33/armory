# Armory — Developer Guide

Everything a developer needs to understand how **Armory** works under the hood: the database,
how modules are wired together, what SQL each screen fires, how the UI renders, and the tech
stack. This is a **code walkthrough** — for setup, OAuth config, and building the APK see
[`README.md`](./README.md).

---

## 1. Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript |
| Framework | **Expo SDK 57** (managed) + React Native 0.86 |
| Navigation | **expo-router** (file-based) |
| Backend / DB | **Supabase** (Postgres + Auth + Row Level Security) |
| Auth | Supabase Auth: **Google OAuth** + email/password fallback |
| Charts | react-native-gifted-charts + react-native-svg |
| Animations | react-native-reanimated |
| Icons | @expo/vector-icons (Ionicons) |
| Dates | date-fns |
| Persistence (auth tokens) | @react-native-async-storage/async-storage |
| Networking | @supabase/supabase-js + react-native-url-polyfill |
| Haptics | expo-haptics |
| Build | **EAS** (Expo Application Services), profiles in `eas.json` |

Entry point is `expo-router/entry` (`package.json` `"main"`), which boots the `app/` directory.

---

## 2. Data model (Supabase / Postgres)

Migrations live in `supabase/migrations/` in order. **RLS is enabled on every table** — a user can
only ever read/write their own rows.

### `profiles` (`0001_init.sql`)
One row per auth user (created automatically by the `handle_new_user()` trigger on
`auth.users` insert).

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | = `auth.users.id`, FK cascade |
| `display_name` | text | |
| `units` | text | `'kg' \| 'lbs'`, default `'kg'` |
| `onboarded` | bool | gates the onboarding screen |
| `starting_weights` | jsonb | reserved; not actively used |
| `created_at` | timestamptz | |

### `workouts` (`0001_init.sql`)
A single training session, either **A** or **B**.

| column | type |
| --- | --- |
| `id` | uuid PK (gen_random_uuid) |
| `user_id` | uuid FK → auth.users |
| `kind` | text default `'strength'` |
| `program` | text default `'sl5x5'` |
| `day` | text `'A' \| 'B'` |
| `started_at` / `completed_at` | timestamptz (completed_at null = in progress) |
| `notes` | text |

### `workout_sets` (`0001_init.sql` + `0002_refactor.sql`)
The individual lifts inside a workout.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `workout_id` | uuid FK → workouts (cascade) | |
| `exercise` | text | built-in slug **or** custom uuid |
| `exercise_name` | text | denormalized display name (added in refactor) |
| `is_custom` | bool | added in refactor |
| `exercise_order` | int | grouping/order within the workout (refactor) |
| `set_index` | int | nth set of this exercise |
| `target_weight` / `target_reps` | numeric / int | what the plan says |
| `weight` / `reps` | numeric / int | what was actually logged |
| `completed` | bool | |
| `distance_m` / `duration_s` | numeric / int | reserved (cardio/runs) |

Unique constraint: `(workout_id, exercise, set_index)`.

### `workout_exercises` (`0002_refactor.sql`) — editable A/B templates
Per-user list of which exercises belong in Workout **A** and **B**, and their order/sets/reps.

| column | notes |
| --- | --- |
| `user_id` | FK auth.users |
| `workout` | `'A' \| 'B'` |
| `exercise_key` | built-in slug or custom-exercise uuid |
| `name` | display name |
| `is_custom` | bool |
| `sets` / `reps` | int, defaults 5 / 5 |
| `sort_order` | int (unique per user+workout) |

### `custom_exercises` (`0002_refactor.sql`)
| column | notes |
| --- | --- |
| `id` | uuid PK — the value used as `exercise_key` / `exercise` for custom lifts |
| `user_id` | FK auth.users |
| `name` | text |
| `created_at` | timestamptz |

### Row Level Security
Policies (`0001` + `0002`) enforce "own rows only":
- `profiles` — select/update where `auth.uid() = id`
- `workouts` — all ops where `auth.uid() = user_id`
- `workout_sets` — through the parent: `exists(select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())`
- `workout_exercises`, `custom_exercises` — where `auth.uid() = user_id`

There is **no insert policy on `profiles`** because rows are created by the security-definer
trigger, not the client.

---

## 3. Module / file map

```
src/
  theme.ts               # design tokens: colors, spacing (space), radius
  lib/
    supabase.ts          # Supabase client singleton + SUPABASE_URL/ANON_KEY + supabaseConfigured
    oauth.ts             # Google OAuth flow (signInWithGoogle, oauthRedirectUri)
    queries.ts           # ALL database access (the data layer)
    exercises.ts         # built-in exercise catalog + default A/B templates
    program.ts           # day scheduling + weight suggestion (nextDay, buildPlan)
    weights.ts           # kg/lbs bar weight, plate rounding, formatting, e1rm
    warmups.ts           # warmup ramp computation
    plates.ts            # per-side plate breakdown + colors
    types.ts             # shared TS models
  store/
    auth.tsx             # React context: session + profile state, sign in/out
  components/
    ui.tsx               # design system primitives (Button, Card, Field, Stepper, etc.)
    ChartLine.tsx        # GIFtedCharts line chart wrapper
    RestTimer.tsx        # countdown ring component
    PlateCalculatorModal.tsx  # plate breakdown bottom sheet

app/                     # expo-router routes (file = route)
  _layout.tsx            # root Stack, wraps app in <AuthProvider>
  index.tsx              # entry guard: setup notice -> splash -> login/onboarding/today
  login.tsx / signup.tsx # auth screens (Google + email)
  onboarding.tsx         # first-run: pick kg/lbs
  edit-workout.tsx       # edit A/B templates, reorder, add built-in/custom exercises
  (tabs)/                # tab group (Today, History, Progress, Settings)
    _layout.tsx          # bottom Tab bar
    today.tsx            # plan + start a workout / resume open workout
    history.tsx          # past sessions, grouped by month
    progress.tsx         # per-lift charts (weight / e1rm / volume)
    settings.tsx         # account info, units, sign out
  workout/[id].tsx       # active/completed workout player (log sets, rest timer)
  auth/callback.tsx      # Google OAuth deep-link return handler
```

---

## 4. Data flow: how the pieces are wired

### Startup / auth gating
1. `app/_layout.tsx` mounts `<AuthProvider>` around the Stack.
2. `store/auth.tsx` on mount calls `supabase.auth.getSession()`, sets `session`/`profile`, and
   registers an `onAuthStateChange` listener. Every session change re-fetches the profile.
3. `app/index.tsx` decides what to show:
   - `!supabaseConfigured` → "Supabase not configured" notice
   - `loading` → splash
   - `!session` → redirect to `/login`
   - `!profile` → "could not load profile" + sign out
   - `!profile.onboarded` → redirect `/onboarding`
   - else → redirect to `/(tabs)/today`

### Google sign-in (the OAuth circle)
`src/lib/oauth.ts`:
1. `oauthRedirectUri()` → `makeRedirectUri({ native: 'armory://auth/callback', path: 'auth/callback' })` → **`armory://auth/callback`**.
2. `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo, skipBrowserRedirect:true } })` returns a direct Google auth URL.
3. `WebBrowser.openAuthSessionAsync(url, redirectTo)` opens Google in a browser. After consent,
   Google → **supabase.co callback** → redirects back to `armory://auth/callback#access_token=...&refresh_token=...`.
4. `QueryParams.getQueryParams(res.url)` merges both `?query` and `#fragment` params.
5. `supabase.auth.setSession({ access_token, refresh_token })` completes the session.
6. `app/auth/callback.tsx` is a safety-net route so a bare `armory://auth/callback` deep link is
   never an "unmatched route" — it re-reads the tokens and swaps the session.

Requires the redirect to be allowed in **3 places** (see README "Google OAuth"): Supabase Site URL,
Supabase Redirect URLs, and the Google Cloud OAuth client's authorized redirect URI.

### Today → plan → workout
`app/(tabs)/today.tsx`:
1. `useFocusEffect` → `load()` runs 4 queries in parallel:
   - `fetchTemplates` → editable A/B template (or seeds it on first use)
   - `fetchHistory` → past workouts
   - `fetchLastWeights` → last completed working weight per exercise
   - `fetchOpenWorkout` → any unfinished session
2. `nextDay(lastCompletedDay)` picks the next day (alternates A/B, starts at A).
3. `buildPlan(template[A|B], lastWeights)` returns `PlannedExercise[]` with a suggested weight
   (= last lifted weight, or "new"/0).
4. Tapping **Log Workout** → `createWorkout(userId, day, plan, date)` inserts a `workouts` row +
   one `workout_sets` row per set with `target_weight`/`target_reps`, then routes to
   `workout/[id]`.

### Workout player (`app/workout/[id].tsx`)
- Loads `fetchWorkoutWithSets(id)` → workout meta + all sets ordered by `exercise_order`, `set_index`.
- **Tap** a set → `quickLog` → `logSet(id, { weight, reps, completed:true })` (uses target if nothing yet).
- **Long-press** → bottom sheet to adjust weight/reps (or delete) → `logSet` / `deleteSet`.
- Sets below target reps render as **missed** (danger color).
- **Finish** → `completeWorkout(id)` sets `completed_at` and routes back to Today.
- **Trash** → `discardWorkout(id)` deletes the workout (and sets, via cascade).

### Edit Workout (`app/edit-workout.tsx`)
- Loads template via `fetchTemplates`.
- Reorder: `reorderTemplateExercise` (swaps `sort_order`).
- Edit name/sets/reps: `updateTemplateExercise`.
- Remove: `removeTemplateExercise` (then resequences `sort_order`).
- Add built-in: `addExerciseToTemplate`.
- Add custom: `createCustomExercise` returns the uuid → `addExerciseToTemplate` with
  `key = uuid`, `is_custom = true`.

### Progress (`app/(tabs)/progress.tsx`)
- `fetchHistory` + `fetchTemplates` → per-exercise chips.
- For each completed workout, computes per-exercise `topWeight`, `e1rm` (Epley: `w*(1+reps/30)`),
  and `volume` (Σ weight×reps) → `ChartLine` (gifted-charts).
- `stats` card shows current / best / % deltas.

### History (`app/(tabs)/history.tsx`)
- `fetchHistory(userId, limit)` → workouts + sets; grouped by month client-side.

### Settings (`app/(tabs)/settings.tsx`)
- Shows account email; `updateUnits` swaps kg/lbs + `refreshProfile`; sign out via `supabase.auth.signOut()`.

---

## 5. The data layer — `src/lib/queries.ts`

This file is the **only** place that talks to Supabase tables. Every function maps raw rows →
typed models (`mapProfile`, `mapWorkout`, `mapSet`, `mapTemplate`). Key functions:

| Function | SQL it effectively runs | Used by |
| --- | --- | --- |
| `fetchProfile` | select from `profiles` where `id` | auth store |
| `saveOnboarding` / `updateUnits` | update `profiles` | onboarding, settings |
| `fetchTemplates` | select `workout_exercises` order by `sort_order`; seeds if empty (`seedTemplates`) | today, edit, progress |
| `addExerciseToTemplate` | insert into `workout_exercises` (skips dupes) | edit-workout |
| `updateTemplateExercise` / `reorderTemplateExercise` | update `workout_exercises` | edit-workout |
| `removeTemplateExercise` | delete `workout_exercises` + resequence | edit-workout |
| `createCustomExercise` | insert into `custom_exercises` (+`.select().single()`) | edit-workout |
| `createWorkout` | insert `workouts` + bulk insert `workout_sets` | today |
| `fetchOpenWorkout` | select `workouts` where `completed_at is null` limit 1 | today |
| `fetchWorkoutWithSets` | select `workouts` + sets by `workout_id` | workout/[id] |
| `logSet` / `deleteSet` | update/delete `workout_sets` | workout/[id] |
| `completeWorkout` / `discardWorkout` | update/delete `workouts` | workout/[id] |
| `fetchHistory` | select `workouts` order started_at desc limit 150 + sets `.in(workout_id)` | history, progress |
| `fetchLastWeights` | derived from `fetchHistory` (max completed weight per exercise) | today |

---

## 6. Program & lifting math (`src/lib`)

- **`program.ts`** — there is **no auto-progression or deload logic**. "You log what you lift."
  `nextDay()` alternates A/B; `suggestWeight()` reuses your last working weight or marks it new;
  `buildPlan()` assembles the planned day.
- **`weights.ts`** — `BAR_WEIGHT` (kg 20 / lbs 45), `SMALLEST_PLATE` (1.25 / 2.5), plate-increment
  rounding (`roundWeight`, `floorWeight`), `e1rm` (Epley), formatting helpers.
- **`warmups.ts`** — `warmupSets(work, unit)` → empty-bar 5 reps then 40%/60%/80% ramps.
- **`plates.ts`** — `platesPerSide(total, unit)` → per-side plate denominations + colors; `breakdownLabel`.
- **`exercises.ts`** — the built-in catalog (`squat/bench/row/ohp/deadlift`) and `DEFAULT_TEMPLATE`.

---

## 7. UI rendering

- **Theme** (`src/theme.ts`): dark palette (`colors.bg #0A0D12`, accent `#FF5C38`), spacing scale
  via `space(n)`, `radius`.
- **Design system** (`src/components/ui.tsx`): `Button`, `Card`, `Field`, `Stepper`, `Segmented`,
  `Chip`, `Badge`, `ConfirmDialog`, `Title/Heading/Body`.
- **Special components**:
  - `RestTimer` — `react-native-svg` circular countdown, `+15s` / SKIP, haptic on done.
  - `PlateCalculatorModal` — plate breakdown bottom sheet.
  - `ChartLine` — `react-native-gifted-charts` line/area chart with y-axis offset.
- **Navigation**: root `Stack` + bottom `Tabs`. Screens use `useFocusEffect` to reload data on
  focus (so history/progress stay fresh after a workout).

---

## 8. Environment & build

- Env vars are read with `process.env.EXPO_PUBLIC_*` (inlined at build time).
  Local copy: `.env` (git-ignored). Cloud builds get them from `eas.json → build.production.env`.
- Since `.env` is git-ignored, **add any `EXPO_PUBLIC_*` values to `eas.json` too** or they'll be
  absent in the APK.
- See `README.md` for the full EAS production-build guide.

---

## 9. Useful commands

```sh
npm install           # deps
npm run start         # expo start (a=android, i=ios, w=web)
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
eas login
eas build --platform android --profile production   # signed sideload APK
```
