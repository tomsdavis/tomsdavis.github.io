// Spec §6.2: convert constellation sources → JSON in public/.
//
// Lines: Stellarium's modern Western set (constellationship.fab) →
//   public/constellation-lines.json   {[abbr]: {hrPairs: [hr, hr][], name}}
//
// Boundaries: IAU 1930 Delporte boundaries in J2000 (Davenhall format) →
//   public/constellation-boundaries.json   [{abbr, vertices: [ra, dec][]}]
//   Edges between consecutive vertices are drawn as great-circle arcs
//   subdivided to ~1° steps at render time (loader subdivides; this writer
//   stores raw vertices only).
//
// Source data: data/source/{constellationship.fab, iau-boundaries.dat}.

throw new Error('build-constellations: not yet implemented');
