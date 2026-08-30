import { ExerciseKey, LiftId } from './types';

export interface ExerciseDef {
  id: LiftId;
  name: string;
  short: string;
  sets: number;
  reps: number;
}

export const EXERCISES: Record<LiftId, ExerciseDef> = {
  squat: { id: 'squat', name: 'Barbell Squat', short: 'SQ', sets: 5, reps: 5 },
  bench: { id: 'bench', name: 'Bench Press', short: 'BP', sets: 5, reps: 5 },
  row: { id: 'row', name: 'Barbell Row', short: 'ROW', sets: 5, reps: 5 },
  ohp: { id: 'ohp', name: 'Overhead Press', short: 'OHP', sets: 5, reps: 5 },
  deadlift: { id: 'deadlift', name: 'Deadlift', short: 'DL', sets: 1, reps: 5 },
};

export const LIFT_ORDER: LiftId[] = ['squat', 'bench', 'row', 'ohp', 'deadlift'];

export const BUILTIN_KEYS: LiftId[] = [...LIFT_ORDER];

export function isBuiltIn(key: ExerciseKey): boolean {
  return key in EXERCISES;
}

export function builtinName(key: ExerciseKey): string | null {
  return isBuiltIn(key) ? EXERCISES[key as LiftId].name : null;
}

// Default templates a brand-new user starts with.
// A — Squat, Bench, Overhead Press · B — Squat, Barbell Row, Deadlift.
export const DEFAULT_TEMPLATE: { A: LiftId[]; B: LiftId[] } = {
  A: ['squat', 'bench', 'ohp'],
  B: ['squat', 'row', 'deadlift'],
};
