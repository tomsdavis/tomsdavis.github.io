import { describe, it, expect } from 'vitest';
import {
  parseBsc5Binary,
  magToSize,
  bvToColor,
} from '../src/astronomy/catalogue-loader';
import { encodeCatalogue, type Bsc5Record } from '../tools/build-catalogue';

describe('parseBsc5Binary', () => {
  it('round-trips header + records through encode → parse', () => {
    const sample: Bsc5Record[] = [
      { hr: 1, raJ2000: 0.5, decJ2000: -0.25, vMag: 6.7, bvIndex: 0.07 },
      { hr: 7001, raJ2000: 4.873, decJ2000: 0.677, vMag: 0.03, bvIndex: 0.0 },
    ];
    const bytes = encodeCatalogue(sample);
    const cat = parseBsc5Binary(bytes.buffer);
    expect(cat.count).toBe(2);
    expect(Array.from(cat.hr)).toEqual([1, 7001]);
    expect(cat.magnitudes[0]).toBeCloseTo(6.7, 5);
    expect(cat.magnitudes[1]).toBeCloseTo(0.03, 5);
    expect(cat.bv[0]).toBeCloseTo(0.07, 5);
  });

  it('emits unit-sphere positions: x=cos(Dec)sin(RA), y=sin(Dec), z=cos(Dec)cos(RA)', () => {
    const records: Bsc5Record[] = [
      { hr: 1, raJ2000: 0, decJ2000: 0, vMag: 0, bvIndex: 0 },
      { hr: 2, raJ2000: Math.PI / 2, decJ2000: 0, vMag: 0, bvIndex: 0 },
      { hr: 3, raJ2000: 0, decJ2000: Math.PI / 2, vMag: 0, bvIndex: 0 },
    ];
    const cat = parseBsc5Binary(encodeCatalogue(records).buffer);

    // Convention matches raDecToVec3: +Y = NCP, +Z = RA 0.
    // RA=0, Dec=0 → +Z
    expect(cat.positions[0]).toBeCloseTo(0, 5);
    expect(cat.positions[1]).toBeCloseTo(0, 5);
    expect(cat.positions[2]).toBeCloseTo(1, 5);
    // RA=π/2, Dec=0 → +X
    expect(cat.positions[3]).toBeCloseTo(1, 5);
    expect(cat.positions[4]).toBeCloseTo(0, 5);
    expect(cat.positions[5]).toBeCloseTo(0, 5);
    // RA=0, Dec=π/2 → +Y (north celestial pole)
    expect(cat.positions[6]).toBeCloseTo(0, 5);
    expect(cat.positions[7]).toBeCloseTo(1, 5);
    expect(cat.positions[8]).toBeCloseTo(0, 5);
  });

  it('throws on bad magic bytes', () => {
    const bad = new Uint8Array(16);
    bad.set(new TextEncoder().encode('BAD!'), 0);
    expect(() => parseBsc5Binary(bad.buffer)).toThrow(/magic/i);
  });

  it('throws on unsupported header version', () => {
    const bytes = encodeCatalogue([]);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(4, 99, true);
    expect(() => parseBsc5Binary(bytes.buffer)).toThrow(/version/i);
  });

  it('throws on unsupported record stride', () => {
    const bytes = encodeCatalogue([]);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(6, 16, true);
    expect(() => parseBsc5Binary(bytes.buffer)).toThrow(/stride/i);
  });

  it('accepts a Uint8Array view as well as a raw ArrayBuffer', () => {
    const bytes = encodeCatalogue([
      { hr: 1, raJ2000: 0, decJ2000: 0, vMag: 4, bvIndex: 0 },
    ]);
    expect(parseBsc5Binary(bytes).count).toBe(1);
  });
});

describe('magToSize', () => {
  it('decreases monotonically through the catalogue range', () => {
    expect(magToSize(0)).toBeGreaterThan(magToSize(1));
    expect(magToSize(1)).toBeGreaterThan(magToSize(2));
    expect(magToSize(2)).toBeGreaterThan(magToSize(3));
  });

  it('clamps very bright stars (mag ≪ 0) to a finite maximum', () => {
    // Two clearly saturated inputs should land on the same value.
    expect(magToSize(-5)).toBe(magToSize(-3));
  });

  it('clamps faint stars to a 1px floor so they remain visible', () => {
    expect(magToSize(8)).toBe(1);
    expect(magToSize(20)).toBe(1);
  });

  it('reaches the floor at or before the catalogue limit (mag 6.5)', () => {
    expect(magToSize(6.5)).toBe(1);
  });
});

describe('bvToColor', () => {
  it('returns warm-tinted colours for cool red stars (high B−V)', () => {
    const c = bvToColor(1.5);
    expect(c.r).toBeGreaterThan(c.b);
  });

  it('returns blue-tinted colours for hot O/B-type stars (negative B−V)', () => {
    const c = bvToColor(-0.3);
    expect(c.b).toBeGreaterThan(c.r);
  });

  it('clamps inputs above the table maximum', () => {
    expect(bvToColor(5)).toEqual(bvToColor(2));
  });

  it('clamps inputs below the table minimum', () => {
    expect(bvToColor(-2)).toEqual(bvToColor(-0.4));
  });

  it('linearly interpolates between table anchors', () => {
    const a = bvToColor(0.0);
    const b = bvToColor(0.3);
    const m = bvToColor(0.15);
    expect(m.r).toBeCloseTo((a.r + b.r) / 2, 5);
    expect(m.g).toBeCloseTo((a.g + b.g) / 2, 5);
    expect(m.b).toBeCloseTo((a.b + b.b) / 2, 5);
  });

  it('returns components in the unit interval', () => {
    for (const bv of [-0.5, 0, 0.5, 1.0, 2.5]) {
      const c = bvToColor(bv);
      expect(c.r).toBeGreaterThanOrEqual(0);
      expect(c.r).toBeLessThanOrEqual(1);
      expect(c.g).toBeGreaterThanOrEqual(0);
      expect(c.g).toBeLessThanOrEqual(1);
      expect(c.b).toBeGreaterThanOrEqual(0);
      expect(c.b).toBeLessThanOrEqual(1);
    }
  });
});
