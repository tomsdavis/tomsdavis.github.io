// Spec §4.1: blends day and night Earth textures by dot(normal, sunDirWorld)
// with a soft transition of about 6° around the terminator. uTerminator=0
// disables the blend and shows only the day texture (uniformly lit).

uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform vec3 uSunDirWorld;
uniform float uTerminator;

varying vec2 vUv;
varying vec3 vNormalWorld;

void main() {
  vec3 day = texture2D(uDayMap, vUv).rgb;
  vec3 night = texture2D(uNightMap, vUv).rgb;

  // cosTheta runs from +1 (subsolar point) to −1 (antisolar). The terminator
  // is at cosTheta = 0; ±sin(6°) ≈ ±0.1045 brackets the soft transition.
  float cosTheta = dot(normalize(vNormalWorld), normalize(uSunDirWorld));
  float blend = smoothstep(-0.1045, 0.1045, cosTheta);

  // Fade the night side's intensity slightly past the terminator so it doesn't
  // jump from full-bright lights to full-dark.
  float nightGain = 1.0 - smoothstep(0.0, 0.4, cosTheta);

  vec3 lit = mix(night * nightGain, day, mix(blend, 1.0, 1.0 - uTerminator));
  gl_FragColor = vec4(lit, 1.0);

  // Three.js textures with colorSpace=SRGB are decoded to linear at sample
  // time, so all of the math above runs in linear. Hand off to the renderer's
  // outputColorSpace conversion (linear → sRGB for our setup) before writing
  // to the framebuffer; otherwise the canvas shows raw linear values that
  // read as dim, slightly desaturated versions of the texture colours.
  #include <colorspace_fragment>
}
