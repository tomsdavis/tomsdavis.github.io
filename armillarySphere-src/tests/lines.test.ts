// Pure-logic tests for the line generators in src/scene/lines.ts.
// No Three.js scene assembly — only the math that decides where points sit.

import { describe, it, expect } from 'vitest';
import {
  parallelPoints,
  meridianPoints,
  eclipticPoints,
  equatorTickEndpoints,
  OBLIQUITY,
} from '../src/scene/lines';

describe('parallelPoints', () => {
  it('returns segments+1 points (closed-loop friendly: first ≈ last)', () => {
    const pts = parallelPoints(0, 24, 1);
    expect(pts).toHaveLength(25);
    expect(pts[0]!.x).toBeCloseTo(pts[24]!.x, 6);
    expect(pts[0]!.z).toBeCloseTo(pts[24]!.z, 6);
  });

  it('all points at dec = 0 lie in the equatorial plane (y = 0)', () => {
    const pts = parallelPoints(0, 12, 1);
    for (const p of pts) expect(p.y).toBeCloseTo(0, 9);
  });

  it('the equator on the unit sphere has |p| = 1', () => {
    const pts = parallelPoints(0, 12, 1);
    for (const p of pts) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
  });

  it('a parallel at dec > 0 sits above the equatorial plane', () => {
    const pts = parallelPoints(Math.PI / 6, 12, 1); // dec = 30°
    for (const p of pts) expect(p.y).toBeCloseTo(0.5, 6); // sin(30°)
  });

  it('scales by the radius argument', () => {
    const pts = parallelPoints(0, 12, 2.5);
    for (const p of pts) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(2.5, 6);
  });
});

describe('meridianPoints', () => {
  it('starts at the south pole (-y) and ends at the north pole (+y)', () => {
    const pts = meridianPoints(0, 30, 1);
    expect(pts[0]!.y).toBeCloseTo(-1, 6);
    expect(pts[30]!.y).toBeCloseTo(+1, 6);
  });

  it('a meridian at RA = 0 lies in the y-z plane (x = 0)', () => {
    const pts = meridianPoints(0, 30, 1);
    for (const p of pts) expect(p.x).toBeCloseTo(0, 6);
  });

  it('a meridian at RA = π/2 lies in the y-x plane (z = 0)', () => {
    const pts = meridianPoints(Math.PI / 2, 30, 1);
    for (const p of pts) expect(p.z).toBeCloseTo(0, 6);
  });

  it('every meridian point sits on the unit sphere', () => {
    const pts = meridianPoints(1.234, 30, 1);
    for (const p of pts) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
  });
});

describe('eclipticPoints', () => {
  it('passes through the vernal equinox (+z) at λ = 0', () => {
    const pts = eclipticPoints(360, 1);
    expect(pts[0]!.x).toBeCloseTo(0, 6);
    expect(pts[0]!.y).toBeCloseTo(0, 6);
    expect(pts[0]!.z).toBeCloseTo(1, 6);
  });

  it('reaches max declination = +OBLIQUITY at λ = π/2 (summer solstice)', () => {
    const pts = eclipticPoints(360, 1); // step = 1°
    const summer = pts[90]!; // λ = 90°
    expect(Math.asin(summer.y)).toBeCloseTo(OBLIQUITY, 4);
  });

  it('passes through the autumnal equinox (-z) at λ = π', () => {
    const pts = eclipticPoints(360, 1);
    const autumn = pts[180]!;
    expect(autumn.z).toBeCloseTo(-1, 6);
    expect(autumn.y).toBeCloseTo(0, 6);
  });

  it('reaches min declination = -OBLIQUITY at λ = 3π/2 (winter solstice)', () => {
    const pts = eclipticPoints(360, 1);
    const winter = pts[270]!;
    expect(Math.asin(winter.y)).toBeCloseTo(-OBLIQUITY, 4);
  });

  it('every point sits on the unit sphere', () => {
    const pts = eclipticPoints(120, 1);
    for (const p of pts) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
  });
});

describe('equatorTickEndpoints', () => {
  it('returns 2 × (360 / grain) endpoints (one pair per tick)', () => {
    expect(equatorTickEndpoints(15, 0.01, 1)).toHaveLength(2 * 24);
    expect(equatorTickEndpoints(30, 0.01, 1)).toHaveLength(2 * 12);
    expect(equatorTickEndpoints(90, 0.01, 1)).toHaveLength(2 * 4);
  });

  it('each tick straddles the equator: y ranges from -halfWidth to +halfWidth', () => {
    const half = (1.0 * Math.PI) / 180;
    const ends = equatorTickEndpoints(90, half, 1);
    for (let i = 0; i < ends.length; i += 2) {
      expect(ends[i]!.y).toBeCloseTo(-Math.sin(half), 6);
      expect(ends[i + 1]!.y).toBeCloseTo(+Math.sin(half), 6);
    }
  });

  it('first tick sits at RA = 0 (on +z axis)', () => {
    const ends = equatorTickEndpoints(90, 0.01, 1);
    expect(ends[0]!.x).toBeCloseTo(0, 6);
    expect(ends[0]!.z).toBeCloseTo(Math.cos(0.01), 5);
    expect(ends[1]!.x).toBeCloseTo(0, 6);
    expect(ends[1]!.z).toBeCloseTo(Math.cos(0.01), 5);
  });
});
