// Cycle order for the drawer's rotation-mode button. Pure helper kept in its
// own module so the call site stays a one-liner and the order is documented
// in code (re → fe → sl → re).

import type { RotationMode } from '../state';

export const ROTATION_CYCLE: readonly RotationMode[] = [
  'rotating-earth',
  'fixed-earth',
  'sidereal-lock',
];

export function nextRotationMode(m: RotationMode): RotationMode {
  const i = ROTATION_CYCLE.indexOf(m);
  return ROTATION_CYCLE[(i + 1) % ROTATION_CYCLE.length] ?? 'rotating-earth';
}
