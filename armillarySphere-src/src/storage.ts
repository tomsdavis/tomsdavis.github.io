// Spec §5.4: localStorage layer for the persisted slice. URL state takes
// precedence over storage on load. Layer toggles are NOT persisted.

import { defaultState, type AppState } from './state';
import { decodeFragment, type PersistedState } from './url-state';

export const STORAGE_KEY = 'armillary';
export const STORAGE_VERSION = 1;

interface StoredEnvelope {
  v: number;
  data: {
    t?: number;
    cam?: [number, number, number];
    mag?: number;
    rot?: PersistedState['rotationMode'];
  };
}

export function savePersisted(slice: PersistedState, storage: Storage): void {
  const envelope: StoredEnvelope = {
    v: STORAGE_VERSION,
    data: {
      t: slice.instant.getTime(),
      cam: [slice.camera.azimuth, slice.camera.elevation, slice.camera.distance],
      mag: slice.magnitudeLimit,
      rot: slice.rotationMode,
    },
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

export function loadPersisted(storage: Storage): Partial<PersistedState> | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isEnvelope(parsed)) return null;

  if (parsed.v !== STORAGE_VERSION) {
    storage.removeItem(STORAGE_KEY);
    return null;
  }

  const out: Partial<PersistedState> = {};
  const d = parsed.data;
  if (typeof d.t === 'number' && Number.isFinite(d.t)) out.instant = new Date(d.t);
  if (Array.isArray(d.cam) && d.cam.length === 3 && d.cam.every(Number.isFinite)) {
    out.camera = { azimuth: d.cam[0]!, elevation: d.cam[1]!, distance: d.cam[2]! };
  }
  if (typeof d.mag === 'number' && Number.isFinite(d.mag)) out.magnitudeLimit = d.mag;
  if (d.rot === 'rotating-earth' || d.rot === 'fixed-earth') out.rotationMode = d.rot;

  return out;
}

function isEnvelope(value: unknown): value is StoredEnvelope {
  return (
    typeof value === 'object' && value !== null &&
    'v' in value && typeof (value as { v: unknown }).v === 'number' &&
    'data' in value && typeof (value as { data: unknown }).data === 'object'
  );
}

export function resolveInitialState(opts: {
  urlFragment: string;
  storage: Storage;
}): AppState {
  const base = defaultState();
  const stored = loadPersisted(opts.storage) ?? {};
  const url = decodeFragment(opts.urlFragment);

  return {
    ...base,
    ...pickPersisted(base, stored),
    ...pickPersisted(base, url),
  };
}

function pickPersisted(base: AppState, p: Partial<PersistedState>): Partial<AppState> {
  const out: Partial<AppState> = {};
  if (p.instant !== undefined) out.instant = p.instant;
  if (p.camera !== undefined) out.camera = p.camera;
  if (p.magnitudeLimit !== undefined) out.magnitudeLimit = p.magnitudeLimit;
  if (p.rotationMode !== undefined) out.rotationMode = p.rotationMode;
  void base;
  return out;
}
