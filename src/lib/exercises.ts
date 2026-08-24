import { LiftId } from './types';

export interface ExerciseDef {
  id: LiftId;
  name: string;
  short: string;
  sets: number;
  reps: number;
  restSec: number;
  group: string;
}

export const EXERCISES: Record<LiftId, ExerciseDef> = {
  squat: { id: 'squat', name: 'Barbell Squat', short: 'SQ', sets: 5, reps: 5, restSec: 150, group: 'Legs' },
  bench: { id: 'bench', name: 'Bench Press', short: 'BP', sets: 5, reps: 5, restSec: 150, group: 'Push' },
  row: { id: 'row', name: 'Barbell Row', short: 'ROW', sets: 5, reps: 5, restSec: 90, group: 'Pull' },
  ohp: { id: 'ohp', name: 'Overhead Press', short: 'OHP', sets: 5, reps: 5, restSec: 150, group: 'Push' },
  deadlift: { id: 'deadlift', name: 'Deadlift', short: 'DL', sets: 1, reps: 5, restSec: 180, group: 'Hinge' },
};

export const LIFT_ORDER: LiftId[] = ['squat', 'bench', 'row', 'ohp', 'deadlift'];

export const WORKOUT_A: LiftId[] = ['squat', 'bench', 'row'];

export const WORKOUT_B: LiftId[] = ['squat', 'ohp', 'deadlift'];

export function liftsForDay(day: 'A' | 'B'): LiftId[] {
  return day === 'A' ? WORKOUT_A : WORKOUT_B;
}
