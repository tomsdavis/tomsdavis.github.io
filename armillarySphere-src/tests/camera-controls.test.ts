import { describe, it, expect } from 'vitest';
import {
  applyDrag,
  applyPinchZoom,
  applyWheelZoom,
  clampCamera,
  decayVelocity,
  sampleVelocity,
  CAMERA_MIN_DISTANCE,
  CAMERA_MAX_DISTANCE,
  ELEVATION_LIMIT,
} from '../src/controls/camera-controls';

describe('clampCamera', () => {
  it('clamps distance to [1.05, 3]', () => {
    expect(clampCamera({ azimuth: 0, elevation: 0, distance: 0.5 }).distance).toBe(CAMERA_MIN_DISTANCE);
    expect(clampCamera({ azimuth: 0, elevation: 0, distance: 99 }).distance).toBe(CAMERA_MAX_DISTANCE);
    expect(clampCamera({ azimuth: 0, elevation: 0, distance: 3 }).distance).toBe(3);
  });

  it('clamps elevation just inside ±π/2 to avoid gimbal flip', () => {
    expect(clampCamera({ azimuth: 0, elevation: Math.PI, distance: 3 }).elevation).toBeCloseTo(ELEVATION_LIMIT);
    expect(clampCamera({ azimuth: 0, elevation: -Math.PI, distance: 3 }).elevation).toBeCloseTo(-ELEVATION_LIMIT);
  });

  it('passes a valid camera through unchanged', () => {
    const c = { azimuth: 1.0, elevation: 0.5, distance: 3 };
    expect(clampCamera(c)).toEqual(c);
  });
});

describe('applyDrag', () => {
  // Trackball / drag-with-finger convention: a feature on the globe directly
  // under the cursor should follow the cursor. That means the camera orbits
  // the OPPOSITE way from the cursor — drag right ⇒ azimuth decreases.
  it('drag right (dx > 0) decreases azimuth so the globe surface follows the cursor', () => {
    const next = applyDrag({ azimuth: 0, elevation: 0, distance: 3 }, 100, 0, 0.005);
    expect(next.azimuth).toBeCloseTo(-0.5);
    expect(next.elevation).toBe(0);
    expect(next.distance).toBe(3);
  });

  it('drag down (dy > 0) raises the camera so the front of the globe tilts down toward the cursor', () => {
    const next = applyDrag({ azimuth: 0, elevation: 0, distance: 3 }, 0, 100, 0.005);
    expect(next.elevation).toBeCloseTo(0.5);
  });

  it('clamps elevation', () => {
    const next = applyDrag({ azimuth: 0, elevation: 0, distance: 3 }, 0, 1e6, 0.005);
    expect(next.elevation).toBe(ELEVATION_LIMIT);
  });
});

describe('applyWheelZoom', () => {
  it('positive deltaY (scroll down = zoom out) increases distance', () => {
    const next = applyWheelZoom({ azimuth: 0, elevation: 0, distance: 2 }, 100, 0.001);
    expect(next.distance).toBeGreaterThan(2);
  });

  it('negative deltaY (scroll up = zoom in) decreases distance', () => {
    const next = applyWheelZoom({ azimuth: 0, elevation: 0, distance: 2 }, -100, 0.001);
    expect(next.distance).toBeLessThan(2);
  });

  it('clamps to the valid distance range', () => {
    expect(applyWheelZoom({ azimuth: 0, elevation: 0, distance: 1.05 }, -1e6, 0.001).distance).toBe(CAMERA_MIN_DISTANCE);
    expect(applyWheelZoom({ azimuth: 0, elevation: 0, distance: 3 }, 1e6, 0.001).distance).toBe(CAMERA_MAX_DISTANCE);
  });

  it('zooms multiplicatively (perceptually linear with scroll)', () => {
    const a = applyWheelZoom({ azimuth: 0, elevation: 0, distance: 2.5 }, 100, 0.001);
    const b = applyWheelZoom({ azimuth: 0, elevation: 0, distance: 1.5 }, 100, 0.001);
    // Same scroll delta from different starting points → same multiplicative ratio.
    expect(a.distance / 2.5).toBeCloseTo(b.distance / 1.5);
  });
});

describe('applyPinchZoom', () => {
  // ratio = currDist / prevDist between the two pointers. Fingers spreading
  // (ratio > 1) ⇒ zoom IN ⇒ camera distance DECREASES.
  it('ratio > 1 (fingers spreading) decreases distance', () => {
    const next = applyPinchZoom({ azimuth: 0, elevation: 0, distance: 3 }, 1.5);
    expect(next.distance).toBeCloseTo(2);
  });

  it('ratio < 1 (fingers pinching together) increases distance', () => {
    const next = applyPinchZoom({ azimuth: 0, elevation: 0, distance: 2 }, 0.5);
    expect(next.distance).toBeCloseTo(4);
  });

  it('ratio = 1 leaves distance unchanged', () => {
    const next = applyPinchZoom({ azimuth: 0.7, elevation: 0.3, distance: 2.5 }, 1);
    expect(next).toEqual({ azimuth: 0.7, elevation: 0.3, distance: 2.5 });
  });

  it('clamps to the valid distance range', () => {
    expect(applyPinchZoom({ azimuth: 0, elevation: 0, distance: 1.05 }, 100).distance).toBe(CAMERA_MIN_DISTANCE);
    expect(applyPinchZoom({ azimuth: 0, elevation: 0, distance: 3 }, 0.001).distance).toBe(CAMERA_MAX_DISTANCE);
  });

  it('composes multiplicatively (two pinches = product of ratios)', () => {
    const a = applyPinchZoom({ azimuth: 0, elevation: 0, distance: 3 }, 1.2);
    const b = applyPinchZoom(a, 1.1);
    const c = applyPinchZoom({ azimuth: 0, elevation: 0, distance: 3 }, 1.2 * 1.1);
    expect(b.distance).toBeCloseTo(c.distance);
  });

  it('does not touch azimuth or elevation', () => {
    const next = applyPinchZoom({ azimuth: 1.0, elevation: 0.5, distance: 2 }, 1.3);
    expect(next.azimuth).toBe(1.0);
    expect(next.elevation).toBe(0.5);
  });
});

describe('sampleVelocity', () => {
  // Velocity in pixels-per-millisecond, computed from displacement between
  // the most-recent pointer sample and the oldest sample still inside the
  // time window. The unit must match what the inertia tick consumes
  // (px = vx · dt_ms).
  it('returns zero for an empty buffer', () => {
    expect(sampleVelocity([], 100, 80)).toEqual({ vx: 0, vy: 0 });
  });

  it('returns zero for a single-sample buffer (no displacement available)', () => {
    expect(sampleVelocity([{ t: 0, x: 0, y: 0 }], 100, 80)).toEqual({ vx: 0, vy: 0 });
  });

  it('computes px/ms from displacement / elapsed across the window', () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 50, x: 50, y: 25 },
    ];
    expect(sampleVelocity(samples, 50, 80)).toEqual({ vx: 1, vy: 0.5 });
  });

  it('drops samples older than the window so a flick is not diluted by stale stationary samples', () => {
    const samples = [
      // Pointer was idle for a long time, then flicked in the last 50ms.
      { t: 0, x: 100, y: 100 },
      { t: 500, x: 100, y: 100 },
      { t: 550, x: 200, y: 100 }, // 100px in 50ms = 2 px/ms
    ];
    const v = sampleVelocity(samples, 550, 80);
    expect(v.vx).toBeCloseTo(2);
    expect(v.vy).toBeCloseTo(0);
  });

  it('returns zero when all in-window samples share a timestamp (no div-by-zero)', () => {
    const samples = [
      { t: 100, x: 0, y: 0 },
      { t: 100, x: 50, y: 50 },
    ];
    expect(sampleVelocity(samples, 100, 80)).toEqual({ vx: 0, vy: 0 });
  });
});

describe('decayVelocity', () => {
  // Exponential decay: v(t+dt) = v(t) · exp(-dt / tau).
  // tau is the e-folding time — after tau ms, velocity is at 1/e ≈ 37%.
  it('leaves velocity unchanged when dt = 0', () => {
    const v = { vx: 3, vy: -2 };
    expect(decayVelocity(v, 0, 300)).toEqual(v);
  });

  it('decays to 1/e after one tau', () => {
    const next = decayVelocity({ vx: 1, vy: 0 }, 300, 300);
    expect(next.vx).toBeCloseTo(1 / Math.E);
    expect(next.vy).toBe(0);
  });

  it('decays both axes by the same factor', () => {
    const next = decayVelocity({ vx: 4, vy: -3 }, 150, 300);
    const factor = Math.exp(-150 / 300);
    expect(next.vx).toBeCloseTo(4 * factor);
    expect(next.vy).toBeCloseTo(-3 * factor);
  });

  it('composes (two halves of dt = one full dt)', () => {
    const v = { vx: 5, vy: 1 };
    const oneStep = decayVelocity(v, 200, 300);
    const twoStep = decayVelocity(decayVelocity(v, 100, 300), 100, 300);
    expect(twoStep.vx).toBeCloseTo(oneStep.vx);
    expect(twoStep.vy).toBeCloseTo(oneStep.vy);
  });
});
