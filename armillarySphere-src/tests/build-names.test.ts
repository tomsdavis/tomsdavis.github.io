import { describe, it, expect } from 'vitest';
import { parseIauCsnLine, buildNameMap } from '../tools/build-names';

// Real lines from data/source/iau-csn.txt — public-domain catalogue text, used
// as fixtures.
const ACHERNAR_LINE =
  'Achernar          Achernar          HR 472       alf   α     Eri A    _           0.45  V   7588  10144  24.428523 -57.236753 2016-06-30 ';

const ACRUX_LINE =
  'Acrux             Acrux             HR 4730      alf   α     Cru Aa   12266-6306  1.33  V  60718 108248 186.649563 -63.099093 2016-07-20 ';

const ABSOLUTNO_LINE =
  'Absolutno         Absolutno         XO-5         _     _     Lyn _    _          11.95  G      _      _ 116.716506  39.094572 2019-12-17 ';

const FAINT_HR_LINE =
  // Acubens, HR 3572, mag 4.26 — has HR, but fainter than the cap.
  'Acubens           Acubens           HR 3572      alf   α     Cnc Aa   08585+1151  4.26  V  44066  76756 134.621761  11.857700 2016-07-20 *';

describe('parseIauCsnLine', () => {
  it('extracts name, HR (from designation), mag for a 5-digit-HR star', () => {
    const r = parseIauCsnLine(ACHERNAR_LINE);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('Achernar');
    expect(r!.hr).toBe(472);
    expect(r!.mag).toBeCloseTo(0.45, 3);
  });

  it('handles a 6-digit HD (verifies HD-column width supports overflow)', () => {
    const r = parseIauCsnLine(ACRUX_LINE);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('Acrux');
    expect(r!.hr).toBe(4730);
  });

  it('returns hr=null for entries without an HR designation', () => {
    const r = parseIauCsnLine(ABSOLUTNO_LINE);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('Absolutno');
    expect(r!.hr).toBeNull();
  });

  it('skips comment lines starting with # or $', () => {
    expect(parseIauCsnLine('# header')).toBeNull();
    expect(parseIauCsnLine('$ note')).toBeNull();
    expect(parseIauCsnLine('')).toBeNull();
  });
});

describe('buildNameMap', () => {
  const lines = [ACHERNAR_LINE, ACRUX_LINE, ABSOLUTNO_LINE, FAINT_HR_LINE];

  it('produces an HR-keyed map of bright named stars (mag ≤ 2.0)', () => {
    const map = buildNameMap(lines, 2.0);
    expect(map).toEqual({
      '472': 'Achernar',
      '4730': 'Acrux',
    });
  });

  it('drops entries fainter than the cap', () => {
    const map = buildNameMap(lines, 2.0);
    expect(map['3572']).toBeUndefined();
  });

  it('drops entries that have no HR (e.g. exoplanet hosts at HIP only)', () => {
    const map = buildNameMap(lines, 12.0);  // would otherwise let Absolutno in
    expect(Object.values(map)).not.toContain('Absolutno');
  });

  it('honours a higher cap when asked', () => {
    const map = buildNameMap(lines, 5.0);
    expect(map['3572']).toBe('Acubens');
  });
});
