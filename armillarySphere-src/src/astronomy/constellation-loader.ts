// Spec §6.2 (runtime side): fetch the build-time constellation JSON and turn
// it into ready-to-render unit-vector geometry. Boundaries are subdivided to
// ~1° great-circle arcs at load time so the scene module can hand the result
// directly to a THREE.LineSegments. Centroids are computed once for label
// placement on the sphere.
//
// All vectors live in the J2000 equatorial frame matching scene/celestial-
// sphere.ts: +Y = NCP, +Z = RA 0. Multiply by R_CS at draw time.

import * as THREE from 'three';

const DEG_TO_RAD = Math.PI / 180;
const BOUNDARY_STEP_RAD = (1 * Math.PI) / 180;

// --- File schema (matches tools/build-constellations.ts output) --------------

interface LinesFile {
  [abbr: string]: { name: string; lines: number[][][] };
}
interface BoundsFile {
  [abbr: string]: { name: string; vertices: number[][] };
}

// --- Runtime types -----------------------------------------------------------

export interface ConstellationLine {
  abbr: string;
  name: string;
  /** Each entry is one polyline (sequence of unit-vector vertices). */
  polylines: THREE.Vector3[][];
}

export interface ConstellationBound {
  abbr: string;
  name: string;
  /** Closed polygon vertices, subdivided to ~1° arcs along each edge. */
  vertices: THREE.Vector3[];
  /** Mean direction of the polygon vertices, normalised — anchor for the
   *  Latin-name label. */
  centroid: THREE.Vector3;
}

export interface Constellations {
  lines: ConstellationLine[];
  bounds: ConstellationBound[];
}

// --- Pure helpers ------------------------------------------------------------

/** RA (degrees) and Dec (degrees) → unit direction vector. Convention matches
 *  `raDecToVec3` in scene/celestial-sphere.ts: +Y is NCP, +Z is RA 0. */
export function raDecDegToVec3(raDeg: number, decDeg: number): THREE.Vector3 {
  const ra = raDeg * DEG_TO_RAD;
  const dec = decDeg * DEG_TO_RAD;
  const cosDec = Math.cos(dec);
  return new THREE.Vector3(cosDec * Math.sin(ra), Math.sin(dec), cosDec * Math.cos(ra));
}

/** Spherical linear interpolation between two unit vectors. Falls back to
 *  the start vector when the angle is below `1e-9` rad to avoid the sin-of-
 *  zero singularity. */
export function slerpUnit(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = Math.min(1, Math.max(-1, a.dot(b)));
  const angle = Math.acos(dot);
  if (angle < 1e-9) return a.clone();
  const sinA = Math.sin(angle);
  const wa = Math.sin((1 - t) * angle) / sinA;
  const wb = Math.sin(t * angle) / sinA;
  return new THREE.Vector3(
    a.x * wa + b.x * wb,
    a.y * wa + b.y * wb,
    a.z * wa + b.z * wb,
  );
}

/** Subdivide the arc from `a` to `b` into segments no longer than `stepRad`.
 *  Returns the full polyline including both endpoints. */
export function subdivideArc(
  a: THREE.Vector3,
  b: THREE.Vector3,
  stepRad: number,
): THREE.Vector3[] {
  const dot = Math.min(1, Math.max(-1, a.dot(b)));
  const angle = Math.acos(dot);
  const n = Math.max(1, Math.ceil(angle / stepRad));
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) out.push(slerpUnit(a, b, i / n));
  return out;
}

/** Mean of unit vectors, re-normalised. When the mean has near-zero length
 *  (vertices that wrap around the sphere — should not happen for IAU
 *  constellations, but guard against degenerate inputs in tests / fixtures)
 *  the first vertex is returned as a stable fallback. */
export function centroid(vertices: ReadonlyArray<THREE.Vector3>): THREE.Vector3 {
  if (vertices.length === 0) {
    throw new Error('centroid: empty vertex list');
  }
  let x = 0, y = 0, z = 0;
  for (const v of vertices) { x += v.x; y += v.y; z += v.z; }
  const len = Math.hypot(x, y, z);
  if (len < 1e-6) return vertices[0]!.clone();
  return new THREE.Vector3(x / len, y / len, z / len);
}

/** Walk a closed polygon's edges and emit a single subdivided loop. The
 *  output starts at vertex 0 and returns to vertex 0 (closed). */
export function subdivideBoundary(
  polygon: ReadonlyArray<THREE.Vector3>,
  stepRad: number,
): THREE.Vector3[] {
  if (polygon.length < 3) {
    throw new Error('subdivideBoundary: polygon needs at least 3 vertices');
  }
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const arc = subdivideArc(a, b, stepRad);
    // Skip the duplicate first vertex on each arc except the first, to avoid
    // redundant identical points stitching arcs together.
    for (let j = i === 0 ? 0 : 1; j < arc.length; j++) out.push(arc[j]!);
  }
  return out;
}

// --- Build-from-file ---------------------------------------------------------

export function buildLines(file: LinesFile): ConstellationLine[] {
  return Object.entries(file).map(([abbr, c]) => ({
    abbr,
    name: c.name,
    polylines: c.lines.map((polyline) =>
      polyline.map((v) => raDecDegToVec3(v[0]!, v[1]!)),
    ),
  }));
}

export function buildBounds(
  file: BoundsFile,
  stepRad: number = BOUNDARY_STEP_RAD,
): ConstellationBound[] {
  return Object.entries(file).map(([abbr, c]) => {
    const polygon = c.vertices.map((v) => raDecDegToVec3(v[0]!, v[1]!));
    return {
      abbr,
      name: c.name,
      vertices: subdivideBoundary(polygon, stepRad),
      centroid: centroid(polygon),
    };
  });
}

// --- Async fetcher -----------------------------------------------------------

export async function loadConstellations(
  linesUrl: string,
  boundsUrl: string,
): Promise<Constellations> {
  const [linesRes, boundsRes] = await Promise.all([fetch(linesUrl), fetch(boundsUrl)]);
  if (!linesRes.ok) throw new Error(`constellations: fetch ${linesUrl} → ${linesRes.status}`);
  if (!boundsRes.ok) throw new Error(`constellations: fetch ${boundsUrl} → ${boundsRes.status}`);

  const [linesJson, boundsJson] = await Promise.all([
    linesRes.json() as Promise<LinesFile>,
    boundsRes.json() as Promise<BoundsFile>,
  ]);

  return {
    lines: buildLines(linesJson),
    bounds: buildBounds(boundsJson),
  };
}
