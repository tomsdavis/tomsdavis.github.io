// Spec §6.2 (per the 5c "decision taken" amendment):
//
// Input — d3-celestial (BSD-3-Clause), redistributing Stellarium's modern
// Western stick figures and the Davenhall IAU 1930 boundaries pre-precessed
// to J2000:
//   data/source/d3c-lines.json   (lines)
//   data/source/d3c-bounds.json  (boundaries)
//
// Both are GeoJSON FeatureCollections with `[RA°, Dec°]` vertices and IAU
// three-letter `id` per feature. d3-celestial uses the GeoJSON longitude
// convention (RA mapped to −180..+180); we normalise to 0..360 here so the
// runtime loader doesn't have to know about that.
//
// Output — written to `public/`:
//   constellation-lines.json       { [abbr]: { name, lines: [[[ra°, dec°], ...]] } }
//   constellation-boundaries.json  { [abbr]: { name, vertices: [[ra°, dec°], ...] } }
//
// `name` is the Latin form, looked up in CONSTELLATION_NAMES below.
//
// Run: `deno task build-constellations`.

declare const Deno: {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, data: string): Promise<void>;
};
declare global {
  interface ImportMeta { main: boolean }
}

// --- Static abbr → Latin name table (88 IAU constellations) ------------------

export const CONSTELLATION_NAMES: Readonly<Record<string, string>> = {
  And: 'Andromeda',     Ant: 'Antlia',         Aps: 'Apus',
  Aql: 'Aquila',        Aqr: 'Aquarius',       Ara: 'Ara',
  Ari: 'Aries',         Aur: 'Auriga',         Boo: 'Boötes',
  CMa: 'Canis Major',   CMi: 'Canis Minor',    CVn: 'Canes Venatici',
  Cae: 'Caelum',        Cam: 'Camelopardalis', Cap: 'Capricornus',
  Car: 'Carina',        Cas: 'Cassiopeia',     Cen: 'Centaurus',
  Cep: 'Cepheus',       Cet: 'Cetus',          Cha: 'Chamaeleon',
  Cir: 'Circinus',      Cnc: 'Cancer',         Col: 'Columba',
  Com: 'Coma Berenices',CrA: 'Corona Australis', CrB: 'Corona Borealis',
  Crt: 'Crater',        Cru: 'Crux',           Crv: 'Corvus',
  Cyg: 'Cygnus',        Del: 'Delphinus',      Dor: 'Dorado',
  Dra: 'Draco',         Equ: 'Equuleus',       Eri: 'Eridanus',
  For: 'Fornax',        Gem: 'Gemini',         Gru: 'Grus',
  Her: 'Hercules',      Hor: 'Horologium',     Hya: 'Hydra',
  Hyi: 'Hydrus',        Ind: 'Indus',          LMi: 'Leo Minor',
  Lac: 'Lacerta',       Leo: 'Leo',            Lep: 'Lepus',
  Lib: 'Libra',         Lup: 'Lupus',          Lyn: 'Lynx',
  Lyr: 'Lyra',          Men: 'Mensa',          Mic: 'Microscopium',
  Mon: 'Monoceros',     Mus: 'Musca',          Nor: 'Norma',
  Oct: 'Octans',        Oph: 'Ophiuchus',      Ori: 'Orion',
  Pav: 'Pavo',          Peg: 'Pegasus',        Per: 'Perseus',
  Phe: 'Phoenix',       Pic: 'Pictor',         PsA: 'Piscis Austrinus',
  Psc: 'Pisces',        Pup: 'Puppis',         Pyx: 'Pyxis',
  Ret: 'Reticulum',     Scl: 'Sculptor',       Sco: 'Scorpius',
  Sct: 'Scutum',        Ser: 'Serpens',        Sex: 'Sextans',
  Sge: 'Sagitta',       Sgr: 'Sagittarius',    Tau: 'Taurus',
  Tel: 'Telescopium',   TrA: 'Triangulum Australe', Tri: 'Triangulum',
  Tuc: 'Tucana',        UMa: 'Ursa Major',     UMi: 'Ursa Minor',
  Vel: 'Vela',          Vir: 'Virgo',          Vol: 'Volans',
  Vul: 'Vulpecula',
};

// --- Pure parsers ------------------------------------------------------------

export type Vertex = [number, number]; // [ra°, dec°], RA in 0..360

/** Map d3-celestial's −180..+180 RA to standard 0..360. Dec untouched. */
export function normaliseVertex(v: readonly [number, number]): Vertex {
  const ra = v[0];
  const dec = v[1];
  const raNorm = ra < 0 ? ra + 360 : ra;
  return [raNorm, dec];
}

interface GeoJsonFeature<G> {
  type: 'Feature';
  id: string;
  geometry: G;
}
interface MultiLineStringGeom {
  type: 'MultiLineString';
  coordinates: number[][][]; // [polyline][vertex][lon,lat]
}
interface PolygonGeom {
  type: 'Polygon';
  coordinates: number[][][]; // [ring][vertex][lon,lat]
}
interface FeatureCollection<G> {
  type: 'FeatureCollection';
  features: GeoJsonFeature<G>[];
}

export interface ConstellationLines {
  [abbr: string]: { name: string; lines: Vertex[][] };
}
export interface ConstellationBounds {
  [abbr: string]: { name: string; vertices: Vertex[] };
}

/** Parse the d3-celestial lines GeoJSON into our schema. */
export function parseLines(text: string): ConstellationLines {
  const parsed = JSON.parse(text) as FeatureCollection<MultiLineStringGeom>;
  if (parsed.type !== 'FeatureCollection') {
    throw new Error(`expected FeatureCollection, got ${String(parsed.type)}`);
  }

  const out: ConstellationLines = {};
  for (const feature of parsed.features) {
    const abbr = feature.id;
    const name = CONSTELLATION_NAMES[abbr];
    if (!name) {
      throw new Error(`unknown constellation abbreviation: ${abbr}`);
    }
    if (feature.geometry.type !== 'MultiLineString') {
      throw new Error(`${abbr}: expected MultiLineString, got ${feature.geometry.type}`);
    }
    const lines: Vertex[][] = feature.geometry.coordinates.map((polyline) =>
      polyline.map((v) => normaliseVertex([v[0]!, v[1]!])),
    );
    out[abbr] = { name, lines };
  }
  return out;
}

/** Parse the d3-celestial bounds GeoJSON into our schema. The first ring of
 *  the Polygon is the outer boundary; we discard any inner rings (none in
 *  the IAU data, but the schema permits them). */
export function parseBounds(text: string): ConstellationBounds {
  const parsed = JSON.parse(text) as FeatureCollection<PolygonGeom>;
  if (parsed.type !== 'FeatureCollection') {
    throw new Error(`expected FeatureCollection, got ${String(parsed.type)}`);
  }

  const out: ConstellationBounds = {};
  for (const feature of parsed.features) {
    const abbr = feature.id;
    const name = CONSTELLATION_NAMES[abbr];
    if (!name) {
      throw new Error(`unknown constellation abbreviation: ${abbr}`);
    }
    if (feature.geometry.type !== 'Polygon') {
      throw new Error(`${abbr}: expected Polygon, got ${feature.geometry.type}`);
    }
    const outer = feature.geometry.coordinates[0];
    if (!outer || outer.length < 3) {
      throw new Error(`${abbr}: polygon outer ring is degenerate`);
    }
    const vertices: Vertex[] = outer.map((v) => normaliseVertex([v[0]!, v[1]!]));
    out[abbr] = { name, vertices };
  }
  return out;
}

// --- Stable-output serialisation ---------------------------------------------

/** Serialise a constellation map sorted by IAU abbreviation, with bounded
 *  numeric precision (4 dp = ~0.4 arcsec at the equator) so the diff stays
 *  stable across rebuilds and small floating-point drift. */
export function stringify(value: object): string {
  // JSON.stringify with a replacer gives us numeric rounding; the sort happens
  // by feeding ordered keys through Object.fromEntries.
  const round = (v: unknown): unknown => {
    if (typeof v === 'number') return Math.round(v * 1e4) / 1e4;
    if (Array.isArray(v)) return v.map(round);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, round(val)]));
    }
    return v;
  };
  const ordered = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify(round(ordered), null, 2) + '\n';
}

// --- CLI ---------------------------------------------------------------------

if (import.meta.main) {
  const linesPath = 'data/source/d3c-lines.json';
  const boundsPath = 'data/source/d3c-bounds.json';
  const linesOut = 'public/constellation-lines.json';
  const boundsOut = 'public/constellation-boundaries.json';

  const linesText = await Deno.readTextFile(linesPath);
  const boundsText = await Deno.readTextFile(boundsPath);

  const lines = parseLines(linesText);
  const bounds = parseBounds(boundsText);

  await Deno.writeTextFile(linesOut, stringify(lines));
  await Deno.writeTextFile(boundsOut, stringify(bounds));

  const lineCount = Object.values(lines).reduce(
    (n, c) => n + c.lines.reduce((m, p) => m + Math.max(0, p.length - 1), 0),
    0,
  );
  const vertexCount = Object.values(bounds).reduce((n, c) => n + c.vertices.length, 0);
  console.log(
    `Wrote ${linesOut}: ${Object.keys(lines).length} constellations, ${lineCount} segments`,
  );
  console.log(
    `Wrote ${boundsOut}: ${Object.keys(bounds).length} constellations, ${vertexCount} vertices`,
  );
}
