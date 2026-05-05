// Pure-logic tests for tools/build-constellations.ts. Synthetic GeoJSON
// fixtures cover the parser shape; one real-data fixture sanity-checks the
// negative-RA normalisation against an actual d3-celestial input style.

import { describe, it, expect } from 'vitest';
import {
  CONSTELLATION_NAMES,
  normaliseVertex,
  parseLines,
  parseBounds,
  stringify,
} from '../tools/build-constellations';

describe('normaliseVertex', () => {
  it('passes through positive RAs unchanged', () => {
    expect(normaliseVertex([30.5, 45.2])).toEqual([30.5, 45.2]);
  });

  it('wraps negative RAs into 0..360 by adding 360', () => {
    expect(normaliseVertex([-15, 35.2])).toEqual([345, 35.2]);
  });

  it('leaves declination untouched (negatives are valid southern dec)', () => {
    expect(normaliseVertex([10, -45])).toEqual([10, -45]);
  });

  it('wraps RAs near the 180° boundary correctly', () => {
    expect(normaliseVertex([-179.9, 0])).toEqual([180.1, 0]);
    expect(normaliseVertex([179.9, 0])).toEqual([179.9, 0]);
  });
});

describe('CONSTELLATION_NAMES', () => {
  it('covers all 88 IAU constellations', () => {
    expect(Object.keys(CONSTELLATION_NAMES)).toHaveLength(88);
  });

  it('maps the canonical examples to their Latin names', () => {
    expect(CONSTELLATION_NAMES['And']).toBe('Andromeda');
    expect(CONSTELLATION_NAMES['Ori']).toBe('Orion');
    expect(CONSTELLATION_NAMES['UMa']).toBe('Ursa Major');
    expect(CONSTELLATION_NAMES['CrA']).toBe('Corona Australis');
  });
});

describe('parseLines', () => {
  it('emits a record per feature with name + normalised polylines', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'And',
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [[30, 42], [17, 35]],
              [[-10, 20], [-5, 25]],
            ],
          },
        },
      ],
    });

    const out = parseLines(text);
    expect(out['And']!.name).toBe('Andromeda');
    expect(out['And']!.lines).toHaveLength(2);
    expect(out['And']!.lines[0]).toEqual([[30, 42], [17, 35]]);
    expect(out['And']!.lines[1]).toEqual([[350, 20], [355, 25]]);
  });

  it('throws on an unknown constellation abbreviation', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'Xyz', geometry: { type: 'MultiLineString', coordinates: [[[0, 0]]] } },
      ],
    });
    expect(() => parseLines(text)).toThrow(/unknown constellation/i);
  });

  it('rejects a feature whose geometry is not MultiLineString', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'And', geometry: { type: 'Point', coordinates: [0, 0] } },
      ],
    });
    expect(() => parseLines(text)).toThrow(/MultiLineString/);
  });
});

describe('parseBounds', () => {
  it('emits a record per feature with name + outer-ring vertices', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'Ori',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [[80, 22], [80, -10], [70, -10], [70, 22]],
            ],
          },
        },
      ],
    });

    const out = parseBounds(text);
    expect(out['Ori']!.name).toBe('Orion');
    expect(out['Ori']!.vertices).toEqual([[80, 22], [80, -10], [70, -10], [70, 22]]);
  });

  it('drops Polygon inner rings if present (only the outer is kept)', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'Ori',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [[80, 22], [80, -10], [70, -10], [70, 22]],
              [[75, 5], [76, 5], [76, 6]],
            ],
          },
        },
      ],
    });

    const out = parseBounds(text);
    expect(out['Ori']!.vertices).toHaveLength(4);
  });

  it('rejects a degenerate polygon (< 3 outer vertices)', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'And', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] } },
      ],
    });
    expect(() => parseBounds(text)).toThrow(/degenerate/);
  });
});

describe('stringify', () => {
  it('orders top-level keys alphabetically for stable diffs', () => {
    const value = { Zzz: 1, Ari: 2, Boo: 3 };
    const text = stringify(value);
    const order = ['Ari', 'Boo', 'Zzz'].map((k) => text.indexOf(`"${k}"`));
    expect(order[0]).toBeLessThan(order[1]!);
    expect(order[1]).toBeLessThan(order[2]!);
  });

  it('rounds floats to 4 decimals', () => {
    const text = stringify({ a: { x: 30.974812345, y: -15.535123 } });
    expect(text).toContain('30.9748');
    expect(text).toContain('-15.5351');
    expect(text).not.toContain('30.974812345');
  });

  it('terminates with a newline (POSIX-friendly)', () => {
    const text = stringify({ a: 1 });
    expect(text.endsWith('\n')).toBe(true);
  });
});
