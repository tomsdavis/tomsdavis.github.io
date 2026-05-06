import { describe, it, expect } from 'vitest';
import { rotationFor } from '../src/scene/rotation';

const TWO_PI = 2 * Math.PI;
const wrap = (x: number) => ((x % TWO_PI) + TWO_PI) % TWO_PI;

describe('rotationFor', () => {
  it('rotating-earth: earth absorbs the entire GAST rotation', () => {
    const r = rotationFor('rotating-earth', 1.234);
    expect(r.earthY).toBeCloseTo(1.234);
    expect(r.celestialY).toBe(0);
  });

  it('fixed-earth: celestial sphere absorbs the GAST rotation, sign-flipped (westward)', () => {
    const r = rotationFor('fixed-earth', 1.234);
    expect(r.earthY).toBe(0);
    expect(r.celestialY).toBeCloseTo(-1.234);
  });

  it('preserves the (earthY − celestialY) ≡ gast invariant in either mode', () => {
    // Scoped to the two physically-correct modes. 'sidereal-lock' breaks this
    // invariant by design — it freezes diurnal phase so year-scale scrubbing
    // isolates precession (pass 7b).
    for (const gast of [0, 0.1, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 6.28, 100]) {
      for (const mode of ['rotating-earth', 'fixed-earth'] as const) {
        const { earthY, celestialY } = rotationFor(mode, gast);
        expect(wrap(earthY - celestialY)).toBeCloseTo(wrap(gast), 6);
      }
    }
  });

  it('produces a different anchor for each mode (not a no-op)', () => {
    const re = rotationFor('rotating-earth', 1);
    const fe = rotationFor('fixed-earth', 1);
    expect(re.earthY).not.toBe(fe.earthY);
    expect(re.celestialY).not.toBe(fe.celestialY);
  });

  it('sidereal-lock: freezes both roots regardless of GAST', () => {
    for (const gast of [0, 0.5, Math.PI, 2 * Math.PI, 100]) {
      const r = rotationFor('sidereal-lock', gast);
      expect(r.earthY).toBe(0);
      expect(r.celestialY).toBe(0);
    }
  });

  it('sidereal-lock: breaks the (earthY − celestialY) ≡ gast invariant by design', () => {
    // Documenting the deliberate deviation as a test, so a future refactor
    // doesn't accidentally restore the invariant and silently regress the
    // mode's pedagogical purpose.
    const r = rotationFor('sidereal-lock', 1.5);
    expect(wrap(r.earthY - r.celestialY)).not.toBeCloseTo(wrap(1.5), 6);
  });
});
