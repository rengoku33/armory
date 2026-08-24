import { Unit } from './types';
import { BAR_WEIGHT, roundWeight } from './weights';

export interface WarmupSet {
  weight: number;
  reps: number;
}

const RAMP: [number, number][] = [
  [0.4, 5],
  [0.6, 3],
  [0.8, 2],
];

export function warmupSets(work: number, unit: Unit): WarmupSet[] {
  const bar = BAR_WEIGHT[unit];
  if (work <= bar) return [];
  const out: WarmupSet[] = [{ weight: bar, reps: 5 }];
  for (const [pct, reps] of RAMP) {
    const w = roundWeight(work * pct, unit);
    if (w > bar && w < work) out.push({ weight: w, reps });
  }
  return out;
}
