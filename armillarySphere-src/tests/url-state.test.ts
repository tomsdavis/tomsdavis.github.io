import { describe, it, expect } from 'vitest';
import { encodeFragment, decodeFragment } from '../src/url-state';

describe('url-state', () => {
  it('roundtrips a fully-populated state through encode → decode', () => {
    const state = {
      instant: new Date('2026-05-02T12:00:00Z'),
      camera: { azimuth: 1.234, elevation: 0.567, distance: 3.5 },
      magnitudeLimit: 5.0,
      rotationMode: 'fixed-earth' as const,
      gridGrain: 15,
      raUnits: 'degrees' as const,
    };
    const fragment = encodeFragment(state);
    const decoded = decodeFragment(fragment);

    expect(decoded.instant?.getTime()).toBe(state.instant.getTime());
    expect(decoded.camera?.azimuth).toBeCloseTo(state.camera.azimuth, 3);
    expect(decoded.camera?.elevation).toBeCloseTo(state.camera.elevation, 3);
    expect(decoded.camera?.distance).toBeCloseTo(state.camera.distance, 3);
    expect(decoded.magnitudeLimit).toBeCloseTo(state.magnitudeLimit, 3);
    expect(decoded.rotationMode).toBe('fixed-earth');
    expect(decoded.gridGrain).toBe(15);
    expect(decoded.raUnits).toBe('degrees');
  });

  it('encodes the documented fragment shape (t / cam / mag / rot / grn / ru)', () => {
    const state = {
      instant: new Date(0),
      camera: { azimuth: 0, elevation: 0, distance: 5 },
      magnitudeLimit: 5,
      rotationMode: 'rotating-earth' as const,
      gridGrain: 30,
      raUnits: 'hours' as const,
    };
    const fragment = encodeFragment(state);

    expect(fragment).toMatch(/(^|&)t=/);
    expect(fragment).toMatch(/(^|&)cam=/);
    expect(fragment).toMatch(/(^|&)mag=/);
    expect(fragment).toMatch(/(^|&)rot=/);
    expect(fragment).toMatch(/(^|&)grn=/);
    expect(fragment).toMatch(/(^|&)ru=/);
    expect(fragment.startsWith('#')).toBe(false);
  });

  it('uses compact rot codes (re / fe), not the full enum names', () => {
    const re = encodeFragment({
      instant: new Date(0), camera: { azimuth: 0, elevation: 0, distance: 5 },
      magnitudeLimit: 5, rotationMode: 'rotating-earth',
      gridGrain: 30, raUnits: 'hours',
    });
    const fe = encodeFragment({
      instant: new Date(0), camera: { azimuth: 0, elevation: 0, distance: 5 },
      magnitudeLimit: 5, rotationMode: 'fixed-earth',
      gridGrain: 30, raUnits: 'hours',
    });
    expect(re).toMatch(/(^|&)rot=re(&|$)/);
    expect(fe).toMatch(/(^|&)rot=fe(&|$)/);
  });

  it('uses compact ru codes (h / d) and round-trips both', () => {
    expect(decodeFragment('ru=h').raUnits).toBe('hours');
    expect(decodeFragment('ru=d').raUnits).toBe('degrees');
    expect(decodeFragment('ru=potato').raUnits).toBeUndefined();
  });

  it('parses gridGrain as a positive number, ignoring junk', () => {
    expect(decodeFragment('grn=15').gridGrain).toBe(15);
    expect(decodeFragment('grn=0').gridGrain).toBeUndefined();
    expect(decodeFragment('grn=-30').gridGrain).toBeUndefined();
    expect(decodeFragment('grn=banana').gridGrain).toBeUndefined();
  });

  it('decodes both rot codes', () => {
    expect(decodeFragment('rot=re').rotationMode).toBe('rotating-earth');
    expect(decodeFragment('rot=fe').rotationMode).toBe('fixed-earth');
  });

  it('drops an unknown rot code rather than coercing it', () => {
    expect(decodeFragment('rot=potato').rotationMode).toBeUndefined();
  });

  it('returns an empty object for an empty fragment', () => {
    expect(decodeFragment('')).toEqual({});
    expect(decodeFragment('#')).toEqual({});
  });

  it('tolerates a leading # on input', () => {
    const fragment = '#t=1000&mag=4.5';
    const decoded = decodeFragment(fragment);
    expect(decoded.instant?.getTime()).toBe(1000);
    expect(decoded.magnitudeLimit).toBe(4.5);
  });

  it('returns Partial — missing keys decode to undefined', () => {
    const decoded = decodeFragment('mag=3');
    expect(decoded.instant).toBeUndefined();
    expect(decoded.camera).toBeUndefined();
    expect(decoded.magnitudeLimit).toBe(3);
  });

  it('ignores malformed numeric values rather than throwing', () => {
    const decoded = decodeFragment('t=banana&cam=1,2&mag=NaN');
    expect(decoded.instant).toBeUndefined();
    expect(decoded.camera).toBeUndefined();
    expect(decoded.magnitudeLimit).toBeUndefined();
  });
});
