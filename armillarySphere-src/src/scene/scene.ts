// Spec §4.1, §7: Three.js scene assembly. Owns the renderer, camera, scene
// root, and the per-frame update path that pulls from the state store +
// ephemeris and applies the rotation-mode helper.

import * as THREE from 'three';
import { createEarth, type EarthHandle } from './earth';
import { createCelestialSphere, raDecToVec3, type CelestialSphereHandle } from './celestial-sphere';
import { createStars, type StarsHandle } from './stars';
import { createPlanets, type PlanetsHandle } from './planets';
import { createLines, type LinesHandle } from './lines';
import { createConstellations, type ConstellationsHandle } from './constellations';
import { rotationFor } from './rotation';
import { sunDirection, gast, precessionRotation } from '../astronomy/ephemeris';
import { loadCatalogue } from '../astronomy/catalogue-loader';
import { loadConstellations } from '../astronomy/constellation-loader';
import type { AppState } from '../state';

export interface SceneHandle {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  earth: EarthHandle;
  celestial: CelestialSphereHandle;
  stars: StarsHandle;
  planets: PlanetsHandle;
  lines: LinesHandle;
  constellations: ConstellationsHandle;
  /** The parsed BSC5 catalogue, kept on the handle so the label overlay can
   *  look up world-space positions for named stars without re-fetching. */
  catalogue: import('../astronomy/catalogue-loader').Catalogue;
  earthRoot: THREE.Group;
  celestialRoot: THREE.Group;
  /** Sub-group inside celestialRoot that carries the J2000→of-date precession
   *  transform (spec §8.2). All celestial-frame children parent to this; the
   *  outer celestialRoot still owns the diurnal rotation. */
  celestialJ2000Root: THREE.Group;
  /** Apply state to the scene (rotation, sun direction, opacity, …). */
  apply(state: AppState): void;
  /** Render once. */
  render(): void;
  /** Resize to current canvas client size. */
  resize(width: number, height: number): void;
  dispose(): void;
}

export async function createScene(canvas: HTMLCanvasElement, initial: {
  gridGrain: number;
}): Promise<SceneHandle> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const earthRoot = new THREE.Group();
  const celestialRoot = new THREE.Group();
  // celestialJ2000Root carries the J2000→of-date precession matrix (spec
  // §8.2). Only J2000-stored objects parent here: BSC5 stars (J2000) and
  // d3-celestial constellation lines/boundaries (J2000 per CREDITS.md).
  // Sun/planets, reference lines, and the shell stay under celestialRoot —
  // they're already in the of-date scene frame (Sun/planets via the of-date
  // bodyDirection; reference lines built from raDecToVec3, which IS the
  // of-date frame the moment we apply precession to the J2000 stuff). The
  // shell is rotationally symmetric so it doesn't matter; keeping it on
  // celestialRoot avoids any depth-sorting subtlety.
  const celestialJ2000Root = new THREE.Group();
  celestialJ2000Root.matrixAutoUpdate = false;
  celestialRoot.add(celestialJ2000Root);
  scene.add(earthRoot, celestialRoot);

  const [earth, catalogue, planets, constellationData] = await Promise.all([
    createEarth(),
    loadCatalogue('bsc5.bin'),
    createPlanets(),
    loadConstellations('constellation-lines.json', 'constellation-boundaries.json'),
  ]);
  earthRoot.add(earth.mesh);

  const celestial = createCelestialSphere();
  celestialRoot.add(celestial.group);

  const stars = createStars(catalogue);
  celestialJ2000Root.add(stars.points);

  celestialRoot.add(planets.group);

  const lines = createLines({ gridGrain: initial.gridGrain });
  celestialRoot.add(lines.celestialGroup);
  earthRoot.add(lines.terrestrialGroup);

  const constellations = createConstellations(constellationData);
  celestialJ2000Root.add(constellations.group);

  // Per-frame ephemeris caching: planet positions only re-resolve when the
  // canonical instant actually changes. Sub-millisecond drift in JS Date
  // comparison via getTime() is fine — the spec advances time by ≥ a few
  // milliseconds per render-loop tick at the highest rate.
  let lastPlanetInstantMs = Number.NaN;

  return {
    renderer,
    camera,
    earth,
    celestial,
    stars,
    planets,
    lines,
    constellations,
    catalogue,
    earthRoot,
    celestialRoot,
    celestialJ2000Root,

    apply(state) {
      const t = state.instant;
      const g = gast(t);
      const { earthY, celestialY } = rotationFor(state.rotationMode, g);
      earthRoot.rotation.y = earthY;
      celestialRoot.rotation.y = celestialY;

      // Sun direction in world space is fixed in rotating-earth mode (it lives
      // at sunDir RA/Dec on the celestial sphere, which has rotation 0). In
      // fixed-earth mode the celestial sphere rotates by celestialY, taking
      // the Sun direction with it.
      const sun = sunDirection(t);
      const sunLocal = raDecToVec3(sun.ra, sun.dec, 1);
      const sunWorld = sunLocal.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, celestialY);
      earth.setSunDirection(sunWorld);

      earth.setTerminatorEnabled(state.layers.terminator);
      celestial.setOpacity(state.celestialOpacity);
      stars.setMagnitudeLimit(state.magnitudeLimit);

      const tMs = t.getTime();
      if (tMs !== lastPlanetInstantMs) {
        planets.setPositions(t);
        // Precession is per-instant only; recompute on the same trigger as
        // ephemeris so we don't burn cycles per frame at high time rates.
        celestialJ2000Root.matrix.copy(precessionRotation(t));
        lastPlanetInstantMs = tMs;
      }
      planets.setVisible(state.layers.planets);

      lines.apply(state.layers, state.gridGrain, state.raUnits);

      constellations.setLinesVisible(state.layers.constellationLines);
      constellations.setBoundariesVisible(state.layers.constellationBoundaries);

      const { azimuth, elevation, distance } = state.camera;
      camera.position.set(
        distance * Math.cos(elevation) * Math.sin(azimuth),
        distance * Math.sin(elevation),
        distance * Math.cos(elevation) * Math.cos(azimuth),
      );
      camera.lookAt(0, 0, 0);
    },

    render() {
      renderer.render(scene, camera);
    },

    resize(width, height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      stars.setPixelRatio(renderer.getPixelRatio());
    },

    dispose() {
      earth.dispose();
      celestial.dispose();
      stars.dispose();
      planets.dispose();
      lines.dispose();
      constellations.dispose();
      renderer.dispose();
    },
  };
}
