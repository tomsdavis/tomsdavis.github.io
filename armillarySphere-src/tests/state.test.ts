import { describe, it, expect, vi } from 'vitest';
import { createStore, defaultState, type AppState } from '../src/state';

describe('defaultState', () => {
  it('returns sensible defaults including rotation mode', () => {
    const s = defaultState();
    expect(s.rotationMode).toBe('rotating-earth');
    expect(s.magnitudeLimit).toBeGreaterThan(0);
    expect(s.magnitudeLimit).toBeLessThanOrEqual(6.5);
    expect(s.camera.distance).toBeGreaterThan(2);
    expect(s.camera.distance).toBeLessThan(10);
    expect(s.instant).toBeInstanceOf(Date);
  });
});

describe('createStore', () => {
  const make = (overrides: Partial<AppState> = {}) =>
    createStore<AppState>({ ...defaultState(), ...overrides });

  it('get() returns the initial state', () => {
    const initial = defaultState();
    const store = createStore(initial);
    expect(store.get()).toBe(initial);
  });

  it('set() shallow-merges and exposes the new state via get()', () => {
    const store = make();
    store.set({ magnitudeLimit: 4.0 });
    expect(store.get().magnitudeLimit).toBe(4.0);
    expect(store.get().rotationMode).toBe('rotating-earth');
  });

  it('notifies a slice subscriber when that slice changes', () => {
    const store = make();
    const cb = vi.fn();
    store.subscribe('rotationMode', cb);
    store.set({ rotationMode: 'fixed-earth' });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('fixed-earth');
  });

  it('does not notify a slice subscriber when an unrelated slice changes', () => {
    const store = make();
    const cb = vi.fn();
    store.subscribe('rotationMode', cb);
    store.set({ magnitudeLimit: 4.0 });
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not notify when the new value is identical (Object.is)', () => {
    const store = make({ magnitudeLimit: 5.0 });
    const cb = vi.fn();
    store.subscribe('magnitudeLimit', cb);
    store.set({ magnitudeLimit: 5.0 });
    expect(cb).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers on the same slice', () => {
    const store = make();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    store.subscribe('rotationMode', cb1);
    store.subscribe('rotationMode', cb2);
    store.set({ rotationMode: 'fixed-earth' });
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('returns an unsubscribe function that stops further notifications', () => {
    const store = make();
    const cb = vi.fn();
    const unsubscribe = store.subscribe('rotationMode', cb);
    store.set({ rotationMode: 'fixed-earth' });
    unsubscribe();
    store.set({ rotationMode: 'rotating-earth' });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('replaces the state object reference on set (so subscribers see immutable snapshots)', () => {
    const store = make();
    const before = store.get();
    store.set({ magnitudeLimit: 4.5 });
    const after = store.get();
    expect(after).not.toBe(before);
    expect(before.magnitudeLimit).not.toBe(4.5);
  });
});
