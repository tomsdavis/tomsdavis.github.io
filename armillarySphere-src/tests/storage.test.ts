import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPersisted,
  savePersisted,
  resolveInitialState,
  STORAGE_KEY,
  STORAGE_VERSION,
} from '../src/storage';
import { defaultState } from '../src/state';

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

describe('storage', () => {
  let storage: Storage;
  beforeEach(() => { storage = memoryStorage(); });

  describe('savePersisted / loadPersisted', () => {
    it('roundtrips a persisted slice through localStorage', () => {
      const slice = {
        instant: new Date('2026-05-02T12:00:00Z'),
        camera: { azimuth: 1, elevation: 0.5, distance: 4 },
        magnitudeLimit: 5,
        rotationMode: 'fixed-earth' as const,
      };
      savePersisted(slice, storage);
      const loaded = loadPersisted(storage);
      expect(loaded?.instant?.getTime()).toBe(slice.instant.getTime());
      expect(loaded?.camera).toEqual(slice.camera);
      expect(loaded?.magnitudeLimit).toBe(5);
      expect(loaded?.rotationMode).toBe('fixed-earth');
    });

    it('returns null when nothing is stored', () => {
      expect(loadPersisted(storage)).toBeNull();
    });

    it('returns null and wipes storage on a version mismatch', () => {
      storage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION + 1, data: {} }));
      expect(loadPersisted(storage)).toBeNull();
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('returns null on malformed JSON without throwing', () => {
      storage.setItem(STORAGE_KEY, 'not-json');
      expect(loadPersisted(storage)).toBeNull();
    });
  });

  describe('resolveInitialState', () => {
    it('uses defaults when nothing is in URL or storage', () => {
      const state = resolveInitialState({ urlFragment: '', storage });
      const d = defaultState();
      expect(state.rotationMode).toBe(d.rotationMode);
      expect(state.magnitudeLimit).toBe(d.magnitudeLimit);
      expect(state.celestialOpacity).toBe(d.celestialOpacity);
      expect(state.layers).toEqual(d.layers);
    });

    it('applies storage on top of defaults', () => {
      savePersisted(
        {
          instant: new Date('2026-01-01T00:00:00Z'),
          camera: { azimuth: 0, elevation: 0, distance: 4 },
          magnitudeLimit: 3.5,
          rotationMode: 'fixed-earth',
        },
        storage,
      );
      const state = resolveInitialState({ urlFragment: '', storage });
      expect(state.magnitudeLimit).toBe(3.5);
      expect(state.rotationMode).toBe('fixed-earth');
    });

    it('lets URL state override stored state', () => {
      savePersisted(
        {
          instant: new Date('2026-01-01T00:00:00Z'),
          camera: { azimuth: 0, elevation: 0, distance: 4 },
          magnitudeLimit: 3.5,
          rotationMode: 'fixed-earth',
        },
        storage,
      );
      const state = resolveInitialState({
        urlFragment: '#mag=5.5&rot=re',
        storage,
      });
      expect(state.magnitudeLimit).toBe(5.5);
      expect(state.rotationMode).toBe('rotating-earth');
    });

    it('partial URL state still inherits other slices from storage', () => {
      savePersisted(
        {
          instant: new Date('2026-01-01T00:00:00Z'),
          camera: { azimuth: 0, elevation: 0, distance: 4 },
          magnitudeLimit: 3.5,
          rotationMode: 'fixed-earth',
        },
        storage,
      );
      const state = resolveInitialState({
        urlFragment: '#mag=5.5',
        storage,
      });
      expect(state.magnitudeLimit).toBe(5.5);
      expect(state.rotationMode).toBe('fixed-earth');
    });

    it('does not persist layer toggles (§5.4)', () => {
      savePersisted(
        {
          instant: new Date('2026-05-02T12:00:00Z'),
          camera: { azimuth: 1, elevation: 0.5, distance: 4 },
          magnitudeLimit: 5,
          rotationMode: 'fixed-earth',
        },
        storage,
      );
      const raw = storage.getItem(STORAGE_KEY)!;
      expect(raw).not.toContain('equator');
      expect(raw).not.toContain('ecliptic');
      expect(raw).not.toContain('layers');
    });
  });
});
