// Spec §6.1: convert BSC5 source (text or FITS) → packed binary at
// public/bsc5.bin, plus public/bsc5-names.json keyed by HR number.
//
// Binary layout (all little-endian):
//   Header (16 bytes):
//     0:  4  magic        ASCII "BSC5"
//     4:  2  version      uint16 = 1
//     6:  2  recordStride uint16 = 20
//     8:  4  recordCount  uint32
//    12:  4  reserved     0
//   Record (20 bytes):
//     0:  4  hr           uint32
//     4:  4  raJ2000      float32 (radians)
//     8:  4  decJ2000     float32 (radians)
//    12:  4  vMag         float32
//    16:  4  bvIndex      float32
//
// Source data: data/source/bsc5.dat (gitignored — fetch separately).
// Run: deno task build-catalogue   (task to be added once implemented).

throw new Error('build-catalogue: not yet implemented');
