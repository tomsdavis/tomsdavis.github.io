// Spec §4.6: reference lines and grids — celestial equator + ticks +
// graticule + ecliptic + cardinal-pole markers, plus the terrestrial
// equator + lat/lon graticule + prime meridian on Earth.
//
// Geometry generators are pure functions (parallelPoints, meridianPoints,
// eclipticPoints, equatorTickEndpoints) so they can be tested independently
// of Three.js scene assembly.
//
// Frame convention matches celestial-sphere.ts and earth.ts:
//   +Y = pole axis (NCP for celestial, geographic north for Earth)
//   +Z = RA = 0  (celestial)  /  longitude = 0 (Greenwich) in earthRoot
// raDecToVec3 doubles as a longitude/latitude → vector helper for Earth.

import * as THREE from 'three';
import { R_CS, raDecToVec3 } from './celestial-sphere';
import type { Layers, RaUnits } from '../state';

/** J2000.0 mean obliquity of the ecliptic. Good to ~1 arcmin for our era. */
export const OBLIQUITY = (23.4392911 * Math.PI) / 180;

/** Lines on the celestial sphere sit just outside the star points (R_CS) so
 *  there's no z-coincidence ambiguity in the transparent pass. */
const LINE_R_CS = R_CS + 0.001;
/** Lines on Earth sit just above the surface (radius 1.0). */
const LINE_R_EARTH = 1.001;

/** Tick half-width in radians for the equator coordinate ring. */
const TICK_HALF_WIDTH = (1.0 * Math.PI) / 180;
/** Major tick (every 90°) is rendered slightly longer for visual hierarchy. */
const MAJOR_TICK_HALF_WIDTH = (2.0 * Math.PI) / 180;

const PARALLEL_SEGMENTS = 180;
const MERIDIAN_SEGMENTS = 90;
const ECLIPTIC_SEGMENTS = 240;

// --- Pure generators ---------------------------------------------------------

/** Points along a parallel of declination (constant dec, RA wrapping 0..2π). */
export function parallelPoints(
  dec: number,
  segments: number,
  radius: number,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const ra = (i / segments) * Math.PI * 2;
    points.push(raDecToVec3(ra, dec, radius));
  }
  return points;
}

/** Points along a meridian (constant RA, dec from −π/2 to +π/2). */
export function meridianPoints(
  ra: number,
  segments: number,
  radius: number,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const dec = (i / segments) * Math.PI - Math.PI / 2;
    points.push(raDecToVec3(ra, dec, radius));
  }
  return points;
}

/** Points along the ecliptic — the equator rotated by OBLIQUITY about the
 *  +Z axis (the line through the equinoxes). Verifies: at λ = π/2 (summer
 *  solstice) declination = +OBLIQUITY; at λ = 0 / π we sit on the equator. */
export function eclipticPoints(segments: number, radius: number): THREE.Vector3[] {
  const cosE = Math.cos(OBLIQUITY);
  const sinE = Math.sin(OBLIQUITY);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const lambda = (i / segments) * Math.PI * 2;
    const sinL = Math.sin(lambda);
    const cosL = Math.cos(lambda);
    points.push(new THREE.Vector3(sinL * cosE * radius, sinL * sinE * radius, cosL * radius));
  }
  return points;
}

/** Pairs of (start, end) endpoints for tick marks perpendicular to the
 *  equator, every `grainDeg` of right ascension. Output is flat: each pair
 *  of consecutive entries is one line segment (suits THREE.LineSegments). */
export function equatorTickEndpoints(
  grainDeg: number,
  halfWidth: number,
  radius: number,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const n = Math.round(360 / grainDeg);
  for (let i = 0; i < n; i++) {
    const ra = (i * grainDeg * Math.PI) / 180;
    out.push(raDecToVec3(ra, -halfWidth, radius));
    out.push(raDecToVec3(ra, halfWidth, radius));
  }
  return out;
}

// --- Buffer helpers ----------------------------------------------------------

function pointsToBuffer(points: ReadonlyArray<THREE.Vector3>): THREE.BufferGeometry {
  const arr = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    arr[i * 3 + 0] = p.x;
    arr[i * 3 + 1] = p.y;
    arr[i * 3 + 2] = p.z;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return geom;
}

/** Concatenate per-arc point lists into one LineSegments-ready buffer.
 *  Each input arc becomes a strip of (n - 1) segments — output emits each
 *  pair (i, i+1) as two consecutive vertices. */
function arcsToSegments(arcs: ReadonlyArray<ReadonlyArray<THREE.Vector3>>): THREE.BufferGeometry {
  let total = 0;
  for (const a of arcs) total += Math.max(0, a.length - 1) * 2;
  const arr = new Float32Array(total * 3);
  let w = 0;
  for (const a of arcs) {
    for (let i = 0; i < a.length - 1; i++) {
      const p = a[i]!;
      const q = a[i + 1]!;
      arr[w++] = p.x; arr[w++] = p.y; arr[w++] = p.z;
      arr[w++] = q.x; arr[w++] = q.y; arr[w++] = q.z;
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return geom;
}

// --- Pole-marker labels ------------------------------------------------------

/** Tiny text sprite used for N/S markers at the celestial poles. */
function makePoleSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.06, 0.06, 1);
  sprite.renderOrder = 1;
  return sprite;
}

// --- Element factories -------------------------------------------------------

interface LineElement {
  group: THREE.Group;
  rebuild?(grainDeg: number): void;
  dispose(): void;
}

// Three distinct hue families so the eye can disambiguate at a glance:
//   celestial sphere refs → cool blues
//   ecliptic              → solar gold (its own hue, since it's the Sun's path)
//   terrestrial refs      → warm earth greens
// Within each family the bright tone is the equator / highlighted line and
// the muted tone is the graticule.
const COLORS = {
  celestialEquator: 0x88bbee, // light blue
  celestialGrid: 0x4a6a90,    // muted blue
  ecliptic: 0xf2c14e,         // solar gold
  terrestrialEquator: 0x88e0a8, // light green
  terrestrialGrid: 0x4a7a55,    // muted green
  primeMeridian: 0xc8f0a8,      // bright pale green (terrestrial family, highlighted)
};

function lineMaterial(color: number, opacity: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

function buildEquator(radius: number, color: number): LineElement {
  const group = new THREE.Group();
  const arc = parallelPoints(0, PARALLEL_SEGMENTS, radius);
  const geom = pointsToBuffer(arc);
  const mat = lineMaterial(color, 0.7);
  const line = new THREE.LineLoop(geom, mat);
  line.renderOrder = 1;
  group.add(line);

  // 15° minor + 90° major tick marks for orientation.
  const minorEnds = equatorTickEndpoints(15, TICK_HALF_WIDTH, radius);
  const minorGeom = pointsToBuffer(minorEnds);
  const minorMat = lineMaterial(color, 0.7);
  const minorTicks = new THREE.LineSegments(minorGeom, minorMat);
  minorTicks.renderOrder = 1;
  group.add(minorTicks);

  const majorEnds = equatorTickEndpoints(90, MAJOR_TICK_HALF_WIDTH, radius);
  const majorGeom = pointsToBuffer(majorEnds);
  const majorMat = lineMaterial(color, 0.95);
  const majorTicks = new THREE.LineSegments(majorGeom, majorMat);
  majorTicks.renderOrder = 1;
  group.add(majorTicks);

  return {
    group,
    dispose() {
      geom.dispose(); mat.dispose();
      minorGeom.dispose(); minorMat.dispose();
      majorGeom.dispose(); majorMat.dispose();
    },
  };
}

function buildGrid(radius: number, color: number, initialGrain: number): LineElement {
  const group = new THREE.Group();
  const mat = lineMaterial(color, 0.4);
  let geom: THREE.BufferGeometry | null = null;
  let segments: THREE.LineSegments | null = null;

  const rebuild = (grainDeg: number) => {
    const grain = (grainDeg * Math.PI) / 180;
    const arcs: THREE.Vector3[][] = [];

    // Parallels: every grain in (-π/2, π/2), excluding the poles themselves.
    for (let dec = -Math.PI / 2 + grain; dec < Math.PI / 2 - 1e-9; dec += grain) {
      arcs.push(parallelPoints(dec, PARALLEL_SEGMENTS, radius));
    }
    // Meridians: every grain in [0, 2π).
    const nMer = Math.round(360 / grainDeg);
    for (let i = 0; i < nMer; i++) {
      const ra = (i / nMer) * Math.PI * 2;
      arcs.push(meridianPoints(ra, MERIDIAN_SEGMENTS, radius));
    }

    const newGeom = arcsToSegments(arcs);
    if (segments) {
      segments.geometry = newGeom;
    } else {
      segments = new THREE.LineSegments(newGeom, mat);
      segments.renderOrder = 1;
      group.add(segments);
    }
    if (geom) geom.dispose();
    geom = newGeom;
  };

  rebuild(initialGrain);

  return {
    group,
    rebuild,
    dispose() {
      if (geom) geom.dispose();
      mat.dispose();
    },
  };
}

function buildEcliptic(radius: number, color: number): LineElement {
  const group = new THREE.Group();
  const arc = eclipticPoints(ECLIPTIC_SEGMENTS, radius);
  const geom = pointsToBuffer(arc);
  const mat = lineMaterial(color, 0.85);
  const line = new THREE.LineLoop(geom, mat);
  line.renderOrder = 1;
  group.add(line);
  return {
    group,
    dispose() { geom.dispose(); mat.dispose(); },
  };
}

function buildPrimeMeridian(radius: number, color: number): LineElement {
  const group = new THREE.Group();
  const arc = meridianPoints(0, MERIDIAN_SEGMENTS, radius);
  const geom = pointsToBuffer(arc);
  const mat = lineMaterial(color, 0.95);
  const line = new THREE.Line(geom, mat);
  line.renderOrder = 1;
  group.add(line);
  return {
    group,
    dispose() { geom.dispose(); mat.dispose(); },
  };
}

function buildPoles(radius: number): LineElement {
  const group = new THREE.Group();
  const north = makePoleSprite('N', '#dde6f0');
  const south = makePoleSprite('S', '#dde6f0');
  north.position.set(0, radius, 0);
  south.position.set(0, -radius, 0);
  group.add(north, south);
  return {
    group,
    dispose() {
      [north, south].forEach((s) => {
        (s.material as THREE.SpriteMaterial).map?.dispose();
        (s.material as THREE.SpriteMaterial).dispose();
      });
    },
  };
}

// --- Public handle -----------------------------------------------------------

export interface LinesHandle {
  /** Parented under celestialRoot. */
  celestialGroup: THREE.Group;
  /** Parented under earthRoot. */
  terrestrialGroup: THREE.Group;
  apply(layers: Layers, gridGrain: number, raUnits: RaUnits): void;
  dispose(): void;
}

export function createLines(initial: { gridGrain: number }): LinesHandle {
  const celestialGroup = new THREE.Group();
  const terrestrialGroup = new THREE.Group();

  const celestialEquator = buildEquator(LINE_R_CS, COLORS.celestialEquator);
  const celestialGrid = buildGrid(LINE_R_CS, COLORS.celestialGrid, initial.gridGrain);
  const ecliptic = buildEcliptic(LINE_R_CS, COLORS.ecliptic);
  const poles = buildPoles(LINE_R_CS);

  const terrestrialEquator = buildEquator(LINE_R_EARTH, COLORS.terrestrialEquator);
  const terrestrialGrid = buildGrid(LINE_R_EARTH, COLORS.terrestrialGrid, initial.gridGrain);
  const primeMeridian = buildPrimeMeridian(LINE_R_EARTH, COLORS.primeMeridian);

  celestialGroup.add(
    celestialEquator.group,
    celestialGrid.group,
    ecliptic.group,
    poles.group,
  );
  terrestrialGroup.add(
    terrestrialEquator.group,
    terrestrialGrid.group,
    primeMeridian.group,
  );

  let lastGrain = initial.gridGrain;

  return {
    celestialGroup,
    terrestrialGroup,

    apply(layers, gridGrain, _raUnits) {
      celestialEquator.group.visible = layers.celestialEquator;
      celestialGrid.group.visible = layers.celestialGrid;
      ecliptic.group.visible = layers.ecliptic;
      poles.group.visible = layers.poles;
      terrestrialEquator.group.visible = layers.terrestrialEquator;
      terrestrialGrid.group.visible = layers.terrestrialGrid;
      primeMeridian.group.visible = layers.primeMeridian;

      if (gridGrain !== lastGrain) {
        celestialGrid.rebuild?.(gridGrain);
        terrestrialGrid.rebuild?.(gridGrain);
        lastGrain = gridGrain;
      }
      // _raUnits will drive the RA-tick label overlay (separate per-frame
      // projection module), wired in a follow-up step.
    },

    dispose() {
      celestialEquator.dispose();
      celestialGrid.dispose();
      ecliptic.dispose();
      poles.dispose();
      terrestrialEquator.dispose();
      terrestrialGrid.dispose();
      primeMeridian.dispose();
    },
  };
}
