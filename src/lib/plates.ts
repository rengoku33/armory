import { Unit } from './types';
import { BAR_WEIGHT, SMALLEST_PLATE, trim } from './weights';

const DENOMINATIONS: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5],
};

export const PLATE_COLORS: Record<string, string> = {
  '25': '#D32F2F',
  '20': '#1565C0',
  '15': '#FBC02D',
  '45': '#D32F2F',
  '35': '#1565C0',
  '10': '#388E3C',
  '5': '#ECEFF1',
  '2.5': '#78909C',
  '1.25': '#B0BEC5',
};

export interface PlateBreakdown {
  perSide: number;
  plates: { plate: number; count: number }[];
  leftover: number;
}

export function platesPerSide(total: number, unit: Unit): PlateBreakdown {
  const bar = BAR_WEIGHT[unit];
  const perSide = (total - bar) / 2;
  if (perSide <= 0) return { perSide: 0, plates: [], leftover: 0 };
  let remaining = perSide;
  const plates: { plate: number; count: number }[] = [];
  for (const d of DENOMINATIONS[unit]) {
    let count = 0;
    while (remaining >= d - 1e-9) {
      remaining -= d;
      count += 1;
    }
    if (count > 0) plates.push({ plate: d, count });
  }
  return { perSide, plates, leftover: Math.max(0, remaining) };
}

export function breakdownLabel(total: number, unit: Unit): string {
  const b = platesPerSide(total, unit);
  if (!b.perSide) return `${trim(BAR_WEIGHT[unit])} ${unit} empty bar`;
  const parts = b.plates.map((p) => (p.count > 1 ? `${trim(p.plate)}×${p.count}` : trim(p.plate)));
  const suffix = b.leftover > 0.001 && b.leftover < SMALLEST_PLATE[unit] ? ` +${trim(b.leftover)} short` : '';
  return `${parts.join(' · ')} per side${suffix}`;
}
