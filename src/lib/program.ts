import { WorkoutDay, WorkoutTemplate, WorkoutExercise, PlannedExercise } from './types';

// No automatic weight bumping or deloads — you log what you lift.
// The only "logic" is scheduling the next day and suggesting weights.

export function otherDay(day: WorkoutDay): WorkoutDay {
  return day === 'A' ? 'B' : 'A';
}

// Work out which day comes next based on the most recent completed workout.
// With no history we start on Workout A.
export function nextDay(lastCompletedDay: WorkoutDay | null): WorkoutDay {
  return lastCompletedDay ? otherDay(lastCompletedDay) : 'A';
}

// Suggest a working weight for an exercise.
// Prefer the most recent real weight that was actually lifted for this exercise,
// falling back to it being "new" (0) for a first-time lift.
export interface Suggestion {
  weight: number;
  isNew: boolean;
}

export function suggestWeight(lastWeight: number | undefined): Suggestion {
  if (!lastWeight || lastWeight <= 0) return { weight: 0, isNew: true };
  return { weight: lastWeight, isNew: false };
}

export function buildPlan(
  template: WorkoutExercise[],
  lastWeights: Record<string, number>
): PlannedExercise[] {
  return template
    .map((ex) => {
      return {
        key: ex.key,
        name: ex.name,
        isCustom: ex.isCustom,
        sets: ex.sets,
        reps: ex.reps,
        weight: suggestWeight(lastWeights[ex.key]).weight,
      };
    })
    .filter((p) => p.sets > 0);
}

export function dayKey(day: WorkoutDay, template: WorkoutTemplate): WorkoutExercise[] {
  return day === 'A' ? template.A : template.B;
}
