// Spec §4.1: outer sphere — the armillary anchor for stars, planets, and
// reference lines. The spec's working default is R_cs ≈ 2, but we tightened
// to 1.1 to push the armillary illusion harder: a star sits visually
// adjacent to its sub-stellar point on Earth from any external angle.
// Constraint: R_CS must stay above CAMERA_MIN_DISTANCE so the camera shell
// doesn't end up outside the celestial sphere when zoomed in.
//
// R_SHELL is the radius of the rendered translucent shell, deliberately
// SMALLER than R_CS so the shell sits BETWEEN Earth and the celestial-sphere
// objects (stars, planets, lines). Increasing the shell's opacity therefore
// progressively hides Earth without dimming the celestial objects, which
// remain outside the shell from any external camera angle.

import * as THREE from 'three';

export const R_CS = 1.1;
export const R_SHELL = 1.05;

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

  // Spec §4.1: translucent FrontSide shell at R_SHELL (between Earth and
  // R_CS). The shell renders BEFORE celestial-sphere objects (default
  // renderOrder 0; stars and planets force renderOrder 1) so additive star
  // light brightens on top of the shell-tinted Earth instead of being itself
  // dimmed by the shell painted over it. depthWrite: false → alpha-blend
  // only; at opacity 1 the blend equation collapses to the shell colour and
  // Earth becomes invisible, no depth write needed. FrontSide + back-face
  // culling means the shell vanishes when the camera zooms inside it (camera
  // min 1.05 ≈ R_SHELL); same "looking at the dome from underneath" state
  // CLAUDE.md already documents.
  const geometry = new THREE.SphereGeometry(R_SHELL, 64, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x223355,
    transparent: true,
    opacity: 0.15,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(geometry, material);
  group.add(shell);

  return {
    group,
    setOpacity(opacity) {
      material.opacity = opacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
