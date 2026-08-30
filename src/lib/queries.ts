import { supabase } from './supabase';
import { EXERCISES, DEFAULT_TEMPLATE, isBuiltIn } from './exercises';
import {
  ExerciseKey,
  PlannedExercise,
  Profile,
  SetLogInput,
  Unit,
  Workout,
  WorkoutDay,
  WorkoutExercise,
  WorkoutSet,
  WorkoutTemplate,
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
  exercise_name: string | null;
  is_custom: boolean | null;
  exercise_order: number | string | null;
  set_index: number | string;
  target_weight: number | string;
  target_reps: number | string;
  weight: number | string | null;
  reps: number | string | null;
  completed: boolean | null;
}

interface TemplateRow {
  id: string;
  user_id: string;
  workout: string;
  exercise_key: string;
  name: string;
  is_custom: boolean | null;
  sets: number | string;
  reps: number | string;
  sort_order: number | string;
}

function num(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function int(v: number | string | null, fallback: number): number {
  const n = num(v);
  return n == null ? fallback : Math.round(n);
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    display_name: row.display_name,
    units: row.units === 'lbs' ? 'lbs' : 'kg',
    onboarded: row.onboarded,
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
  const key = r.exercise;
  const knownName = isBuiltIn(key) ? EXERCISES[key as keyof typeof EXERCISES].name : null;
  return {
    id: r.id,
    workout_id: r.workout_id,
    exercise: key,
    exercise_name: r.exercise_name ?? knownName ?? key,
    is_custom: Boolean(r.is_custom),
    exercise_order: int(r.exercise_order, 0),
    set_index: int(r.set_index, 1),
    target_weight: num(r.target_weight) ?? 0,
    target_reps: int(r.target_reps, 5),
    weight: num(r.weight),
    reps: num(r.reps),
    completed: Boolean(r.completed),
  };
}

function mapTemplate(r: TemplateRow, day: WorkoutDay): WorkoutExercise {
  return {
    key: r.exercise_key,
    name: r.name,
    isCustom: Boolean(r.is_custom),
    sets: int(r.sets, 5),
    reps: int(r.reps, 5),
  };
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

export async function saveOnboarding(userId: string, units: Unit): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ units, onboarded: true })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateUnits(userId: string, units: Unit): Promise<void> {
  const { error } = await supabase.from('profiles').update({ units }).eq('id', userId);
  if (error) throw error;
}

// ---------- Workout templates ----------

async function fetchTemplateRows(userId: string): Promise<TemplateRow[]> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TemplateRow[];
}

export async function fetchTemplates(userId: string): Promise<WorkoutTemplate> {
  const rows = await fetchTemplateRows(userId);
  if (rows.length > 0) {
    const A: WorkoutExercise[] = [];
    const B: WorkoutExercise[] = [];
    for (const r of rows) {
      (r.workout === 'B' ? B : A).push(mapTemplate(r, r.workout === 'B' ? 'B' : 'A'));
    }
    return { A, B };
  }
  return seedTemplates(userId);
}

// Seed the default A/B templates for a brand-new user.
export async function seedTemplates(userId: string): Promise<WorkoutTemplate> {
  const rows: Omit<TemplateRow, 'id'>[] = [];
  for (const day of ['A', 'B'] as WorkoutDay[]) {
    DEFAULT_TEMPLATE[day].forEach((key, idx) => {
      rows.push({
        user_id: userId,
        workout: day,
        exercise_key: key,
        name: EXERCISES[key].name,
        is_custom: false,
        sets: EXERCISES[key].sets,
        reps: EXERCISES[key].reps,
        sort_order: idx,
      });
    });
  }
  const { error } = await supabase.from('workout_exercises').insert(rows);
  if (error) throw error;
  return fetchTemplates(userId);
}

export async function addExerciseToTemplate(
  userId: string,
  day: WorkoutDay,
  exercise: { key: ExerciseKey; name: string; isCustom: boolean; sets: number; reps: number }
): Promise<void> {
  const current = await fetchTemplateRows(userId);
  const dayRows = current.filter((r) => r.workout === day);
  const exists = dayRows.some((r) => r.exercise_key === exercise.key);
  if (exists) return;
  const sortOrder = dayRows.length;
  const { error } = await supabase
    .from('workout_exercises')
    .insert({
      user_id: userId,
      workout: day,
      exercise_key: exercise.key,
      name: exercise.name,
      is_custom: exercise.isCustom,
      sets: exercise.sets,
      reps: exercise.reps,
      sort_order: sortOrder,
    });
  if (error) throw error;
}

export async function updateTemplateExercise(
  userId: string,
  day: WorkoutDay,
  key: ExerciseKey,
  patch: Partial<Pick<WorkoutExercise, 'name' | 'sets' | 'reps'>>
): Promise<void> {
  const { error } = await supabase
    .from('workout_exercises')
    .update(patch)
    .eq('user_id', userId)
    .eq('workout', day)
    .eq('exercise_key', key);
  if (error) throw error;
}

export async function reorderTemplateExercise(
  userId: string,
  day: WorkoutDay,
  key: ExerciseKey,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('workout_exercises')
    .update({ sort_order: sortOrder })
    .eq('user_id', userId)
    .eq('workout', day)
    .eq('exercise_key', key);
  if (error) throw error;
}

export async function removeTemplateExercise(
  userId: string,
  day: WorkoutDay,
  key: ExerciseKey
): Promise<void> {
  const { error } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('user_id', userId)
    .eq('workout', day)
    .eq('exercise_key', key);
  if (error) throw error;
  // resequence sort_order so there are no gaps/dups
  const rows = (await fetchTemplateRows(userId))
    .filter((r) => r.workout === day)
    .sort((a, b) => int(a.sort_order, 0) - int(b.sort_order, 0));
  for (let i = 0; i < rows.length; i++) {
    if (int(rows[i].sort_order, 0) !== i) {
      await supabase
        .from('workout_exercises')
        .update({ sort_order: i })
        .eq('id', rows[i].id);
    }
  }
}

// ---------- Custom exercises ----------

export async function createCustomExercise(userId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('custom_exercises')
    .insert({ user_id: userId, name: name.trim() })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

// ---------- Workouts ----------

export async function createWorkout(
  userId: string,
  day: WorkoutDay,
  planned: PlannedExercise[],
  startedAt?: Date
): Promise<Workout> {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, day, started_at: (startedAt ?? new Date()).toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  const workout = mapWorkout(data as WorkoutRow);

  const rows: Record<string, unknown>[] = [];
  planned.forEach((ex, orderIdx) => {
    if (ex.sets <= 0) return;
    for (let i = 0; i < ex.sets; i++) {
      rows.push({
        workout_id: workout.id,
        exercise: ex.key,
        exercise_name: ex.name,
        is_custom: ex.isCustom,
        exercise_order: orderIdx,
        set_index: i + 1,
        target_weight: ex.weight,
        target_reps: ex.reps,
      });
    }
  });
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
    .eq('workout_id', workoutId)
    .order('exercise_order', { ascending: true })
    .order('set_index', { ascending: true });
  if (setError) throw setError;
  const sets = ((setData ?? []) as SetRow[]).map(mapSet);
  return { workout, sets };
}

export async function logSet(setId: string, input: SetLogInput): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.weight !== undefined) patch.weight = input.weight;
  if (input.reps !== undefined) patch.reps = input.reps;
  if (input.completed !== undefined) patch.completed = input.completed;
  const { error } = await supabase.from('workout_sets').update(patch).eq('id', setId);
  if (error) throw error;
}

export async function deleteSet(setId: string): Promise<void> {
  const { error } = await supabase.from('workout_sets').delete().eq('id', setId);
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

// Last successfully used weight for each exercise, to suggest on the next workout.
export async function fetchLastWeights(
  userId: string
): Promise<Record<ExerciseKey, number>> {
  const { workouts, sets } = await fetchHistory(userId);
  const doneIds = new Set(workouts.filter((w) => w.completed_at).map((w) => w.id));
  const out: Record<string, number> = {};
  for (const s of sets) {
    if (!doneIds.has(s.workout_id)) continue;
    if (!s.completed) continue;
    const w = s.weight ?? 0;
    if (w <= 0) continue;
    out[s.exercise] = Math.max(out[s.exercise] ?? 0, w);
  }
  return out;
}
