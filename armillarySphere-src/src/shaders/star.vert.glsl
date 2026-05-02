// Spec §4.4: per-star size from V magnitude (linear in mag, log in flux)
// clamped at both ends so bright stars don't bloat into discs and faint
// stars stay 1px. The same clamped-linear shape lives in CPU as magToSize
// (catalogue-loader.ts) — the JS side is what tests cover; this is the
// runtime echo.
//
// vDiscard carries the magnitude-limit decision to the fragment shader
// (1.0 → discard). Doing it here means the slider is a uniform write, not
// a geometry reupload.

attribute float aMag;
attribute vec3 aColor;

uniform float uPixelRatio;
uniform float uMagLimit;

varying vec3 vColor;
varying float vDiscard;

void main() {
  vColor = aColor;
  vDiscard = step(uMagLimit, aMag);

  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  float sizePx = clamp(6.0 - aMag, 1.0, 9.0);
  gl_PointSize = sizePx * uPixelRatio;
  gl_Position = projectionMatrix * mvPos;
}
