// Spec §4.2: orbit camera controls via the Pointer Events API.
//
// Pure helpers (clampCamera, applyDrag, applyWheelZoom) are TDD'd. The
// imperative attach() wires DOM events; not directly unit-tested.

import type { AppState, Store } from '../state';

export const CAMERA_MIN_DISTANCE = 1.05;
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

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface CameraControls {
  detach(): void;
  resetView(): void;
}

const DEFAULT_CAMERA: CameraSlice = { azimuth: Math.PI / 4, elevation: Math.PI / 6, distance: 4.5 };

export function attachCameraControls(opts: {
  element: HTMLElement;
  store: Store<AppState>;
}): CameraControls {
  const { element, store } = opts;
  let dragging: { id: number; lastX: number; lastY: number } | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (dragging !== null) return;
    if (e.button !== undefined && e.button !== 0) return;
    element.setPointerCapture(e.pointerId);
    dragging = { id: e.pointerId, lastX: e.clientX, lastY: e.clientY };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (dragging === null || dragging.id !== e.pointerId) return;
    const dx = e.clientX - dragging.lastX;
    const dy = e.clientY - dragging.lastY;
    dragging.lastX = e.clientX;
    dragging.lastY = e.clientY;
    store.set({ camera: applyDrag(store.get().camera, dx, dy) });
  };

  const onPointerEnd = (e: PointerEvent) => {
    if (dragging === null || dragging.id !== e.pointerId) return;
    try { element.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    dragging = null;
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
