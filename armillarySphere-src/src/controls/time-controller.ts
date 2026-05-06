// Spec §4.3: discrete rate ladder + pure helpers. Play/pause and scrub-bar
// bindings are wired separately in the UI layer; this module owns the time-rate
// vocabulary so the drawer can stay assembly.

export type Rate = 1 | 60 | 3600 | 86400 | 31_557_600 | 3_155_760_000;

/** Spec §4.3 + extension: real-time, ×60, ×3600, ×86400, ×31.5M (1 Julian
 *  yr/s), ×3.156G (100 Julian yr/s — useful in sidereal-lock for visualising
 *  precession on a human timescale, but works in every mode). */
export const RATES: readonly Rate[] = [1, 60, 3600, 86400, 31_557_600, 3_155_760_000];

/**
 * Advance `date` by `rate * dtSeconds` of simulated time. Pure; does not
 * mutate the input. Negative rate or dt rewinds.
 */
export function advance(date: Date, rate: number, dtSeconds: number): Date {
  return new Date(date.getTime() + rate * dtSeconds * 1000);
}

/**
 * Human label for a rate-ladder rung. The select uses these as option text;
 * any off-ladder rate falls back to a generic `×N` form.
 */
export function formatRate(rate: number): string {
  switch (rate) {
    case 1: return '×1 (real time)';
    case 60: return '×60 (1 min/s)';
    case 3600: return '×3600 (1 hr/s)';
    case 86400: return '×86400 (1 day/s)';
    case 31_557_600: return '×31.5M (1 yr/s)';
    case 3_155_760_000: return '×3.16G (100 yr/s)';
    default: return `×${rate}`;
  }
}
