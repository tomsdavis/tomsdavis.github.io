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
});
