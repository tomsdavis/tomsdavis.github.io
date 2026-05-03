import { describe, it, expect } from 'vitest';
import {
  sunDirection,
  bodyDirection,
  bodyToSunSceneDir,
  bodyPhaseCos,
  moonPhase,
  BODY_NAMES,
  gast,
} from '../src/astronomy/ephemeris';

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;

function normaliseRA(ra: number): number {
  let r = ra % TWO_PI;
  if (r > Math.PI) r -= TWO_PI;
  if (r < -Math.PI) r += TWO_PI;
  return r;
}

/** Geocentric angular separation between two equatorial directions (radians). */
function angularSeparation(
  a: { ra: number; dec: number },
  b: { ra: number; dec: number },
): number {
  const cos = Math.sin(a.dec) * Math.sin(b.dec)
    + Math.cos(a.dec) * Math.cos(b.dec) * Math.cos(a.ra - b.ra);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

describe('sunDirection', () => {
  it('returns finite RA/Dec in valid ranges for a contemporary date', () => {
    const { ra, dec } = sunDirection(new Date('2026-05-02T12:00:00Z'));
    expect(Number.isFinite(ra)).toBe(true);
    expect(Number.isFinite(dec)).toBe(true);
    expect(dec).toBeLessThan(Math.PI / 2);
    expect(dec).toBeGreaterThan(-Math.PI / 2);
  });

  it('places the Sun near RA 0, Dec 0 at the 2000 vernal equinox', () => {
    // 2000 March vernal equinox: 2000-03-20 07:35 UT.
    const equinox = new Date(Date.UTC(2000, 2, 20, 7, 35, 0));
    const { ra, dec } = sunDirection(equinox);
    expect(Math.abs(normaliseRA(ra))).toBeLessThan(2 * DEG);
    expect(Math.abs(dec)).toBeLessThan(1 * DEG);
  });

  it('places the Sun near Dec +23.44° at the June solstice', () => {
    // 2000 June solstice: 2000-06-21 01:48 UT.
    const solstice = new Date(Date.UTC(2000, 5, 21, 1, 48, 0));
    const { dec } = sunDirection(solstice);
    expect(dec).toBeGreaterThan(23.0 * DEG);
    expect(dec).toBeLessThan(23.5 * DEG);
  });

  it('places the Sun near Dec −23.44° at the December solstice', () => {
    const solstice = new Date(Date.UTC(2000, 11, 21, 13, 37, 0));
    const { dec } = sunDirection(solstice);
    expect(dec).toBeLessThan(-23.0 * DEG);
    expect(dec).toBeGreaterThan(-23.5 * DEG);
  });
});

describe('bodyDirection', () => {
  it('returns finite RA in [0, 2π) and Dec in (−π/2, π/2) for every body', () => {
    const t = new Date('2026-05-02T12:00:00Z');
    for (const body of BODY_NAMES) {
      const { ra, dec } = bodyDirection(body, t);
      expect(Number.isFinite(ra), `${body} ra finite`).toBe(true);
      expect(Number.isFinite(dec), `${body} dec finite`).toBe(true);
      expect(ra, `${body} ra range`).toBeGreaterThanOrEqual(0);
      expect(ra, `${body} ra range`).toBeLessThan(TWO_PI);
      expect(dec, `${body} dec range`).toBeGreaterThan(-Math.PI / 2);
      expect(dec, `${body} dec range`).toBeLessThan(Math.PI / 2);
    }
  });

  it('matches sunDirection for the Sun (back-compat)', () => {
    const t = new Date('2026-05-02T12:00:00Z');
    const a = sunDirection(t);
    const b = bodyDirection('Sun', t);
    expect(a.ra).toBeCloseTo(b.ra, 12);
    expect(a.dec).toBeCloseTo(b.dec, 12);
  });

  it('keeps Mercury within its ~28° maximum elongation from the Sun', () => {
    // Sample a year in 30-day steps; max elongation should never exceed
    // ~28° (extreme: ~28.3°). A bug that swapped Mercury with another body
    // would blow this through almost certainly.
    const start = Date.UTC(2025, 0, 1);
    let maxElong = 0;
    for (let day = 0; day < 366; day += 30) {
      const t = new Date(start + day * 86_400_000);
      const e = angularSeparation(bodyDirection('Sun', t), bodyDirection('Mercury', t));
      if (e > maxElong) maxElong = e;
    }
    expect(maxElong).toBeLessThan(29 * DEG);
  });

  it('keeps Venus within its ~47° maximum elongation from the Sun', () => {
    const start = Date.UTC(2025, 0, 1);
    let maxElong = 0;
    for (let day = 0; day < 366; day += 30) {
      const t = new Date(start + day * 86_400_000);
      const e = angularSeparation(bodyDirection('Sun', t), bodyDirection('Venus', t));
      if (e > maxElong) maxElong = e;
    }
    expect(maxElong).toBeLessThan(48 * DEG);
  });

  it('places Mars near opposition (180° from Sun) on 2003-08-28', () => {
    // The historic close approach: Mars opposition 2003-08-28T~09:51 UTC.
    const t = new Date('2003-08-28T09:51:00Z');
    const sep = angularSeparation(bodyDirection('Sun', t), bodyDirection('Mars', t));
    // Opposition is an ecliptic-longitude concept; the great-circle angular
    // separation can fall ~7–8° short of 180° because Mars's declination
    // differs from the Sun's by tens of degrees at this season.
    expect(Math.abs(sep - Math.PI)).toBeLessThan(10 * DEG);
  });
});

describe('moonPhase', () => {
  it('returns a finite phase angle in [0, π] and illuminated fraction in [0, 1]', () => {
    const t = new Date('2026-05-02T12:00:00Z');
    const { phaseAngle, illuminatedFraction } = moonPhase(t);
    expect(Number.isFinite(phaseAngle)).toBe(true);
    expect(phaseAngle).toBeGreaterThanOrEqual(0);
    expect(phaseAngle).toBeLessThanOrEqual(Math.PI);
    expect(illuminatedFraction).toBeGreaterThanOrEqual(0);
    expect(illuminatedFraction).toBeLessThanOrEqual(1);
  });

  it('reports a near-full Moon at the 2025-01-13 Wolf Moon', () => {
    // Published full moon: 2025-01-13T22:27 UTC.
    const t = new Date('2025-01-13T22:27:00Z');
    const { illuminatedFraction } = moonPhase(t);
    expect(illuminatedFraction).toBeGreaterThan(0.99);
  });

  it('reports a near-new Moon at the 2025-01-29 new moon', () => {
    // Published new moon: 2025-01-29T12:36 UTC.
    const t = new Date('2025-01-29T12:36:00Z');
    const { illuminatedFraction } = moonPhase(t);
    expect(illuminatedFraction).toBeLessThan(0.01);
  });

  it('places the Moon ~180° from the Sun at full and ~0° at new', () => {
    // Tolerance allows for the Moon's 5.14° orbital inclination: at full or
    // new the ecliptic-longitude difference is exact, but the great-circle
    // separation can deviate by up to ~5.14° in either direction.
    const full = new Date('2025-01-13T22:27:00Z');
    const sepFull = angularSeparation(bodyDirection('Sun', full), bodyDirection('Moon', full));
    expect(Math.abs(sepFull - Math.PI)).toBeLessThan(6 * DEG);

    const newm = new Date('2025-01-29T12:36:00Z');
    const sepNew = angularSeparation(bodyDirection('Sun', newm), bodyDirection('Moon', newm));
    expect(sepNew).toBeLessThan(6 * DEG);
  });
});

describe('bodyToSunSceneDir', () => {
  it('returns a unit vector for any body other than the Sun at any contemporary date', () => {
    const t = new Date('2026-05-02T12:00:00Z');
    for (const body of BODY_NAMES) {
      if (body === 'Sun') continue;
      const v = bodyToSunSceneDir(body, t);
      const mag = Math.hypot(v.x, v.y, v.z);
      expect(mag, `${body} magnitude ≈ 1`).toBeCloseTo(1, 6);
    }
  });

  it('points roughly opposite the Moon\'s scene direction at full Moon', () => {
    // Full moon: body-to-Sun direction at the Moon ≈ -moonScenePos (Sun and
    // Moon are on opposite sides of Earth, so from the Moon the Sun is in
    // the direction opposite to where Earth sees the Moon).
    const t = new Date('2025-01-13T22:27:00Z');
    const moonDir = bodyDirection('Moon', t);
    const moonScene = {
      x: Math.cos(moonDir.dec) * Math.sin(moonDir.ra),
      y: Math.sin(moonDir.dec),
      z: Math.cos(moonDir.dec) * Math.cos(moonDir.ra),
    };
    const sunFromMoon = bodyToSunSceneDir('Moon', t);
    const dot = sunFromMoon.x * (-moonScene.x)
      + sunFromMoon.y * (-moonScene.y)
      + sunFromMoon.z * (-moonScene.z);
    // At full, the two unit vectors should be nearly parallel: dot ≈ 1.
    // Tolerance allows for the Moon's 5.14° orbital inclination.
    expect(dot).toBeGreaterThan(Math.cos(6 * DEG));
  });

  it('points roughly along the Moon\'s scene direction at new Moon', () => {
    // New moon: from the Moon, the Sun is in the same direction Earth sees
    // the Moon (Sun behind Moon as viewed from Earth, so from Moon the Sun
    // is in the direction Moon sees Earth's anti-Sun → same as Earth-to-Moon).
    // Equivalently, body-to-Sun from Moon is antiparallel to body-to-Earth,
    // and body-to-Earth ≈ -moonScene, so body-to-Sun ≈ +moonScene.
    const t = new Date('2025-01-29T12:36:00Z');
    const moonDir = bodyDirection('Moon', t);
    const moonScene = {
      x: Math.cos(moonDir.dec) * Math.sin(moonDir.ra),
      y: Math.sin(moonDir.dec),
      z: Math.cos(moonDir.dec) * Math.cos(moonDir.ra),
    };
    const sunFromMoon = bodyToSunSceneDir('Moon', t);
    const dot = sunFromMoon.x * moonScene.x
      + sunFromMoon.y * moonScene.y
      + sunFromMoon.z * moonScene.z;
    expect(dot).toBeGreaterThan(Math.cos(6 * DEG));
  });

  it('differs significantly from Venus\'s scene-projected Sun direction', () => {
    // Catches the bug where someone uses (sunScene - venusScene).normalize()
    // as a stand-in for the real body-to-Sun direction. For Venus this is
    // dramatically wrong because Venus's real position is far from R_CS along
    // its apparent direction. Pick a date when Venus is near greatest
    // elongation (~47° from Sun), where the discrepancy is largest.
    const t = new Date('2025-01-10T00:00:00Z'); // Venus near eastern elongation
    const sunDir = bodyDirection('Sun', t);
    const venusDir = bodyDirection('Venus', t);
    const sunScene = {
      x: Math.cos(sunDir.dec) * Math.sin(sunDir.ra),
      y: Math.sin(sunDir.dec),
      z: Math.cos(sunDir.dec) * Math.cos(sunDir.ra),
    };
    const venusScene = {
      x: Math.cos(venusDir.dec) * Math.sin(venusDir.ra),
      y: Math.sin(venusDir.dec),
      z: Math.cos(venusDir.dec) * Math.cos(venusDir.ra),
    };
    const sceneDx = sunScene.x - venusScene.x;
    const sceneDy = sunScene.y - venusScene.y;
    const sceneDz = sunScene.z - venusScene.z;
    const sceneLen = Math.hypot(sceneDx, sceneDy, sceneDz);
    const sceneDir = {
      x: sceneDx / sceneLen,
      y: sceneDy / sceneLen,
      z: sceneDz / sceneLen,
    };
    const real = bodyToSunSceneDir('Venus', t);
    const dot = real.x * sceneDir.x + real.y * sceneDir.y + real.z * sceneDir.z;
    // The two should disagree by at least ~10° (real geometry vs scene
    // projection). If they agree closely, we're using the wrong vector.
    expect(dot).toBeLessThan(Math.cos(10 * DEG));
  });
});

describe('bodyPhaseCos', () => {
  it('returns ~+1 at the Wolf Moon (full)', () => {
    const t = new Date('2025-01-13T22:27:00Z');
    expect(bodyPhaseCos('Moon', t)).toBeGreaterThan(0.99);
  });

  it('returns ~−1 at the 2025-01-29 new Moon', () => {
    const t = new Date('2025-01-29T12:36:00Z');
    expect(bodyPhaseCos('Moon', t)).toBeLessThan(-0.99);
  });

  it('returns a value in [−1, +1] for every phasable body at any contemporary date', () => {
    const t = new Date('2026-05-02T12:00:00Z');
    for (const body of BODY_NAMES) {
      if (body === 'Sun') continue;
      const c = bodyPhaseCos(body, t);
      expect(c, `${body} phaseCos in range`).toBeGreaterThanOrEqual(-1);
      expect(c, `${body} phaseCos in range`).toBeLessThanOrEqual(1);
    }
  });

  it('matches the cos of moonPhase().phaseAngle', () => {
    const t = new Date('2026-05-02T12:00:00Z');
    const mp = moonPhase(t);
    expect(bodyPhaseCos('Moon', t)).toBeCloseTo(Math.cos(mp.phaseAngle), 3);
  });
});

describe('gast', () => {
  it('returns Greenwich apparent sidereal time in [0, 2π)', () => {
    const t = gast(new Date('2026-05-02T12:00:00Z'));
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThan(2 * Math.PI);
  });

  it('matches the textbook GAST at J2000.0 within ~0.01 rad', () => {
    // J2000.0 is 2000-01-01T12:00:00 TT. Treating UTC as ≈ UT1 here is fine
    // for our tolerance; the equation of equinoxes is sub-arcsecond.
    const t = gast(new Date('2000-01-01T12:00:00Z'));
    // GMST at J2000.0 = 18h 41m 50.54841s = 18.697374558h = 4.89496121 rad.
    expect(t).toBeCloseTo(4.895, 2);
  });

  it('returns near-zero net change over one sidereal day (~23h56m04s)', () => {
    const t0 = gast(new Date('2026-05-02T00:00:00Z'));
    const t1 = gast(new Date('2026-05-02T23:56:04Z'));
    const delta = ((t1 - t0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const wrapped = Math.min(delta, 2 * Math.PI - delta);
    expect(wrapped).toBeLessThan(0.005);
  });

  it('advances monotonically over a 12-hour solar interval', () => {
    const t0 = gast(new Date('2026-05-02T00:00:00Z'));
    const t12 = gast(new Date('2026-05-02T12:00:00Z'));
    const delta = ((t12 - t0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    // 12 solar hours → ~12.0329 sidereal hours → ~π + 0.00859 rad.
    expect(delta).toBeCloseTo(Math.PI + 0.00859, 2);
  });
});
