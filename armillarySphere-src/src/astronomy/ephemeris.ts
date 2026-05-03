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

/**
 * Solar-system bodies the armillary visualisation tracks (spec §4.5):
 * Sun, Moon, and the five classical naked-eye planets.
 */
export type BodyName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn';

/** Iteration order matches the spec §4.5 list. */
export const BODY_NAMES: readonly BodyName[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
];

const BODY_MAP: Record<BodyName, Astronomy.Body> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
};

/**
 * Geocentric apparent equatorial direction (of-date, with stellar aberration).
 *
 * Suitable for placing the body's sprite on the celestial sphere alongside
 * the J2000 star catalogue: the precession offset between of-date and J2000
 * is below the visual fidelity of this tool (§8.2).
 */
export function bodyDirection(body: BodyName, date: Date): EquatorialDir {
  const eq = Astronomy.Equator(BODY_MAP[body], date, GEOCENTRE, true, true);
  return {
    ra: eq.ra * HOURS_TO_RAD,
    dec: eq.dec * DEG_TO_RAD,
  };
}

export function sunDirection(date: Date): EquatorialDir {
  return bodyDirection('Sun', date);
}

/**
 * Body-to-Sun unit direction in our scene's celestial-sphere local frame
 * (same axes as `raDecToVec3`: +Y north celestial pole, +Z toward RA = 0).
 *
 * Computed from real geocentric positions, NOT scene-projected ones — this
 * matters for inferior planets, whose true Sun-direction is up to tens of
 * degrees off their apparent direction. astronomy-engine's GeoVector returns
 * J2000 equatorial Cartesian (X = vernal equinox, Y = RA 6h, Z = NCP); we
 * remap to (sceneX = J2000_Y, sceneY = J2000_Z, sceneZ = J2000_X) to match
 * `raDecToVec3`. Precession from J2000 to of-date is ~22 arcmin over a
 * 26-year offset and is ignored — well below visual fidelity.
 */
export function bodyToSunSceneDir(body: BodyName, date: Date): { x: number; y: number; z: number } {
  const bodyV = Astronomy.GeoVector(BODY_MAP[body], date, true);
  const sunV = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
  const dx = sunV.x - bodyV.x;
  const dy = sunV.y - bodyV.y;
  const dz = sunV.z - bodyV.z;
  const len = Math.hypot(dx, dy, dz);
  return { x: dy / len, y: dz / len, z: dx / len };
}

/**
 * Cosine of the body's phase angle (Sun-Body-Earth interior angle).
 *
 *   +1 = full     (Sun, Earth on the same side of body — superior body's "full
 *                  phase", or the Moon at full)
 *    0 = half
 *   −1 = new      (body between Earth and Sun, body's lit hemisphere faces away)
 *
 * Used by the phase shader as the depth component of the lit-direction vector
 * in disc-local space — fixing it to this value gives "Earth-perspective"
 * phase rendering (full Moon looks fully lit regardless of the camera's
 * vantage), as opposed to "camera-perspective" where the same body can appear
 * dark from the anti-Sun side of the system.
 */
export function bodyPhaseCos(body: BodyName, date: Date): number {
  const bodyV = Astronomy.GeoVector(BODY_MAP[body], date, true);
  const sunV = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
  const sx = sunV.x - bodyV.x;
  const sy = sunV.y - bodyV.y;
  const sz = sunV.z - bodyV.z;
  const sLen = Math.hypot(sx, sy, sz);
  const bLen = Math.hypot(bodyV.x, bodyV.y, bodyV.z);
  // Body-to-Sun · Body-to-Earth, both unit. Body-to-Earth = -bodyV/|bodyV|.
  return -(sx * bodyV.x + sy * bodyV.y + sz * bodyV.z) / (sLen * bLen);
}

export interface MoonPhase {
  /** Phase angle in radians: 0 = new, π = full. */
  phaseAngle: number;
  /** Illuminated fraction of the visible disc, in [0, 1]. */
  illuminatedFraction: number;
}

/**
 * Lunar phase metadata for the Moon-phase shader (§4.5).
 *
 * The shader's actual lit-hemisphere direction is derived in scene space from
 * the world-space Sun and Moon sprite positions — not from this struct —
 * because both bodies live on the same celestial-sphere root, so the Sun→Moon
 * direction is invariant under the celestial-sphere rotation. This function
 * provides the scalar phase quantities for tests and any UI that wants them.
 */
export function moonPhase(date: Date): MoonPhase {
  const info = Astronomy.Illumination(Astronomy.Body.Moon, date);
  return {
    phaseAngle: info.phase_angle * DEG_TO_RAD,
    illuminatedFraction: info.phase_fraction,
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
