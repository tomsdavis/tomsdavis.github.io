import { describe, it, expect, beforeEach, vi } from 'vitest';
import { attachPersistence } from '../src/persistence';
import { createStore, defaultState } from '../src/state';
import { loadPersisted } from '../src/storage';

const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => Array.from(map.keys())[i] ?? null,
  };
};

describe('attachPersistence', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('writes to localStorage after a debounce when a persisted slice changes', () => {
    const store = createStore(defaultState());
    const storage = memoryStorage();
    attachPersistence(store, storage);

    store.set({ rotationMode: 'fixed-earth' });
    expect(loadPersisted(storage)).toBeNull(); // not yet flushed

    vi.advanceTimersByTime(300);
    expect(loadPersisted(storage)?.rotationMode).toBe('fixed-earth');
  });

  it('coalesces rapid changes into one flush', () => {
    const store = createStore(defaultState());
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    attachPersistence(store, storage);

    store.set({ rotationMode: 'fixed-earth' });
    store.set({ magnitudeLimit: 4 });
    store.set({ camera: { azimuth: 1, elevation: 0, distance: 3 } });
    vi.advanceTimersByTime(300);

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('does not flush when only non-persisted slices (layers, opacity) change', () => {
    const store = createStore(defaultState());
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    attachPersistence(store, storage);

    store.set({ celestialOpacity: 0.5 });
    store.set({ layers: { ...store.get().layers, celestialEquator: false } });
    vi.advanceTimersByTime(500);

    expect(setItem).not.toHaveBeenCalled();
  });

  it('the returned unsubscribe stops further flushes', () => {
    const store = createStore(defaultState());
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    const detach = attachPersistence(store, storage);

    detach();
    store.set({ rotationMode: 'fixed-earth' });
    vi.advanceTimersByTime(500);

    expect(setItem).not.toHaveBeenCalled();
  });
});
