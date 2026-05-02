import { describe, it, expect } from 'vitest';
import { parseBsc5Line, encodeCatalogue, type Bsc5Record } from '../tools/build-catalogue';

const HR1_LINE =
  '   1          BD+44 4550      3 36042          46           000001.1+444022000509.9+451345114.44-16.88 6.70  +0.07 +0.08         A1Vn               -0.012-0.018      -018      195  4.2  21.6AC   3';

const HR2_LINE =
  '   2          BD-01 4525      6128569                       235956.2-010330000503.8-003011 98.33-61.14 6.29  +1.10 +1.02        gG9                 +0.045-0.060      +014V';

const HR92_NOVA_LINE =
  '  92 NOVA 1572                                     B Cas                                                                                                                                            *';

describe('parseBsc5Line', () => {
  it('parses HR 1 (33 Psc) — RA/Dec in radians, V mag, B−V', () => {
    const r = parseBsc5Line(HR1_LINE);
    expect(r).not.toBeNull();
    expect(r!.hr).toBe(1);
    // RA = 00h 05m 09.9s → (0 + 5/60 + 9.9/3600) * π/12
    expect(r!.raJ2000).toBeCloseTo((0 + 5 / 60 + 9.9 / 3600) * (Math.PI / 12), 6);
    // Dec = +45° 13' 45" → in radians, positive
    expect(r!.decJ2000).toBeCloseTo((45 + 13 / 60 + 45 / 3600) * (Math.PI / 180), 6);
    expect(r!.vMag).toBeCloseTo(6.7, 3);
    expect(r!.bvIndex).toBeCloseTo(0.07, 3);
  });

  it('handles negative declination (HR 2)', () => {
    const r = parseBsc5Line(HR2_LINE);
    expect(r).not.toBeNull();
    expect(r!.hr).toBe(2);
    expect(r!.decJ2000).toBeLessThan(0);
    expect(r!.decJ2000).toBeCloseTo(-(0 + 30 / 60 + 11 / 3600) * (Math.PI / 180), 6);
    expect(r!.bvIndex).toBeCloseTo(1.10, 3);
  });

  it('returns null for entries with no position (HR 92, Nova 1572)', () => {
    expect(parseBsc5Line(HR92_NOVA_LINE)).toBeNull();
  });

  it('returns null for short / blank input', () => {
    expect(parseBsc5Line('')).toBeNull();
    expect(parseBsc5Line('   1')).toBeNull();
  });

  it('defaults bvIndex to 0 when the B−V column is blank', () => {
    // HR 92 has no position so it short-circuits — synthesise a line where
    // RA/Dec/Vmag are present but B−V is whitespace.
    const fabricated = HR1_LINE.slice(0, 109) + '     ' + HR1_LINE.slice(114);
    const r = parseBsc5Line(fabricated);
    expect(r).not.toBeNull();
    expect(r!.bvIndex).toBe(0);
  });
});

describe('encodeCatalogue', () => {
  const sample: Bsc5Record[] = [
    { hr: 1, raJ2000: 0.5, decJ2000: -0.25, vMag: 6.7, bvIndex: 0.07 },
    { hr: 2, raJ2000: 1.0, decJ2000: 0.1, vMag: 6.29, bvIndex: 1.1 },
  ];

  it('produces a 16-byte header followed by 20-byte records', () => {
    const bytes = encodeCatalogue(sample);
    expect(bytes.length).toBe(16 + sample.length * 20);
  });

  it('writes the BSC5 magic and metadata in the header', () => {
    const bytes = encodeCatalogue(sample);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = new TextDecoder().decode(bytes.subarray(0, 4));
    expect(magic).toBe('BSC5');
    expect(view.getUint16(4, true)).toBe(1);    // version
    expect(view.getUint16(6, true)).toBe(20);   // record stride
    expect(view.getUint32(8, true)).toBe(2);    // record count
    expect(view.getUint32(12, true)).toBe(0);   // reserved
  });

  it('writes records little-endian: hr u32, ra/dec/vmag/bv f32', () => {
    const bytes = encodeCatalogue(sample);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const expected = sample[0]!;
    // Record 0
    expect(view.getUint32(16, true)).toBe(expected.hr);
    expect(view.getFloat32(20, true)).toBeCloseTo(expected.raJ2000, 5);
    expect(view.getFloat32(24, true)).toBeCloseTo(expected.decJ2000, 5);
    expect(view.getFloat32(28, true)).toBeCloseTo(expected.vMag, 5);
    expect(view.getFloat32(32, true)).toBeCloseTo(expected.bvIndex, 5);
    // Record 1 starts at offset 36
    expect(view.getUint32(36, true)).toBe(2);
    expect(view.getFloat32(40, true)).toBeCloseTo(1.0, 5);
  });

  it('encodes an empty catalogue as a header-only buffer', () => {
    const bytes = encodeCatalogue([]);
    expect(bytes.length).toBe(16);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(8, true)).toBe(0);
  });
});
