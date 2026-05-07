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

// Inertia: velocity is in pixels-per-millisecond so a tick of dt_ms drives
// the same applyDrag as a real pointer move of (vx · dt_ms, vy · dt_ms).
export interface PointerSample { t: number; x: number; y: number; }
export interface Velocity { vx: number; vy: number; }

// Average velocity over the most recent windowMs of pointer samples. We use
// (newest.x − oldestInWindow.x) / (newest.t − oldestInWindow.t) so a flick
// reflects the recent flick, not a long stationary period before it.
export function sampleVelocity(samples: readonly PointerSample[], now: number, windowMs: number): Velocity {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const cutoff = now - windowMs;
  let oldestIdx = samples.length - 1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i]!.t < cutoff) break;
    oldestIdx = i;
  }
  const oldest = samples[oldestIdx]!;
  const newest = samples[samples.length - 1]!;
  const dt = newest.t - oldest.t;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (newest.x - oldest.x) / dt, vy: (newest.y - oldest.y) / dt };
}

// Exponential decay with time constant tau (ms). After tau ms velocity is at
// 1/e ≈ 37%; choosing tau decides how long inertia "feels".
export function decayVelocity(v: Velocity, dt: number, tau: number): Velocity {
  const f = Math.exp(-dt / tau);
  return { vx: v.vx * f, vy: v.vy * f };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface CameraControls {
  detach(): void;
  resetView(): void;
}

const DEFAULT_CAMERA: CameraSlice = { azimuth: Math.PI / 4, elevation: Math.PI / 6, distance: 3.0 };

// Inertia tunables. Window is the lookback for the release-velocity sample;
// tau is the e-folding time of the decay; the stop threshold is in px/ms
// (~5 px/s — perceptually still after this point).
const INERTIA_WINDOW_MS = 80;
const INERTIA_TAU_MS = 300;
const INERTIA_STOP_THRESHOLD = 0.005;

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
  // Ring of recent samples for the active drag pointer; consumed on release
  // to seed the inertia velocity. Cleared on pinch and on inertia start.
  let dragSamples: PointerSample[] = [];
  let inertiaRaf: number | null = null;
  let inertiaVelocity: Velocity = { vx: 0, vy: 0 };
  let inertiaLastT: number = 0;

  const stopInertia = () => {
    if (inertiaRaf !== null) {
      cancelAnimationFrame(inertiaRaf);
      inertiaRaf = null;
    }
    inertiaVelocity = { vx: 0, vy: 0 };
  };

  const inertiaTick = (now: number) => {
    const dt = now - inertiaLastT;
    inertiaLastT = now;
    // Apply remaining velocity as if it were a pointer move of v · dt pixels.
    store.set({ camera: applyDrag(store.get().camera, inertiaVelocity.vx * dt, inertiaVelocity.vy * dt) });
    inertiaVelocity = decayVelocity(inertiaVelocity, dt, INERTIA_TAU_MS);
    if (Math.hypot(inertiaVelocity.vx, inertiaVelocity.vy) < INERTIA_STOP_THRESHOLD) {
      inertiaRaf = null;
      return;
    }
    inertiaRaf = requestAnimationFrame(inertiaTick);
  };

  const startInertia = (releaseT: number) => {
    const v = sampleVelocity(dragSamples, releaseT, INERTIA_WINDOW_MS);
    if (Math.hypot(v.vx, v.vy) < INERTIA_STOP_THRESHOLD) return;
    inertiaVelocity = v;
    inertiaLastT = releaseT;
    inertiaRaf = requestAnimationFrame(inertiaTick);
  };

  const pinchDistance = (): number => {
    const [a, b] = pointers.values();
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (pointers.size >= 2) return;
    // A new touch always cancels any in-flight inertia — feels natural
    // (tap-to-stop), and prevents inertia + a fresh drag from fighting.
    stopInertia();
    element.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      mode = 'drag';
      dragLast = { x: e.clientX, y: e.clientY };
      dragSamples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
    } else {
      mode = 'pinch';
      dragLast = null;
      dragSamples = [];
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
      // Keep ~3× the velocity-sample window in the buffer so we always have
      // enough lookback even if the browser coalesces moves.
      dragSamples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
      const cutoff = e.timeStamp - INERTIA_WINDOW_MS * 3;
      while (dragSamples.length > 0 && dragSamples[0]!.t < cutoff) dragSamples.shift();
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
      // Only seed inertia from a real drag release, not from the second
      // finger lifting at the end of a pinch (mode === 'drag' here).
      if (mode === 'drag' && dragSamples.length >= 2) {
        startInertia(e.timeStamp);
      }
      mode = 'idle';
      dragLast = null;
      pinchLastDist = null;
      dragSamples = [];
    } else {
      // Dropped from pinch back to drag. Re-anchor dragLast to the surviving
      // pointer's current position so the next pointermove doesn't compute a
      // huge dx/dy from the lifted pointer's last coords. Reset velocity
      // samples so the post-pinch drag doesn't inherit pinch-frame samples.
      const remaining = pointers.values().next().value;
      mode = 'drag';
      pinchLastDist = null;
      dragLast = remaining ? { x: remaining.x, y: remaining.y } : null;
      dragSamples = remaining ? [{ t: e.timeStamp, x: remaining.x, y: remaining.y }] : [];
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
      stopInertia();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerEnd);
      element.removeEventListener('pointercancel', onPointerEnd);
      element.removeEventListener('wheel', onWheel);
    },
    resetView() {
      stopInertia();
      store.set({ camera: { ...DEFAULT_CAMERA } });
    },
  };
}
