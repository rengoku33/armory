import { EXERCISES, LIFT_ORDER, liftsForDay } from './exercises';
import { floorWeight } from './weights';
import { LiftId, PlannedExercise, Unit, Workout, WorkoutDay, WorkoutSet } from './types';

export const INCREMENTS: Record<Unit, Record<LiftId, number>> = {
  kg: { squat: 2.5, bench: 2.5, row: 2.5, ohp: 2.5, deadlift: 5 },
  lbs: { squat: 5, bench: 5, row: 5, ohp: 5, deadlift: 10 },
};

export const DEFAULT_STARTING: Record<Unit, Record<LiftId, number>> = {
  kg: { squat: 20, bench: 30, row: 30, ohp: 20, deadlift: 40 },
  lbs: { squat: 45, bench: 65, row: 65, ohp: 45, deadlift: 95 },
};

export const DELOAD_FACTOR = 0.9;
export const FAILS_BEFORE_DELOAD = 3;

export function incrementFor(lift: LiftId, unit: Unit): number {
  return INCREMENTS[unit][lift];
}

export interface AttemptSummary {
  topWeight: number;
  completedSets: number;
  plannedSets: number;
  allRepsHit: boolean;
}

export interface SessionSummary {
  day: WorkoutDay;
  byLift: Partial<Record<LiftId, AttemptSummary>>;
}

export interface LiftState {
  weight: number;
  fails: number;
}

export interface DerivedProgram {
  nextDay: WorkoutDay;
  lifts: Record<LiftId, LiftState>;
  totalSessions: number;
}

export function deriveProgram(
  startingWeights: Record<string, number>,
  unit: Unit,
  sessions: SessionSummary[]
): DerivedProgram {
  const lifts = {} as Record<LiftId, LiftState>;
  for (const lift of LIFT_ORDER) {
    const start = startingWeights[lift];
    lifts[lift] = {
      weight: start && start > 0 ? start : DEFAULT_STARTING[unit][lift],
      fails: 0,
    };
  }
  for (const session of sessions) {
    for (const key of Object.keys(session.byLift) as LiftId[]) {
      const info = session.byLift[key]!;
      const state = lifts[key];
      const success = info.completedSets >= info.plannedSets && info.allRepsHit;
      if (success) {
        state.weight = info.topWeight + incrementFor(key, unit);
        state.fails = 0;
      } else if (info.topWeight !== state.weight) {
        state.weight = info.topWeight;
        state.fails = 0;
      } else {
        state.fails += 1;
        if (state.fails >= FAILS_BEFORE_DELOAD) {
          state.weight = floorWeight(info.topWeight * DELOAD_FACTOR, unit);
          state.fails = 0;
        }
      }
    }
  }
  const last = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const nextDay: WorkoutDay = last ? (last.day === 'A' ? 'B' : 'A') : 'A';
  return { nextDay, lifts, totalSessions: sessions.length };
}

export function nextWorkoutPlan(program: DerivedProgram): {
  day: WorkoutDay;
  targets: PlannedExercise[];
} {
  const day = program.nextDay;
  const targets = liftsForDay(day).map((lift) => ({
    lift,
    sets: EXERCISES[lift].sets,
    reps: EXERCISES[lift].reps,
    weight: program.lifts[lift].weight,
  }));
  return { day, targets };
}

export function buildSessions(workouts: Workout[], sets: WorkoutSet[]): SessionSummary[] {
  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const arr = byWorkout.get(s.workout_id) ?? [];
    arr.push(s);
    byWorkout.set(s.workout_id, arr);
  }
  const ordered = workouts
    .filter((w) => byWorkout.has(w.id))
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const sessions: SessionSummary[] = [];
  for (const w of ordered) {
    const rows = byWorkout.get(w.id)!;
    const grouped = new Map<LiftId, WorkoutSet[]>();
    for (const r of rows) {
      const arr = grouped.get(r.exercise) ?? [];
      arr.push(r);
      grouped.set(r.exercise, arr);
    }
    const byLift: Partial<Record<LiftId, AttemptSummary>> = {};
    for (const [lift, rs] of grouped) {
      const logged = rs.filter((r) => r.completed);
      if (logged.length === 0) continue;
      byLift[lift] = {
        topWeight: Math.max(...logged.map((r) => r.weight ?? r.target_weight)),
        completedSets: logged.length,
        plannedSets: rs.length,
        allRepsHit: logged.every((r) => (r.reps ?? 0) >= r.target_reps),
      };
    }
    sessions.push({ day: w.day, byLift });
  }
  return sessions;
}
