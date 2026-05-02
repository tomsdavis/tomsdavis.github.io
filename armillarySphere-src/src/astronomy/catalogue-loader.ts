// Spec §6.1: fetch and parse the BSC5 binary (16-byte header + 20-byte records,
// little-endian). Header magic = ASCII "BSC5", version 1, record stride 20.
// Returns Float32 arrays for RA/Dec/mag/B−V plus a Uint32 array of HR ids.
//
// Kept agnostic about how its output is rendered (§8.1).
