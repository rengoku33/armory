export type Unit = 'kg' | 'lbs';

export type LiftId = 'squat' | 'bench' | 'row' | 'ohp' | 'deadlift';

export type WorkoutDay = 'A' | 'B';

export interface Profile {
  id: string;
  display_name: string | null;
  units: Unit;
  onboarded: boolean;
  starting_weights: Record<string, number>;
}

export interface Workout {
  id: string;
  user_id: string;
  day: WorkoutDay;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise: LiftId;
  set_index: number;
  target_weight: number;
  target_reps: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
}

export interface SetLogInput {
  weight?: number;
  reps?: number;
  completed?: boolean;
}

export interface PlannedExercise {
  lift: LiftId;
  sets: number;
  reps: number;
  weight: number;
}
