// Spec §4.7: stick-figure constellation lines and IAU 1930 boundaries on
// the celestial sphere. Latin-name labels (a separate HTML overlay layer
// in src/ui/labels.ts) anchor to the centroids exposed on the handle.
//
// Both lines and boundaries collapse into single THREE.LineSegments objects
// to keep the draw call count flat — there are 88 constellations × ~10
// segments each for lines, and ~1.6k boundary vertices in total. Each layer
// has independent visibility tied to state.layers.constellation{Lines,Boundaries}.

import * as THREE from 'three';
import { R_CS } from './celestial-sphere';
import type { Constellations } from '../astronomy/constellation-loader';

/** Lines sit just outside the star points (R_CS) — same offset as the
 *  reference lines in scene/lines.ts so all celestial-frame overlays stack
 *  consistently. */
const LINE_R = R_CS + 0.001;

const COLORS = {
  /** Constellations are a celestial-frame overlay distinct from the
   *  coordinate grid (blue) and the ecliptic (gold). Lavender keeps them in
   *  the cool family but visibly separate from the equator. */
  lines: 0xb89cd0,
  boundaries: 0x4a3d5c,
};

export interface CentroidEntry {
  abbr: string;
  name: string;
  /** Position on the celestial sphere local frame (× R_CS), suitable for
   *  HTML-overlay projection by the labels module. */
  localPos: THREE.Vector3;
}

export interface ConstellationsHandle {
  /** Single group parented under celestialRoot; holds both line meshes. */
  group: THREE.Group;
  setLinesVisible(on: boolean): void;
  setBoundariesVisible(on: boolean): void;
  /** Centroids exposed for the label overlay; sorted by IAU abbreviation. */
  centroids: CentroidEntry[];
  dispose(): void;
}

/** Pack a list of polylines into a flat (start, end) buffer suitable for
 *  THREE.LineSegments. Each input polyline of length n contributes n − 1
 *  segments. */
function polylinesToSegmentBuffer(
  polylines: ReadonlyArray<ReadonlyArray<THREE.Vector3>>,
  radius: number,
): Float32Array {
  let total = 0;
  for (const p of polylines) total += Math.max(0, p.length - 1) * 2;
  const arr = new Float32Array(total * 3);
  let w = 0;
  for (const p of polylines) {
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!;
      const b = p[i + 1]!;
      arr[w++] = a.x * radius; arr[w++] = a.y * radius; arr[w++] = a.z * radius;
      arr[w++] = b.x * radius; arr[w++] = b.y * radius; arr[w++] = b.z * radius;
    }
  }
  return arr;
}

export function createConstellations(data: Constellations): ConstellationsHandle {
  const group = new THREE.Group();
  group.name = 'constellations';

  // Lines: flatten all polylines from all constellations into one buffer.
  const linePolylines = data.lines.flatMap((c) => c.polylines);
  const linesArr = polylinesToSegmentBuffer(linePolylines, LINE_R);
  const linesGeom = new THREE.BufferGeometry();
  linesGeom.setAttribute('position', new THREE.BufferAttribute(linesArr, 3));
  const linesMat = new THREE.LineBasicMaterial({
    color: COLORS.lines,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const linesObj = new THREE.LineSegments(linesGeom, linesMat);
  linesObj.renderOrder = 1;
  group.add(linesObj);

  // Boundaries: each entry's `vertices` is a closed loop already subdivided
  // to ~1° steps by the loader. Treat each as a single polyline.
  const boundaryPolylines = data.bounds.map((b) => b.vertices);
  const boundsArr = polylinesToSegmentBuffer(boundaryPolylines, LINE_R);
  const boundsGeom = new THREE.BufferGeometry();
  boundsGeom.setAttribute('position', new THREE.BufferAttribute(boundsArr, 3));
  const boundsMat = new THREE.LineBasicMaterial({
    color: COLORS.boundaries,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const boundsObj = new THREE.LineSegments(boundsGeom, boundsMat);
  boundsObj.renderOrder = 1;
  group.add(boundsObj);

  // Centroids for label placement, sorted by IAU abbreviation for stable
  // iteration order in the labels overlay.
  const centroids: CentroidEntry[] = data.bounds
    .map((b) => ({
      abbr: b.abbr,
      name: b.name,
      localPos: b.centroid.clone().multiplyScalar(LINE_R),
    }))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));

  return {
    group,
    setLinesVisible(on) { linesObj.visible = on; },
    setBoundariesVisible(on) { boundsObj.visible = on; },
    centroids,
    dispose() {
      linesGeom.dispose(); linesMat.dispose();
      boundsGeom.dispose(); boundsMat.dispose();
    },
  };
}
