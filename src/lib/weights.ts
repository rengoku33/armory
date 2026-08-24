import { Unit } from './types';

export const BAR_WEIGHT: Record<Unit, number> = { kg: 20, lbs: 45 };

export const SMALLEST_PLATE: Record<Unit, number> = { kg: 1.25, lbs: 2.5 };

export function roundWeight(w: number, unit: Unit): number {
  const step = SMALLEST_PLATE[unit];
  return Math.round(w / step) * step;
}

export function floorWeight(w: number, unit: Unit): number {
  const step = SMALLEST_PLATE[unit];
  return Math.max(0, Math.floor(w / step) * step);
}

export function trim(n: number): string {
  return String(parseFloat(n.toFixed(2)));
}

export function fmtWeight(w: number | null | undefined, unit: Unit): string {
  if (w == null) return '—';
  return `${trim(w)} ${unit}`;
}

export function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}
