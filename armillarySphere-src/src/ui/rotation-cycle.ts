// Cycle order for the drawer's rotation-mode button. Pure helper kept in its
// own module so the call site stays a one-liner and the order is documented
// in code (re → fe → sl → re).

import type { AppState, RotationMode } from '../state';
import { rotationFor, type RotationApplication } from '../scene/rotation';

export const ROTATION_CYCLE: readonly RotationMode[] = [
  'rotating-earth',
  'fixed-earth',
  'sidereal-lock',
];

export function nextRotationMode(m: RotationMode): RotationMode {
  const i = ROTATION_CYCLE.indexOf(m);
  return ROTATION_CYCLE[(i + 1) % ROTATION_CYCLE.length] ?? 'rotating-earth';
}

/**
 * Compute the state patch for a rotation-mode cycle click.
 *
 * Two pieces of work, both in service of "the instantaneous viewpoint stays
 * unchanged across mode switches; only the impact of time progressing differs":
 *
 * 1. **sl lock-at-entry.** Entering 'sidereal-lock' captures the previous
 *    mode's (earthY, celestialY) at the current GAST. `rotationFor` then
 *    returns those same angles in sl mode regardless of GAST, so the entry
 *    is a no-op visually. Leaving sl clears the lock.
 * 2. **Sky-following camera azimuth.** When celestialY changes between modes,
 *    we bump `camera.azimuth` by the same delta so the celestial sphere
 *    stays put on screen. For re ↔ fe transitions Earth and sky rotate by
 *    the same amount, so this also keeps Earth fixed (full preservation).
 *    The only remaining jump is sl → re/fe after time has advanced during
 *    the sl session: Earth then jumps by the diurnal angle that "didn't
 *    happen" while sl froze it. Unavoidable — the canonical mode formula
 *    must reassert eventually.
 */
export function transitionRotationMode(
  state: AppState,
  gastRad: number,
): Partial<AppState> {
  const oldMode = state.rotationMode;
  const newMode = nextRotationMode(oldMode);
  if (oldMode === newMode) return {};

  const oldRot = rotationFor(oldMode, gastRad, state.siderealLock);

  const newLock: RotationApplication | null =
    newMode === 'sidereal-lock'
      ? { earthY: oldRot.earthY, celestialY: oldRot.celestialY }
      : null;

  const newRot = rotationFor(newMode, gastRad, newLock);

  const dCel = newRot.celestialY - oldRot.celestialY;

  return {
    rotationMode: newMode,
    siderealLock: newLock,
    camera: { ...state.camera, azimuth: state.camera.azimuth + dCel },
  };
}
