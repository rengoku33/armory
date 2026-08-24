import { supabase } from './supabase';
import { EXERCISES, liftsForDay } from './exercises';
import {
  LiftId,
  Profile,
  SetLogInput,
  Unit,
  Workout,
  WorkoutDay,
  WorkoutSet,
} from './types';

interface ProfileRow {
  id: string;
  display_name: string | null;
  units: string;
  onboarded: boolean;
  starting_weights: Record<string, number> | null;
}

interface WorkoutRow {
  id: string;
  user_id: string;
  day: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

interface SetRow {
  id: string;
  workout_id: string;
  exercise: string;
  set_index: number | string;
  target_weight: number | string;
  target_reps: number | string;
  weight: number | string | null;
  reps: number | string | null;
  completed: boolean | null;
}

function num(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    display_name: row.display_name,
    units: row.units === 'lbs' ? 'lbs' : 'kg',
    onboarded: row.onboarded,
    starting_weights: row.starting_weights ?? {},
  };
}

function mapWorkout(r: WorkoutRow): Workout {
  return {
    id: r.id,
    user_id: r.user_id,
    day: r.day === 'B' ? 'B' : 'A',
    started_at: r.started_at,
    completed_at: r.completed_at,
    notes: r.notes,
  };
}

function mapSet(r: SetRow): WorkoutSet {
  const exercise = (r.exercise in EXERCISES ? r.exercise : 'squat') as LiftId;
  return {
    id: r.id,
    workout_id: r.workout_id,
    exercise,
    set_index: num(r.set_index) ?? 1,
    target_weight: num(r.target_weight) ?? 0,
    target_reps: num(r.target_reps) ?? 5,
    weight: num(r.weight),
    reps: num(r.reps),
    completed: Boolean(r.completed),
  };
}

function orderSets(sets: WorkoutSet[], day: WorkoutDay): WorkoutSet[] {
  const order = liftsForDay(day);
  return [...sets].sort(
    (a, b) => order.indexOf(a.exercise) - order.indexOf(b.exercise) || a.set_index - b.set_index
  );
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function saveOnboarding(
  userId: string,
  units: Unit,
  startingWeights: Record<string, number>
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ units, starting_weights: startingWeights, onboarded: true })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateUnits(userId: string, units: Unit): Promise<void> {
  const { error } = await supabase.from('profiles').update({ units }).eq('id', userId);
  if (error) throw error;
}

export async function createWorkout(
  userId: string,
  day: WorkoutDay,
  targets: { lift: LiftId; sets: number; reps: number; weight: number }[]
): Promise<Workout> {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, day })
    .select('*')
    .single();
  if (error) throw error;
  const workout = mapWorkout(data as WorkoutRow);
  const rows = targets.flatMap((t) =>
    Array.from({ length: t.sets }, (_, i) => ({
      workout_id: workout.id,
      exercise: t.lift,
      set_index: i + 1,
      target_weight: t.weight,
      target_reps: t.reps,
    }))
  );
  const { error: setsError } = await supabase.from('workout_sets').insert(rows);
  if (setsError) throw setsError;
  return workout;
}

export async function fetchOpenWorkout(userId: string): Promise<Workout | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapWorkout(data as WorkoutRow) : null;
}

export async function fetchWorkoutWithSets(
  workoutId: string
): Promise<{ workout: Workout; sets: WorkoutSet[] } | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', workoutId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const workout = mapWorkout(data as WorkoutRow);
  const { data: setData, error: setError } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('workout_id', workoutId);
  if (setError) throw setError;
  const sets = ((setData ?? []) as SetRow[]).map(mapSet);
  return { workout, sets: orderSets(sets, workout.day) };
}

export async function logSet(setId: string, input: SetLogInput): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.weight !== undefined) patch.weight = input.weight;
  if (input.reps !== undefined) patch.reps = input.reps;
  if (input.completed !== undefined) patch.completed = input.completed;
  const { error } = await supabase.from('workout_sets').update(patch).eq('id', setId);
  if (error) throw error;
}

export async function completeWorkout(id: string): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function discardWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchHistory(
  userId: string,
  limit = 150
): Promise<{ workouts: Workout[]; sets: WorkoutSet[] }> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const workouts = ((data ?? []) as WorkoutRow[]).map(mapWorkout);
  if (workouts.length === 0) return { workouts, sets: [] };
  const ids = workouts.map((w) => w.id);
  const { data: setData, error: setError } = await supabase
    .from('workout_sets')
    .select('*')
    .in('workout_id', ids);
  if (setError) throw setError;
  const sets = ((setData ?? []) as SetRow[]).map(mapSet);
  return { workouts, sets };
}
