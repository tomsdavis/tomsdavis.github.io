// Spec §8.2: faint loop tracing the path of the of-date NCP across one full
// ~25,800-yr precession cycle. Off by default; surfaced via the Layers ▾
// popover for users who want to explore precession.
//
// Parents to celestialJ2000Root (NOT celestialRoot). The loop is computed
// PARAMETRICALLY in the J2000 frame: the NCP precesses about the J2000
// ecliptic pole on a small circle of obliquity radius (≈23.44°), so we
// just sweep the J2000 NCP around that axis through 2π. No per-sample
// astronomy-engine calls — the IAU 2006 P03 polynomial in
// `Astronomy.Rotation_EQJ_EQD` diverges badly past ~±2000 yr from J2000
// (T⁴/T⁵ terms dominate at ±130 centuries), which produced a visible
// spiral plus a radial chord toward the ecliptic pole on the original
// implementation that sampled that polynomial across ±13,000 yr.
//
// celestialJ2000Root.matrixWorld = precessionRotation(t_now), so a sample
// vertex `v_J2000` carries into world space as
//
//   worldPos = precessionRotation(t_now) · v_J2000
//
// Sample 0 sits at the J2000 NCP (0, 1, 0); at t_now = J2000 the trail
// therefore passes through world +Y (where celestialRoot's NCP marker
// sits). At any other t_now the loop rotates with the rest of
// celestialJ2000Root and the trail still passes through the of-date pole
// to within IAU model agreement at that epoch.

import * as THREE from 'three';
import { R_CS, raDecToVec3 } from './celestial-sphere';

const SAMPLES = 256;
const TRAIL_RADIUS = R_CS * 1.001;  // hair outside R_CS so it doesn't z-fight stars.

// J2000 north ecliptic pole in equatorial coordinates: RA = 18h, Dec = 90° − ε
// (mean obliquity at J2000 is 23.4392811°, so Dec ≈ +66.5607°). raDecToVec3
// produces the corresponding direction in our scene frame.
const NEP_RA  = 18 * Math.PI / 12;
const NEP_DEC = (90 - 23.4392811) * Math.PI / 180;

export function buildPrecessionTrail(): THREE.LineLoop {
  const positions = new Float32Array(SAMPLES * 3);
  const axis = raDecToVec3(NEP_RA, NEP_DEC, 1).normalize();
  const ncp = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < SAMPLES; i++) {
    const theta = (i / SAMPLES) * 2 * Math.PI;
    const v = ncp.clone().applyAxisAngle(axis, theta).multiplyScalar(TRAIL_RADIUS);
    positions[i * 3 + 0] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({
    color: 0x9c7cff,         // violet — distinct from the blue/gold/green ref families.
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const line = new THREE.LineLoop(geom, mat);
  line.renderOrder = 1;
  return line;
}
