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

export function rotationFor(mode: RotationMode, gastRad: number): RotationApplication {
  switch (mode) {
    case 'rotating-earth':
      return { earthY: gastRad, celestialY: 0 };
    case 'fixed-earth':
      return { earthY: 0, celestialY: -gastRad };
    case 'sidereal-lock':
      // Diurnal phase is frozen — earthY = celestialY = 0 regardless of GAST.
      // Year-scale scrubbing then isolates precession (the J2000→of-date
      // matrix on celestialJ2000Root) and the Sun's RA/Dec drift across the
      // ecliptic, without GAST wrap noise overwhelming the signal. Breaks
      // the (earthY − celestialY) ≡ gast invariant by design.
      return { earthY: 0, celestialY: 0 };
  }
}
