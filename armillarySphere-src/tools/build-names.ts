// Spec §6.1 (companion file): convert IAU-CSN ASCII source → public/bsc5-names.json,
// keyed by HR number, capped at the brightest stars only.
//
// Source: data/source/iau-csn.txt (IAU WGSN's Catalog of Star Names, public
// domain via CC-BY 4.0). Fixed-width columns; we only need name, mag, and the
// HR number embedded in the Designation column. Some entries are exoplanet
// hosts whose designations are catalog IDs like "WASP-79" or "HAT-P-15" —
// those have no HR and naturally fall out of the filter.
//
// At cap mag ≤ 2.5 every surviving entry still has "HR ###" in its
// Designation, so the join to BSC5 is a regex on that column rather than an
// HD-→-HR cross-reference. The original 2.0 cap missed Polaris (V = 2.13 in
// IAU-CSN — it's a Cepheid varying ~1.98–2.13) and a handful of other famous
// names (Mizar, Algol, Eltanin, …). 2.5 brings them in without bloating the
// overlay. If raised further, the few HR-less entries beyond mag 2.5 can be
// patched in by extending this with an HD lookup.
//
// Run: `deno task build-names` (writes public/bsc5-names.json).

declare const Deno: {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, data: string): Promise<void>;
};
declare global {
  interface ImportMeta { main: boolean }
}

export type IauName = {
  name: string;
  designation: string;
  hr: number | null;
  mag: number | null;
};

const HR_RE = /^HR\s+(\d+)\b/;

// Column ranges (0-indexed half-open) determined empirically from IAU-CSN's
// fixed-width layout. The HD slot widens from 5 to 6 chars when the value
// overflows 5 digits; slice(97, 104) handles both.
const NAME_SLICE: readonly [number, number] = [0, 17];
const DESIGNATION_SLICE: readonly [number, number] = [36, 49];
const MAG_SLICE: readonly [number, number] = [81, 87];

export const parseIauCsnLine = (line: string): IauName | null => {
  if (!line || line.startsWith('#') || line.startsWith('$')) return null;
  if (line.length < 87) return null;

  const name = line.slice(NAME_SLICE[0], NAME_SLICE[1]).trim();
  if (!name) return null;

  const designation = line.slice(DESIGNATION_SLICE[0], DESIGNATION_SLICE[1]).trim();
  const magStr = line.slice(MAG_SLICE[0], MAG_SLICE[1]).trim();

  let hr: number | null = null;
  const m = designation.match(HR_RE);
  if (m && m[1]) hr = parseInt(m[1], 10);

  let mag: number | null = null;
  if (magStr && magStr !== '_') {
    const n = Number(magStr);
    if (Number.isFinite(n)) mag = n;
  }

  return { name, designation, hr, mag };
};

export const buildNameMap = (
  lines: readonly string[],
  magCutoff: number,
): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const line of lines) {
    const parsed = parseIauCsnLine(line);
    if (!parsed) continue;
    if (parsed.hr === null) continue;
    if (parsed.mag === null || parsed.mag > magCutoff) continue;
    map[String(parsed.hr)] = parsed.name;
  }
  return map;
};

if (import.meta.main) {
  const inputPath = 'data/source/iau-csn.txt';
  const outputPath = 'public/bsc5-names.json';
  const magCutoff = 2.5;

  const text = await Deno.readTextFile(inputPath);
  const map = buildNameMap(text.split('\n'), magCutoff);

  // Sort by HR for stable, diff-friendly output.
  const sorted = Object.fromEntries(
    Object.entries(map).sort(([a], [b]) => Number(a) - Number(b)),
  );
  await Deno.writeTextFile(outputPath, JSON.stringify(sorted, null, 2) + '\n');

  console.log(
    `Wrote ${outputPath}: ${Object.keys(sorted).length} named stars at mag ≤ ${magCutoff}`,
  );
}
