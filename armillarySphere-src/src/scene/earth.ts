// Spec §4.1: Earth mesh (radius 1) with day/night textured ShaderMaterial.

import * as THREE from 'three';
import vertexShader from '../shaders/earth.vert.glsl?raw';
import fragmentShader from '../shaders/earth.frag.glsl?raw';

export interface EarthHandle {
  mesh: THREE.Mesh;
  setSunDirection(dirWorld: THREE.Vector3): void;
  setTerminatorEnabled(on: boolean): void;
  dispose(): void;
}

export async function createEarth(): Promise<EarthHandle> {
  const loader = new THREE.TextureLoader();
  const [day, night] = await Promise.all([
    loadSrgbTexture(loader, 'textures/earth-day.jpg'),
    loadSrgbTexture(loader, 'textures/earth-night.jpg'),
  ]);

  const uniforms = {
    uDayMap: { value: day },
    uNightMap: { value: night },
    uSunDirWorld: { value: new THREE.Vector3(1, 0, 0) },
    uTerminator: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material);
  // Three.js sphere UVs are seamed at +x. Rotate so longitude 0° (Greenwich)
  // sits at +z when the Earth root has rotation.y = 0 — that gives the
  // fixed-Earth default a recognisable orientation.
  mesh.rotation.y = -Math.PI / 2;

  return {
    mesh,
    setSunDirection(dirWorld) {
      uniforms.uSunDirWorld.value.copy(dirWorld);
    },
    setTerminatorEnabled(on) {
      uniforms.uTerminator.value = on ? 1 : 0;
    },
    dispose() {
      day.dispose();
      night.dispose();
      material.dispose();
      mesh.geometry.dispose();
    },
  };
}

function loadSrgbTexture(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}
