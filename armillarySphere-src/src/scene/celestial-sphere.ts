// Spec §4.1: outer sphere — the armillary anchor for stars, planets, and
// reference lines. The spec's working default is R_cs ≈ 2, but we tightened
// to 1.1 to push the armillary illusion harder: a star sits visually
// adjacent to its sub-stellar point on Earth from any external angle.
// Constraint: R_CS must stay above CAMERA_MIN_DISTANCE so the camera shell
// doesn't end up outside the celestial sphere when zoomed in.

import * as THREE from 'three';

export const R_CS = 1.1;

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
