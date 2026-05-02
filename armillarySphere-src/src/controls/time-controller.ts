// Spec §4.3: discrete rate ladder + pure advance() helper. Play/pause and
// scrub-bar bindings are wired separately in the UI layer.

export type Rate = 1 | 60 | 3600 | 86400 | 31_557_600;

/** Spec §4.3: real-time, ×60, ×3600, ×86400, ×31557600 (Julian year/sec). */
export const RATES: readonly Rate[] = [1, 60, 3600, 86400, 31_557_600];

/**
 * Advance `date` by `rate * dtSeconds` of simulated time. Pure; does not
 * mutate the input. Negative rate or dt rewinds.
 */
export function advance(date: Date, rate: number, dtSeconds: number): Date {
  return new Date(date.getTime() + rate * dtSeconds * 1000);
}
