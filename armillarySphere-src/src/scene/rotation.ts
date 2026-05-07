// Spec §4.1: pure helper that decides which Three.js root absorbs the GAST
// rotation, depending on the user's chosen rotation mode.
//
// Invariant: (earthY − celestialY) ≡ gast (mod 2π) in either mode — the
// physical Earth↔sky relative geometry is the same; only the camera anchor
// differs.

import type { RotationMode } from '../state';

export interface RotationApplication {
  /** rotation.y for the Earth root, radians. */
  earthY: number;
  /** rotation.y for the celestial-sphere root, radians. */
  celestialY: number;
}

export function rotationFor(
  mode: RotationMode,
  gastRad: number,
  lockedAngles?: RotationApplication | null,
): RotationApplication {
  switch (mode) {
    case 'rotating-earth':
      return { earthY: gastRad, celestialY: 0 };
    case 'fixed-earth':
      return { earthY: 0, celestialY: -gastRad };
    case 'sidereal-lock':
      // Diurnal phase is frozen — both roots are constant in time. The
      // specific values come from `lockedAngles` (captured at sl entry from
      // the previous mode's angles; see transitionRotationMode), so a mode
      // switch into sl never causes a visual jump. Falls back to (0, 0)
      // when no lock is provided — the URL-reload-into-sl path.
      return lockedAngles
        ? { earthY: lockedAngles.earthY, celestialY: lockedAngles.celestialY }
        : { earthY: 0, celestialY: 0 };
  }
}
