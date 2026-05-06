import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { precessionRotation } from '../src/astronomy/ephemeris';
import { buildPrecessionTrail } from '../src/scene/precession-trail';
import { R_CS } from '../src/scene/celestial-sphere';

const ARCSEC = (Math.PI / 180) / 3600;

/** Angle between two unit vectors in radians, clamped against fp noise. */
function angleBetween(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
}

describe('precessionRotation', () => {
  it('is approximately identity at J2000.0', () => {
    // J2000.0 is 2000-01-01 12:00 TT; UTC offset ~64s is negligible at the
    // few-arcsec tolerance we care about for "approximately identity".
    const m = precessionRotation(new Date('2000-01-01T12:00:00Z'));

    // Test all three scene basis vectors.
    const ex = new THREE.Vector3(1, 0, 0).applyMatrix4(m);
    const ey = new THREE.Vector3(0, 1, 0).applyMatrix4(m);
    const ez = new THREE.Vector3(0, 0, 1).applyMatrix4(m);

    // EQJ→EQD is mean precession + nutation; nutation amplitude is ~9″ in
    // longitude and ~6″ in obliquity, so residual at J2000 is on the order
    // of tens of arcseconds. 30″ tolerance covers it comfortably.
    expect(angleBetween(ex, new THREE.Vector3(1, 0, 0))).toBeLessThan(30 * ARCSEC);
    expect(angleBetween(ey, new THREE.Vector3(0, 1, 0))).toBeLessThan(30 * ARCSEC);
    expect(angleBetween(ez, new THREE.Vector3(0, 0, 1))).toBeLessThan(30 * ARCSEC);
  });

  it('moves the vernal-equinox direction by ~1.4° over a century', () => {
    // General precession in longitude is ~5028.8 arcsec/century → 1.397°.
    const m = precessionRotation(new Date('2100-01-01T12:00:00Z'));
    const equinox = new THREE.Vector3(0, 0, 1); // J2000 vernal equinox in scene frame.
    const moved = equinox.clone().applyMatrix4(m);
    const angleDeg = angleBetween(equinox, moved) * 180 / Math.PI;
    expect(angleDeg).toBeGreaterThan(1.30);
    expect(angleDeg).toBeLessThan(1.50);
  });

  it('drifts the celestial pole by ~5.5° great-circle over a millennium', () => {
    // The pole traces a small circle of obliquity radius (~23.44°) about the
    // ecliptic pole. Over 1000 yr the azimuth around that circle advances by
    // ~360 × (1000/25800) ≈ 14°; the resulting GREAT-CIRCLE separation is
    //   acos(cos²ε + sin²ε · cos 14°) ≈ 5.5°
    // — NOT the 14° azimuthal angle. This is the visible drift as it would
    // appear in the rendered scene.
    const m = precessionRotation(new Date('3000-01-01T12:00:00Z'));
    const ncp = new THREE.Vector3(0, 1, 0);
    const moved = ncp.clone().applyMatrix4(m);
    const angleDeg = angleBetween(ncp, moved) * 180 / Math.PI;
    expect(angleDeg).toBeGreaterThan(5);
    expect(angleDeg).toBeLessThan(6);
  });

  it('preserves vector lengths (rotation is orthogonal)', () => {
    const m = precessionRotation(new Date('2500-06-15T00:00:00Z'));
    for (const v of [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0.6, 0.5, -0.6).normalize(),
    ]) {
      const out = v.clone().applyMatrix4(m);
      expect(out.length()).toBeCloseTo(1, 6);
    }
  });

  it('propagates through a matrixAutoUpdate=false sub-group exactly as the scene graph does at runtime', () => {
    // Integration-style: wire celestialRoot ⟶ celestialJ2000Root (matrixAutoUpdate
    // off) ⟶ child object the same way scene.ts does. Set the precession matrix
    // on the sub-group; verify the child's world position picks it up after a
    // single scene.updateMatrixWorld() call (which is what WebGLRenderer.render
    // does each frame).
    const scene = new THREE.Scene();
    const celestialRoot = new THREE.Group();
    const celestialJ2000Root = new THREE.Group();
    celestialJ2000Root.matrixAutoUpdate = false;
    celestialRoot.add(celestialJ2000Root);
    scene.add(celestialRoot);

    const child = new THREE.Object3D();
    child.position.set(0, 0, 1); // J2000 vernal-equinox direction in scene frame.
    celestialJ2000Root.add(child);

    celestialJ2000Root.matrix.copy(precessionRotation(new Date('9999-01-01T12:00:00Z')));
    scene.updateMatrixWorld();

    const world = new THREE.Vector3();
    child.getWorldPosition(world);
    // ~110° drift expected at year 9999 (≈ 8000 yr × 360°/25 800 yr precession).
    const driftDeg = angleBetween(world, new THREE.Vector3(0, 0, 1)) * 180 / Math.PI;
    expect(driftDeg).toBeGreaterThan(100);
    expect(driftDeg).toBeLessThan(120);
  });

  it('keeps the ecliptic-pole direction nearly fixed (precession is about the ecliptic pole)', () => {
    // J2000 north ecliptic pole: RA 18h, Dec 90° − ε ≈ 66.56°. In our scene
    // convention (sceneX = cosDec·sinRA, sceneY = sinDec, sceneZ = cosDec·cosRA)
    // sin(270°) = −1, so sceneX = −sin(ε); sceneZ = 0; sceneY = cos(ε).
    const eps = 23.4393 * Math.PI / 180;
    const nep = new THREE.Vector3(-Math.sin(eps), Math.cos(eps), 0).normalize();

    const m = precessionRotation(new Date('3000-01-01T12:00:00Z'));
    const moved = nep.clone().applyMatrix4(m);
    // Over 1000 yr the ecliptic pole itself drifts only slightly (~47" per
    // century from planetary precession). Nutation contributes a few arcsec.
    // Allow up to 0.1°.
    const angleDeg = angleBetween(nep, moved) * 180 / Math.PI;
    expect(angleDeg).toBeLessThan(0.1);
  });
});

describe('buildPrecessionTrail', () => {
  it('produces samples on the celestial sphere at trail radius', () => {
    const line = buildPrecessionTrail();
    const pos = line.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThanOrEqual(200);
    const r = R_CS * 1.001;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      expect(Math.hypot(x, y, z)).toBeCloseTo(r, 5);
    }
  });

  it('sample points cluster at obliquity radius around the J2000 ecliptic pole', () => {
    // The of-date NCP traces a small circle of obliquity radius (≈23.44°)
    // around the J2000 ecliptic pole. The mean of the samples (in J2000
    // frame, since the trail vertices ARE J2000 by construction) should
    // therefore lie near the J2000 ecliptic pole, and every sample's
    // angular distance from that mean should be ≈ obliquity. If the matrix
    // conjugation regresses (we burned a day on this in pass 7a), this
    // test fires — wrong conjugation drifts the pole through the sphere
    // rather than tracing a small circle.
    const line = buildPrecessionTrail();
    const pos = line.geometry.getAttribute('position');
    let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < pos.count; i++) {
      mx += pos.getX(i); my += pos.getY(i); mz += pos.getZ(i);
    }
    const n = pos.count;
    const mean = new THREE.Vector3(mx / n, my / n, mz / n).normalize();
    const r = R_CS * 1.001;
    let maxAngle = 0, minAngle = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).divideScalar(r);
      const ang = Math.acos(THREE.MathUtils.clamp(v.dot(mean), -1, 1));
      maxAngle = Math.max(maxAngle, ang);
      minAngle = Math.min(minAngle, ang);
    }
    // Obliquity ≈ 23.44° = 0.4091 rad. Allow generous bounds — obliquity
    // varies slowly over 26 ka, plus the loop isn't perfectly closed.
    const OBL = 23.44 * Math.PI / 180;
    expect(maxAngle).toBeLessThan(OBL + 0.05);
    expect(minAngle).toBeGreaterThan(OBL - 0.05);
  });
});
