// Spec §4.4: round point with a soft falloff, additively blended against the
// celestial sphere. Diffraction-spike sprites for bright stars are an easy v2
// swap (§10).
//
// vColor is precomputed CPU-side from B−V via bvToColor (catalogue-loader.ts).
// Linear→sRGB conversion lives in the colorspace_fragment include — see the
// gotcha note in CLAUDE.md about ShaderMaterial not auto-injecting it.

varying vec3 vColor;
varying float vDiscard;

void main() {
  if (vDiscard > 0.5) discard;

  vec2 d = gl_PointCoord - vec2(0.5);
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;

  // Soft disc: solid core out to ~half-radius, then smooth fade to the edge.
  float alpha = 1.0 - smoothstep(0.06, 0.25, r2);
  gl_FragColor = vec4(vColor, alpha);

  #include <colorspace_fragment>
}
