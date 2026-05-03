import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { isOccludedByEarth, raDecToVec3, R_CS } from '../src/scene/celestial-sphere';

describe('isOccludedByEarth', () => {
  it('reports a point on the far side of Earth from the camera as occluded', () => {
    // Camera at +Z, target at −Z on the celestial sphere — Earth straight between.
    const camera = new THREE.Vector3(0, 0, 2.5);
    const target = new THREE.Vector3(0, 0, -R_CS);
    expect(isOccludedByEarth(camera, target)).toBe(true);
  });

  it('reports a point on the near side as not occluded', () => {
    const camera = new THREE.Vector3(0, 0, 2.5);
    const target = new THREE.Vector3(0, 0, R_CS);
    expect(isOccludedByEarth(camera, target)).toBe(false);
  });

  it('reports a point off to the side (well outside Earth\'s silhouette) as not occluded', () => {
    const camera = new THREE.Vector3(0, 0, 2.5);
    // 90° from the line through Earth — clearly outside the silhouette.
    const target = raDecToVec3(Math.PI / 2, 0, R_CS); // (R_CS, 0, 0)
    expect(isOccludedByEarth(camera, target)).toBe(false);
  });

  it('treats a point along the line beyond Earth as occluded', () => {
    // Camera at one side, target on the far side — the very pathological case
    // where the test should return true regardless of how far the target is.
    const camera = new THREE.Vector3(2.5, 0, 0);
    const target = new THREE.Vector3(-3.0, 0, 0);
    expect(isOccludedByEarth(camera, target)).toBe(true);
  });

  it('does not occlude when both camera and target are on the same side', () => {
    // Both on +Z side — the segment never crosses Earth.
    const camera = new THREE.Vector3(0, 0, 2.5);
    const target = new THREE.Vector3(0.1, 0, 1.5);
    expect(isOccludedByEarth(camera, target)).toBe(false);
  });

  it('handles a target exactly at the camera as not occluded', () => {
    const camera = new THREE.Vector3(0, 0, 2.5);
    const target = new THREE.Vector3(0, 0, 2.5);
    expect(isOccludedByEarth(camera, target)).toBe(false);
  });
});
