export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, factor: number): number => from + (to - from) * factor;

export const movingAverage = (previous: number, next: number, alpha: number): number =>
  previous * (1 - alpha) + next * alpha;
