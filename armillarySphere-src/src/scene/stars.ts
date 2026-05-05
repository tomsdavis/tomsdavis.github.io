// Spec §4.4: single THREE.Points object backed by the BSC5 binary buffer.
// Custom point shader: clamped linear-in-mag sizing, B−V → blackbody colour
// (CPU-side, computed once), fragment discard below the magnitude-limit
// uniform so the slider is a uniform write rather than a geometry reupload.

import * as THREE from 'three';
import vertexShader from '../shaders/star.vert.glsl?raw';
import fragmentShader from '../shaders/star.frag.glsl?raw';
import type { Catalogue } from '../astronomy/catalogue-loader';
import { bvToColor } from '../astronomy/catalogue-loader';
import { R_CS } from './celestial-sphere';

export interface StarsHandle {
  points: THREE.Points;
  setMagnitudeLimit(limit: number): void;
  setPixelRatio(ratio: number): void;
  dispose(): void;
}

export function createStars(catalogue: Catalogue): StarsHandle {
  const { count, positions, magnitudes, bv } = catalogue;

  // Positions arrive on the unit sphere; scale to the celestial-sphere radius
  // here so the points object can sit directly under celestialRoot without
  // an intermediate scaled group.
  const scaled = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i++) scaled[i] = positions[i]! * R_CS;

  // CPU-side B−V → RGB once at startup. The catalogue is fixed; computing
  // this in a vertex shader would just shift the work without saving it.
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = bvToColor(bv[i]!);
    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(scaled, 3));
  geometry.setAttribute('aMag', new THREE.BufferAttribute(magnitudes, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const uniforms = {
    uPixelRatio: { value: Math.min(globalThis.devicePixelRatio ?? 1, 2) },
    uMagLimit: { value: 5.0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  // The points already carry world-space coordinates (positions × R_CS),
  // so they live at the celestialRoot origin without further scaling.
  points.frustumCulled = false;
  // Render last in the transparent pass: shell (0) → reference lines (1) →
  // stars (2). Additive star light layers on top of shell-tinted Earth and
  // any line crossings, untinted itself.
  points.renderOrder = 2;

  return {
    points,
    setMagnitudeLimit(limit) {
      uniforms.uMagLimit.value = limit;
    },
    setPixelRatio(ratio) {
      uniforms.uPixelRatio.value = ratio;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
