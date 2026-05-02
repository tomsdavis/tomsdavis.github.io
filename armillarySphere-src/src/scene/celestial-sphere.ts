// Spec §4.1: outer sphere of radius R_cs ≈ 2 — the armillary anchor for
// stars, planets, and reference lines. In this pass it is rendered only as
// a faint wireframe placeholder; stars and constellations land in pass 3+.

import * as THREE from 'three';

export const R_CS = 2;

export interface CelestialSphereHandle {
  group: THREE.Group;
  setOpacity(opacity: number): void;
  dispose(): void;
}

export function createCelestialSphere(): CelestialSphereHandle {
  const group = new THREE.Group();

  const wireframe = new THREE.Mesh(
    new THREE.SphereGeometry(R_CS, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x223355,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      wireframe: true,
    }),
  );
  group.add(wireframe);

  return {
    group,
    setOpacity(opacity) {
      (wireframe.material as THREE.MeshBasicMaterial).opacity = opacity;
    },
    dispose() {
      wireframe.geometry.dispose();
      (wireframe.material as THREE.Material).dispose();
    },
  };
}
