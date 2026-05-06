// Spec pass 7b: pure logic for the floating year readout. The DOM-touching
// shell lives in year-readout.ts; this module is the testable core.
//
// The readout exists to surface the current year when the drawer's
// <input type="datetime-local"> can't (years outside 0001–9999, the picker's
// 4-digit cap), or when 'sidereal-lock' rotation mode hides diurnal phase and
// only year-scale motion is meaningful.

import type { RotationMode } from '../state';

/** datetime-local accepts 0001-01-01 onward. */
export const PICKER_MIN_YEAR = 1;
/** … through 9999-12-31. */
export const PICKER_MAX_YEAR = 9999;

/**
 * Format a Date as a year-only readout. Astronomical year 0 is 1 BCE,
 * year −1 is 2 BCE, etc. — subtract from 1 to convert.
 */
export function formatYear(d: Date): string {
  const y = d.getUTCFullYear();
  if (y >= 1) return `Year ${y}`;
  return `Year ${1 - y} BCE`;
}

export function yearOutsidePickerRange(d: Date): boolean {
  const y = d.getUTCFullYear();
  return y < PICKER_MIN_YEAR || y > PICKER_MAX_YEAR;
}

export interface YearReadoutInputs {
  instant: Date;
  rotationMode: RotationMode;
}

export function shouldShowYearReadout(s: YearReadoutInputs): boolean {
  return yearOutsidePickerRange(s.instant) || s.rotationMode === 'sidereal-lock';
}
