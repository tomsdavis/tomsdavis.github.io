// Spec §4.3, §6.4: thin wrapper over astronomy-engine. Exposes Sun direction,
// Moon position + phase, planet positions (Mercury–Saturn), and Greenwich
// apparent sidereal time. Requests "of-date" coordinates so a future precession
// rotation (§8.2) can be added cleanly.
//
// Kept agnostic about how its output is rendered (§8.1).
