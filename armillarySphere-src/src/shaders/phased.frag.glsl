// Spec §4.5: shared fragment shader for phased bodies (Moon, Mercury, Venus).
//
// EARTH-PERSPECTIVE phase rendering: the disc represents the body's
// Earth-facing hemisphere, with lit fraction governed by the real Sun-Body-
// Earth phase angle, NOT by the camera's vantage. A full Moon stays fully lit
// even when the user orbits the camera to the anti-Sun side, because the disc
// is interpreted as Earth's view of the body, not the camera's.
//
// The lit-direction L is constructed in disc-local frame as
//   (sin(phase) · screenXYDir,  cos(phase))
// where:
//   - cos(phase) is `uPhaseCos` — independent of camera, drives the lit
//     fraction at the disc centre.
//   - screenXYDir is the screen-space projection of the body-to-Sun
//     direction, normalised — gives an intuitive crescent orientation
//     (lit side points roughly toward where the Sun appears in screen).
//
// Note: `uBodyToSunLocal` (set in JS) must be the *real* direction from the
// body to the Sun (computed from astronomy-engine GeoVector positions), NOT
// the scene-projected direction. For the Moon they nearly coincide, but for
// inferior planets the apparent geometry is wildly off the real geometry —
// the whole reason for using GeoVector and not a scene-position dot product.

varying vec2 vUv;
varying vec3 vBodyToSunView;

uniform sampler2D uTexture;
uniform float uPhaseCos;

void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;

  // Sphere normal in disc-local frame, +Z toward the (notional) Earth viewer.
  vec3 n = vec3(c, sqrt(1.0 - r2));

  // Earth-perspective lit-direction. xy from screen projection of the real
  // body-to-Sun direction; depth pinned to cos(phase) so the lit fraction at
  // disc centre always reflects the true phase angle.
  float xyMagSq = dot(vBodyToSunView.xy, vBodyToSunView.xy);
  vec2 xyDir = (xyMagSq > 1e-6) ? vBodyToSunView.xy * inversesqrt(xyMagSq) : vec2(0.0, 1.0);
  float sinPhase = sqrt(max(0.0, 1.0 - uPhaseCos * uPhaseCos));
  vec3 L = vec3(xyDir * sinPhase, uPhaseCos);

  float lit = max(0.0, dot(n, L));

  vec4 tex = texture2D(uTexture, vUv);
  // A small ambient floor so the unlit hemisphere remains a faint silhouette
  // rather than disappearing entirely — matches what the eye sees of an
  // earthshine-illuminated crescent moon.
  float ambient = 0.05;
  gl_FragColor = vec4(tex.rgb * (lit + ambient), tex.a);

  #include <colorspace_fragment>
}
