-- Armory · StrongLifts 5x5 tracker
-- Run this in the Supabase SQL editor (or via supabase db push).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  units text not null default 'kg' check (units in ('kg', 'lbs')),
  onboarded boolean not null default false,
  starting_weights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'strength',
  program text not null default 'sl5x5',
  day text not null check (day in ('A', 'B')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise text not null check (exercise in ('squat', 'bench', 'row', 'ohp', 'deadlift')),
  set_index integer not null,
  target_weight numeric not null,
  target_reps integer not null,
  weight numeric,
  reps integer,
  completed boolean not null default false,
  distance_m numeric,
  duration_s integer,
  unique (workout_id, exercise, set_index)
);

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "workouts_all_own"
  on public.workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "workout_sets_all_own"
  on public.workout_sets for all
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
create index workout_sets_workout_idx on public.workout_sets (workout_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
