import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { precessionRotation } from '../src/astronomy/ephemeris';

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
