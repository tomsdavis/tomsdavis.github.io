// Spec §4.1: Earth vertex shader. Passes UVs and the world-space normal
// to the fragment shader so the day/night blend can dot it with sunDir.

varying vec2 vUv;
varying vec3 vNormalWorld;

void main() {
  vUv = uv;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
