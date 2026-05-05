// Spec §7: single source of truth for app state, with a small subscription API.
// Modules subscribe to slices they care about. No global event bus, no framework.

export type RotationMode = 'rotating-earth' | 'fixed-earth';

/** Display unit for right-ascension labels around the celestial equator. */
export type RaUnits = 'hours' | 'degrees';

export interface Layers {
  // §4.6 — celestial sphere references
  /** Celestial equator great circle + tick marks at every 15°, with RA labels. */
  celestialEquator: boolean;
  /** Full graticule (parallels + meridians) at `gridGrain` degrees. */
  celestialGrid: boolean;
  /** Ecliptic great circle (the Sun's annual path). */
  ecliptic: boolean;
  /** N/S markers at the celestial poles. */
  poles: boolean;
  // §4.6 — terrestrial references (Earth)
  /** Terrestrial equator + 15° tick marks. */
  terrestrialEquator: boolean;
  /** Earth lat/lon graticule at `gridGrain` degrees. */
  terrestrialGrid: boolean;
  /** Earth 0° meridian, highlighted. */
  primeMeridian: boolean;
  // §4.7 — constellations
  constellationLines: boolean;
  constellationBoundaries: boolean;
  constellationLabels: boolean;
  // §4.4 / §4.5 — star + body labels
  starLabels: boolean;
  // §4.1 / §4.5
  terminator: boolean;
  /** §4.5 — Sun, Moon, and the five classical planets as a single layer. */
  planets: boolean;
}

export interface AppState {
  // §4.3 — canonical instant in UTC
  instant: Date;

  // §4.2 — orbit camera (radians + scene units)
  camera: { azimuth: number; elevation: number; distance: number };

  // §4.4 — star magnitude limit
  magnitudeLimit: number;

  // §4.1 — celestial-sphere opacity
  celestialOpacity: number;

  // §4.1 — rotating Earth (default) vs fixed Earth with sky rotating westward
  rotationMode: RotationMode;

  // §4.6 — graticule spacing in degrees (15 / 30 / 45 / 90). Applies to both
  // the celestial and terrestrial grids when their layer is on.
  gridGrain: number;

  // §4.6 — celestial-equator RA tick label units.
  raUnits: RaUnits;

  // §4.3 — time playback (NOT persisted; resets to paused on each visit)
  playing: boolean;
  rate: number;

  // §4.6, §4.7 — independently toggleable layers
  layers: Layers;
}

export type Listener<T> = (value: T) => void;
export type Unsubscribe = () => void;

export interface Store<S extends object> {
  get(): S;
  set(patch: Partial<S>): void;
  subscribe<K extends keyof S>(slice: K, listener: Listener<S[K]>): Unsubscribe;
}

export function defaultState(): AppState {
  return {
    instant: new Date(),
    camera: { azimuth: Math.PI / 4, elevation: Math.PI / 6, distance: 3.0 },
    magnitudeLimit: 5.0,
    celestialOpacity: 0.15,
    rotationMode: 'rotating-earth',
    gridGrain: 30,
    raUnits: 'hours',
    playing: false,
    rate: 3600,
    layers: {
      celestialEquator: true,
      celestialGrid: false,
      ecliptic: true,
      poles: false,
      terrestrialEquator: false,
      terrestrialGrid: false,
      primeMeridian: false,
      constellationLines: true,
      constellationBoundaries: false,
      constellationLabels: true,
      starLabels: true,
      terminator: true,
      planets: true,
    },
  };
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Map<keyof S, Set<Listener<unknown>>>();

  return {
    get: () => state,

    set(patch: Partial<S>) {
      const next = { ...state, ...patch } as S;
      const changed: (keyof S)[] = [];
      for (const k of Object.keys(patch) as (keyof S)[]) {
        if (!Object.is(state[k], next[k])) changed.push(k);
      }
      state = next;
      for (const k of changed) {
        const set = listeners.get(k);
        if (!set) continue;
        for (const cb of set) cb(state[k]);
      }
    },

    subscribe<K extends keyof S>(slice: K, listener: Listener<S[K]>): Unsubscribe {
      let set = listeners.get(slice);
      if (!set) {
        set = new Set();
        listeners.set(slice, set);
      }
      set.add(listener as Listener<unknown>);
      return () => {
        set!.delete(listener as Listener<unknown>);
      };
    },
  };
}
