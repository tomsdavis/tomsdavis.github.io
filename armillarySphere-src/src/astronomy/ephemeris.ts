// Spec §4.3, §6.4: thin wrapper over astronomy-engine. Returns equatorial
// directions in radians and sidereal time in radians, kept agnostic about
// how its output is rendered (§8.1).

import * as Astronomy from 'astronomy-engine';

export interface EquatorialDir {
  /** Right ascension, radians, range [0, 2π). */
  ra: number;
  /** Declination, radians, range [−π/2, π/2]. */
  dec: number;
}

const HOURS_TO_RAD = Math.PI / 12;
const DEG_TO_RAD = Math.PI / 180;

// Geocentre proxy: Observer(0,0,0). Topocentric vs geocentric for the Sun
// differs by at most ~9 arcseconds (solar parallax), well below any tolerance
// we care about for terminator placement or armillary visualisation.
const GEOCENTRE = new Astronomy.Observer(0, 0, 0);

export function sunDirection(date: Date): EquatorialDir {
  // Apparent of-date coordinates with stellar aberration applied.
  const eq = Astronomy.Equator(Astronomy.Body.Sun, date, GEOCENTRE, true, true);
  return {
    ra: eq.ra * HOURS_TO_RAD,
    dec: eq.dec * DEG_TO_RAD,
  };
}

/**
 * Greenwich apparent sidereal time, radians, range [0, 2π).
 *
 * Drives the Earth/celestial-sphere relative rotation per spec §4.1.
 */
export function gast(date: Date): number {
  return Astronomy.SiderealTime(date) * HOURS_TO_RAD;
}
