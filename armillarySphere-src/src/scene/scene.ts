// Spec §4.1, §7: Three.js scene assembly. Owns the renderer, camera, scene
// root, and the per-frame update path that pulls from the state store +
// ephemeris and applies the rotation-mode helper.

import * as THREE from 'three';
import { createEarth, type EarthHandle } from './earth';
import { createCelestialSphere, raDecToVec3, type CelestialSphereHandle } from './celestial-sphere';
import { createStars, type StarsHandle } from './stars';
import { createPlanets, type PlanetsHandle } from './planets';
import { rotationFor } from './rotation';
import { sunDirection, gast } from '../astronomy/ephemeris';
import { loadCatalogue } from '../astronomy/catalogue-loader';
import type { AppState } from '../state';

export interface SceneHandle {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  earth: EarthHandle;
  celestial: CelestialSphereHandle;
  stars: StarsHandle;
  planets: PlanetsHandle;
  /** The parsed BSC5 catalogue, kept on the handle so the label overlay can
   *  look up world-space positions for named stars without re-fetching. */
  catalogue: import('../astronomy/catalogue-loader').Catalogue;
  earthRoot: THREE.Group;
  celestialRoot: THREE.Group;
  /** Apply state to the scene (rotation, sun direction, opacity, …). */
  apply(state: AppState): void;
  /** Render once. */
  render(): void;
  /** Resize to current canvas client size. */
  resize(width: number, height: number): void;
  dispose(): void;
}

export async function createScene(canvas: HTMLCanvasElement): Promise<SceneHandle> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const earthRoot = new THREE.Group();
  const celestialRoot = new THREE.Group();
  scene.add(earthRoot, celestialRoot);

  const [earth, catalogue, planets] = await Promise.all([
    createEarth(),
    loadCatalogue('bsc5.bin'),
    createPlanets(),
  ]);
  earthRoot.add(earth.mesh);

  const celestial = createCelestialSphere();
  celestialRoot.add(celestial.group);

  const stars = createStars(catalogue);
  celestialRoot.add(stars.points);

  celestialRoot.add(planets.group);

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
    catalogue,
    earthRoot,
    celestialRoot,

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
        lastPlanetInstantMs = tMs;
      }
      planets.setVisible(state.layers.planets);

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
      renderer.dispose();
    },
  };
}
