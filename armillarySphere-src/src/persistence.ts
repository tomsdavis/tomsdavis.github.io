// Spec §5.4: subscribe to state, debounce-write to URL hash and localStorage.
// Layer toggles are not persisted.

import type { AppState, Store, Unsubscribe } from './state';
import { encodeFragment } from './url-state';
import { savePersisted } from './storage';

const DEBOUNCE_MS = 250;

const PERSISTED_SLICES: ReadonlyArray<keyof AppState> = [
  'instant', 'camera', 'magnitudeLimit', 'rotationMode',
];

export function attachPersistence(store: Store<AppState>, storage: Storage): Unsubscribe {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const s = store.get();
    const slice = {
      instant: s.instant,
      camera: s.camera,
      magnitudeLimit: s.magnitudeLimit,
      rotationMode: s.rotationMode,
    };
    const fragment = encodeFragment(slice);
    if (globalThis.history?.replaceState) {
      globalThis.history.replaceState(null, '', '#' + fragment);
    } else if (globalThis.location) {
      globalThis.location.hash = fragment;
    }
    savePersisted(slice, storage);
  };

  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(flush, DEBOUNCE_MS);
  };

  const unsubscribers = PERSISTED_SLICES.map((k) => store.subscribe(k, schedule));

  return () => {
    if (timer !== null) clearTimeout(timer);
    for (const u of unsubscribers) u();
  };
}
