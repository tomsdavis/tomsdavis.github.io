// Spec §4.1: outer sphere — the armillary anchor for stars, planets, and
// reference lines. The spec's working default is R_cs ≈ 2, but we tightened
// to 1.1 to push the armillary illusion harder: a star sits visually
// adjacent to its sub-stellar point on Earth from any external angle.
// Constraint: R_CS must stay above CAMERA_MIN_DISTANCE so the camera shell
// doesn't end up outside the celestial sphere when zoomed in.

import * as THREE from 'three';

export const R_CS = 1.1;

/**
 * Convert equatorial RA/Dec to a cartesian vector in the celestial-sphere
 * local frame: +Y is the north celestial pole, +Z is RA = 0. Pass `r = R_CS`
 * to land on the celestial sphere itself, or `r = 1` for a unit direction.
 */
export function raDecToVec3(ra: number, dec: number, r: number): THREE.Vector3 {
  const cosDec = Math.cos(dec);
  return new THREE.Vector3(
    r * cosDec * Math.sin(ra),
    r * Math.sin(dec),
    r * cosDec * Math.cos(ra),
  );
}

/**
 * True iff the line segment from `camera` to `worldPos` passes through the
 * unit-radius Earth at the world origin — i.e. the point sits behind Earth
 * from the camera's viewpoint and any label anchored there would otherwise
 * "show through" the globe.
 *
 * Geometry: parameterise the segment as C + t·(P − C) for t ∈ [0, 1]. Its
 * closest approach to the origin lies at t = −(C·(P−C)) / |P−C|². If that
 * lies in (0, 1) and the point at that t has |·| < 1, the ray pierces Earth
 * between camera and target. Pure dot products — no trigonometry, no sqrt.
 */
export function isOccludedByEarth(camera: THREE.Vector3, worldPos: THREE.Vector3): boolean {
  const dx = worldPos.x - camera.x;
  const dy = worldPos.y - camera.y;
  const dz = worldPos.z - camera.z;
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq === 0) return false;

  const cdotD = camera.x * dx + camera.y * dy + camera.z * dz;
  const t = -cdotD / lenSq;
  if (t <= 0 || t >= 1) return false;

  const cx = camera.x + t * dx;
  const cy = camera.y + t * dy;
  const cz = camera.z + t * dz;
  return cx * cx + cy * cy + cz * cz < 1;
}

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
