// Pure-logic tests for src/astronomy/constellation-loader.ts. Cover the
// math (raDecDegToVec3, slerp, subdivide) and the build-from-file shape;
// don't exercise fetch or scene code.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  raDecDegToVec3,
  slerpUnit,
  subdivideArc,
  subdivideBoundary,
  centroid,
  buildLines,
  buildBounds,
} from '../src/astronomy/constellation-loader';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('raDecDegToVec3', () => {
  it('places (RA = 0°, Dec = 0°) at +Z (matches raDecToVec3 convention)', () => {
    const p = raDecDegToVec3(0, 0);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(1, 6);
  });

  it('places (RA = 90°, Dec = 0°) at +X', () => {
    const p = raDecDegToVec3(90, 0);
    expect(p.x).toBeCloseTo(1, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it('places (RA = 0°, Dec = 90°) at +Y (NCP)', () => {
    const p = raDecDegToVec3(0, 90);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(1, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it('returns a unit vector for any input', () => {
    for (const [ra, dec] of [[0, 0], [45, 30], [180, -60], [270, 89]]) {
      const p = raDecDegToVec3(ra!, dec!);
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
    }
  });
});

describe('slerpUnit', () => {
  it('returns the start point at t=0 and the end point at t=1', () => {
    const a = v(1, 0, 0);
    const b = v(0, 0, 1);
    const s0 = slerpUnit(a, b, 0);
    const s1 = slerpUnit(a, b, 1);
    expect(s0.x).toBeCloseTo(1, 6);
    expect(s1.z).toBeCloseTo(1, 6);
  });

  it('halfway between +X and +Z lies on the unit sphere at 45°', () => {
    const m = slerpUnit(v(1, 0, 0), v(0, 0, 1), 0.5);
    expect(m.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(m.z).toBeCloseTo(Math.SQRT1_2, 6);
    expect(Math.hypot(m.x, m.y, m.z)).toBeCloseTo(1, 6);
  });

  it('handles identical inputs without dividing by zero', () => {
    const a = v(0, 1, 0);
    expect(() => slerpUnit(a, a, 0.5)).not.toThrow();
    const r = slerpUnit(a, a, 0.5);
    expect(r.y).toBeCloseTo(1, 6);
  });

  it('all interpolated points sit on the unit sphere', () => {
    const a = v(1, 0, 0);
    const b = v(0, 1, 0);
    for (let t = 0; t <= 1; t += 0.1) {
      const p = slerpUnit(a, b, t);
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
    }
  });
});

describe('subdivideArc', () => {
  it('returns at least both endpoints', () => {
    const arc = subdivideArc(v(1, 0, 0), v(0, 0, 1), Math.PI);
    expect(arc.length).toBeGreaterThanOrEqual(2);
    expect(arc[0]!.x).toBeCloseTo(1, 6);
    expect(arc[arc.length - 1]!.z).toBeCloseTo(1, 6);
  });

  it('subdivides a 90° arc into ≥ 90 points at 1° steps', () => {
    const arc = subdivideArc(v(1, 0, 0), v(0, 0, 1), Math.PI / 180);
    expect(arc.length).toBeGreaterThanOrEqual(91); // 90 segments → 91 points
  });

  it('all output points sit on the unit sphere', () => {
    const arc = subdivideArc(v(1, 0, 0), v(0, 1, 0), Math.PI / 18); // 10° steps
    for (const p of arc) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
  });

  it('handles co-located endpoints without a divide-by-zero', () => {
    const arc = subdivideArc(v(0, 0, 1), v(0, 0, 1), Math.PI / 180);
    expect(arc.length).toBeGreaterThanOrEqual(2);
    for (const p of arc) expect(p.z).toBeCloseTo(1, 6);
  });
});

describe('subdivideBoundary', () => {
  it('emits a closed loop where the last vertex equals the first', () => {
    const polygon = [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)];
    const loop = subdivideBoundary(polygon, Math.PI / 4); // 45° steps
    expect(loop[0]!.x).toBeCloseTo(1, 6);
    const last = loop[loop.length - 1]!;
    expect(last.x).toBeCloseTo(1, 6);
    expect(last.y).toBeCloseTo(0, 6);
    expect(last.z).toBeCloseTo(0, 6);
  });

  it('does not duplicate the stitch vertex between consecutive arcs', () => {
    // Triangle with 3 vertices and 4-step subdivision per edge would naively
    // give 12 points; with stitching skipped it should be 9 + 1 closing = 10.
    const polygon = [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)];
    const loop = subdivideBoundary(polygon, Math.PI / 6); // 30° steps; each edge is 90°
    // Expect 3 edges × 3 segments = 9 segments → 10 vertices in a closed loop.
    expect(loop.length).toBe(10);
  });

  it('rejects a polygon with fewer than 3 vertices', () => {
    expect(() => subdivideBoundary([v(1, 0, 0), v(0, 1, 0)], 1)).toThrow();
  });
});

describe('centroid', () => {
  it('returns the mean direction of three orthogonal vertices', () => {
    const c = centroid([v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)]);
    const k = 1 / Math.sqrt(3);
    expect(c.x).toBeCloseTo(k, 6);
    expect(c.y).toBeCloseTo(k, 6);
    expect(c.z).toBeCloseTo(k, 6);
  });

  it('returns a unit vector', () => {
    const c = centroid([v(1, 0, 0), v(0.5, 0.866, 0), v(0.5, -0.866, 0)]);
    expect(Math.hypot(c.x, c.y, c.z)).toBeCloseTo(1, 6);
  });

  it('falls back to the first vertex when the mean is degenerate', () => {
    // Two antipodal points sum to zero — fallback to first.
    const c = centroid([v(1, 0, 0), v(-1, 0, 0)]);
    expect(c.x).toBeCloseTo(1, 6);
  });

  it('throws on an empty list', () => {
    expect(() => centroid([])).toThrow();
  });
});

describe('buildLines / buildBounds', () => {
  it('builds a line entry with polyline vertices in the equatorial frame', () => {
    const lines = buildLines({
      And: { name: 'Andromeda', lines: [[[0, 0], [90, 0]]] },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.abbr).toBe('And');
    expect(lines[0]!.polylines[0]![0]!.z).toBeCloseTo(1, 6); // RA=0 → +Z
    expect(lines[0]!.polylines[0]![1]!.x).toBeCloseTo(1, 6); // RA=90° → +X
  });

  it('builds a bound entry whose vertex list is subdivided ≥ raw count', () => {
    const bounds = buildBounds(
      { And: { name: 'Andromeda', vertices: [[0, 0], [90, 0], [180, 0]] } },
      Math.PI / 18, // 10° steps; each edge is 90°
    );
    expect(bounds).toHaveLength(1);
    expect(bounds[0]!.vertices.length).toBeGreaterThan(3);
    // Centroid of three equatorial points spread over 180° should sit on the equator.
    expect(bounds[0]!.centroid.y).toBeCloseTo(0, 4);
  });
});
