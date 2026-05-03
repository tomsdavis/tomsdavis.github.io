// Spec §4.5: shared vertex shader for phased bodies (Moon, Mercury, Venus).
// Renders a unit-quad as a billboarded disc that always faces the camera, so
// the user always sees the body's Earth-facing hemisphere irrespective of
// where they orbit the camera. Per-mesh `uScale` controls the on-screen size
// in scene units (matches the SpriteMaterial scale on the unphased planets).
//
// We also compute the body-to-Sun direction in view space here and pass it
// to the fragment shader as a varying. modelViewMatrix is only available in
// the vertex prefix that Three.js auto-injects, so the matrix transform must
// happen here. The value is the same at all four vertices of the quad, so
// the varying interpolation across the disc resolves to a constant.

varying vec2 vUv;
varying vec3 vBodyToSunView;

uniform float uScale;
uniform vec3 uBodyToSunLocal;

void main() {
  vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 corner = centre + vec4(position.x * uScale, position.y * uScale, 0.0, 0.0);
  gl_Position = projectionMatrix * corner;
  vUv = uv;
  // mat3(modelViewMatrix) folds in celestialRoot.rotation.y (carried via the
  // mesh's parent transform) plus the camera's view rotation, so the uniform
  // itself only needs to be updated when state.instant changes.
  vBodyToSunView = mat3(modelViewMatrix) * uBodyToSunLocal;
}
