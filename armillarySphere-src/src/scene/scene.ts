// Spec §4.1, §7: Three.js scene assembly. Owns the renderer, camera, scene
// root, and the per-frame update path that pulls from the state store +
// ephemeris and applies the rotation-mode helper.

import * as THREE from 'three';
import { createEarth, type EarthHandle } from './earth';
import { createCelestialSphere, type CelestialSphereHandle } from './celestial-sphere';
import { rotationFor } from './rotation';
import { sunDirection, gast } from '../astronomy/ephemeris';
import type { AppState } from '../state';

export interface SceneHandle {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  earth: EarthHandle;
  celestial: CelestialSphereHandle;
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

  const earth = await createEarth();
  earthRoot.add(earth.mesh);

  const celestial = createCelestialSphere();
  celestialRoot.add(celestial.group);

  return {
    renderer,
    camera,
    earth,
    celestial,
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
    },

    dispose() {
      earth.dispose();
      celestial.dispose();
      renderer.dispose();
    },
  };
}

/**
 * Convert equatorial RA/Dec to a unit-radius cartesian vector in the
 * celestial-sphere local frame: +Y is the north celestial pole, +Z is RA = 0.
 */
function raDecToVec3(ra: number, dec: number, r: number): THREE.Vector3 {
  const cosDec = Math.cos(dec);
  return new THREE.Vector3(
    r * cosDec * Math.sin(ra),
    r * Math.sin(dec),
    r * cosDec * Math.cos(ra),
  );
}
