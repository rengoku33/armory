-- Armory refactor: editable A/B templates + custom exercises
-- Run this in the Supabase SQL editor (or via supabase db push) after 0001_init.sql.

-- 1. Custom user-defined exercises (e.g. "Chest Press Machine").
create table public.custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- 2. Per-user workout templates: what belongs in Workout A and Workout B.
--    `exercise_key` is either a built-in slug ('squat', 'bench', 'ohp', 'row', 'deadlift')
--    or the uuid of a row in custom_exercises.
create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout text not null check (workout in ('A', 'B')),
  exercise_key text not null,
  name text not null,
  is_custom boolean not null default false,
  sets integer not null default 5,
  reps integer not null default 5,
  sort_order integer not null default 0,
  unique (user_id, workout, exercise_key),
  unique (user_id, workout, sort_order)
);

-- 3. worktout_sets: allow custom exercise keys and store display name.
alter table public.workout_sets drop constraint if exists workout_sets_exercise_check;
alter table public.workout_sets add column exercise_name text;
alter table public.workout_sets add column is_custom boolean not null default false;
alter table public.workout_sets add column exercise_order integer not null default 0;

-- Backfill names for existing built-in sets.
update public.workout_sets
set exercise_name = case exercise
  when 'squat' then 'Barbell Squat'
  when 'bench' then 'Bench Press'
  when 'ohp' then 'Overhead Press'
  when 'row' then 'Barbell Row'
  when 'deadlift' then 'Deadlift'
  else exercise
end
where exercise_name is null;

-- 4. Row level security for the new tables.
alter table public.custom_exercises enable row level security;
alter table public.workout_exercises enable row level security;

create policy "custom_exercises_all_own"
  on public.custom_exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "workout_exercises_all_own"
  on public.workout_exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index workout_exercises_user_idx on public.workout_exercises (user_id, workout, sort_order);
create index custom_exercises_user_idx on public.custom_exercises (user_id);
