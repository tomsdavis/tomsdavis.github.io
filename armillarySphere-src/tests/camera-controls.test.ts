import { describe, it, expect } from 'vitest';
import {
  applyDrag,
  applyWheelZoom,
  clampCamera,
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
