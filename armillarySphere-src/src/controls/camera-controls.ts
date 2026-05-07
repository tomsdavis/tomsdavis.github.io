// Spec §4.2: orbit camera controls via the Pointer Events API.
//
// Pure helpers (clampCamera, applyDrag, applyWheelZoom) are TDD'd. The
// imperative attach() wires DOM events; not directly unit-tested.

import type { AppState, Store } from '../state';

export const CAMERA_MIN_DISTANCE = 1.05;
// Default camera distance is 3.0 (see defaultState); MAX bumped from 3 to 5
// in pass 5d to leave headroom above the default and keep the globe clear of
// the bottom drawer at typical viewports.
export const CAMERA_MAX_DISTANCE = 5;
export const ELEVATION_LIMIT = Math.PI / 2 - 0.01;

const DRAG_SENSITIVITY = 0.005;
const WHEEL_SENSITIVITY = 0.001;

export type CameraSlice = AppState['camera'];

export function clampCamera(c: CameraSlice): CameraSlice {
  return {
    azimuth: c.azimuth,
    elevation: clamp(c.elevation, -ELEVATION_LIMIT, ELEVATION_LIMIT),
    distance: clamp(c.distance, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE),
  };
}

export function applyDrag(c: CameraSlice, dx: number, dy: number, sensitivity = DRAG_SENSITIVITY): CameraSlice {
  // Trackball convention: dx > 0 (drag right) orbits the camera LEFT so the
  // globe's surface follows the cursor rather than fleeing it.
  return clampCamera({
    azimuth: c.azimuth - dx * sensitivity,
    elevation: c.elevation + dy * sensitivity,
    distance: c.distance,
  });
}

export function applyWheelZoom(c: CameraSlice, deltaY: number, sensitivity = WHEEL_SENSITIVITY): CameraSlice {
  return clampCamera({
    azimuth: c.azimuth,
    elevation: c.elevation,
    distance: c.distance * Math.exp(deltaY * sensitivity),
  });
}

// Pinch zoom: ratio = currentPointerSeparation / previousPointerSeparation.
// Fingers spreading (ratio > 1) zooms IN, so camera distance shrinks by the
// inverse ratio. Same multiplicative model as the wheel — composing pinches
// is equivalent to multiplying ratios.
export function applyPinchZoom(c: CameraSlice, ratio: number): CameraSlice {
  return clampCamera({
    azimuth: c.azimuth,
    elevation: c.elevation,
    distance: c.distance / ratio,
  });
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface CameraControls {
  detach(): void;
  resetView(): void;
}

const DEFAULT_CAMERA: CameraSlice = { azimuth: Math.PI / 4, elevation: Math.PI / 6, distance: 3.0 };

export function attachCameraControls(opts: {
  element: HTMLElement;
  store: Store<AppState>;
}): CameraControls {
  const { element, store } = opts;
  // Track up to two active pointers so a second touch can switch from drag
  // (one pointer) into pinch (two pointers) and back. Map keyed by pointerId.
  const pointers = new Map<number, { x: number; y: number }>();
  let mode: 'idle' | 'drag' | 'pinch' = 'idle';
  let dragLast: { x: number; y: number } | null = null;
  let pinchLastDist: number | null = null;

  const pinchDistance = (): number => {
    const [a, b] = pointers.values();
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (pointers.size >= 2) return;
    element.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      mode = 'drag';
      dragLast = { x: e.clientX, y: e.clientY };
    } else {
      mode = 'pinch';
      dragLast = null;
      pinchLastDist = pinchDistance();
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (mode === 'drag' && dragLast) {
      const dx = e.clientX - dragLast.x;
      const dy = e.clientY - dragLast.y;
      dragLast = { x: e.clientX, y: e.clientY };
      store.set({ camera: applyDrag(store.get().camera, dx, dy) });
    } else if (mode === 'pinch' && pinchLastDist !== null && pinchLastDist > 0) {
      const currDist = pinchDistance();
      if (currDist > 0) {
        store.set({ camera: applyPinchZoom(store.get().camera, currDist / pinchLastDist) });
      }
      pinchLastDist = currDist;
    }
  };

  const onPointerEnd = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    try { element.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    pointers.delete(e.pointerId);

    if (pointers.size === 0) {
      mode = 'idle';
      dragLast = null;
      pinchLastDist = null;
    } else {
      // Dropped from pinch back to drag. Re-anchor dragLast to the surviving
      // pointer's current position so the next pointermove doesn't compute a
      // huge dx/dy from the lifted pointer's last coords.
      const remaining = pointers.values().next().value;
      mode = 'drag';
      pinchLastDist = null;
      dragLast = remaining ? { x: remaining.x, y: remaining.y } : null;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    store.set({ camera: applyWheelZoom(store.get().camera, e.deltaY) });
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerEnd);
  element.addEventListener('pointercancel', onPointerEnd);
  element.addEventListener('wheel', onWheel, { passive: false });

  return {
    detach() {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerEnd);
      element.removeEventListener('pointercancel', onPointerEnd);
      element.removeEventListener('wheel', onWheel);
    },
    resetView() {
      store.set({ camera: { ...DEFAULT_CAMERA } });
    },
  };
}
