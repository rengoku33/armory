export type Unit = 'kg' | 'lbs';

export type WorkoutDay = 'A' | 'B';

// Built-in exercise ids (StrongLifts-style 5x5 core).
export type LiftId = 'squat' | 'bench' | 'row' | 'ohp' | 'deadlift';

// Any exercise key: a built-in slug or a custom exercise uuid.
export type ExerciseKey = string;

export interface Profile {
  id: string;
  display_name: string | null;
  units: Unit;
  onboarded: boolean;
}

// A single exercise inside a workout template (A or B).
export interface WorkoutExercise {
  key: ExerciseKey;
  name: string;
  isCustom: boolean;
  sets: number;
  reps: number;
}

export interface WorkoutTemplate {
  A: WorkoutExercise[];
  B: WorkoutExercise[];
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
  exercise: ExerciseKey;
  exercise_name: string;
  is_custom: boolean;
  exercise_order: number;
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

// A planned exercise for an upcoming workout, with a suggested working weight.
export interface PlannedExercise {
  key: ExerciseKey;
  name: string;
  isCustom: boolean;
  sets: number;
  reps: number;
  weight: number;
}

export interface CustomExercise {
  id: string;
  name: string;
}
