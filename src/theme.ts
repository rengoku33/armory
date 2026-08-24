export const colors = {
  bg: '#0A0D12',
  surface: '#12161D',
  surfaceAlt: '#171D27',
  border: '#232B37',
  text: '#E9EEF5',
  muted: '#8A94A6',
  faint: '#5A6478',
  accent: '#FF5C38',
  accentSoft: 'rgba(255,92,56,0.14)',
  success: '#3DDC84',
  successSoft: 'rgba(61,220,132,0.12)',
  danger: '#FF5A5F',
  dangerSoft: 'rgba(255,90,95,0.12)',
  warn: '#FFC24B',
  warnSoft: 'rgba(255,194,75,0.12)',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const space = (n: number) => n * 4;
