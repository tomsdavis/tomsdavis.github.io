import { describe, it, expect } from 'vitest';
import { sunDirection, gast } from '../src/astronomy/ephemeris';

const DEG = Math.PI / 180;

function normaliseRA(ra: number): number {
  let r = ra % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r < -Math.PI) r += 2 * Math.PI;
  return r;
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
