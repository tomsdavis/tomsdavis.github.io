// Spec §6.1: convert BSC5 source ASCII → packed binary at public/bsc5.bin.
//
// Source: data/source/bsc5.dat (Yale BSC5, 9110 records, 196-byte fixed-format
// ASCII rows from tdc-www.harvard.edu's distribution). 14 of those rows are
// reserved for novae / non-stellar objects with no J2000 position; we skip
// them and emit the remaining ~9096 stars.
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
//    16:  4  bvIndex      float32 (0 when missing in source)
//
// Run: `deno task build-catalogue` (writes public/bsc5.bin).

declare const Deno: {
  readTextFile(path: string): Promise<string>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
};
declare global {
  interface ImportMeta { main: boolean }
}

const HEADER_SIZE = 16;
const RECORD_STRIDE = 20;
const FORMAT_VERSION = 1;
const MAGIC = 'BSC5';

const HOURS_TO_RAD = Math.PI / 12;
const DEG_TO_RAD = Math.PI / 180;

export type Bsc5Record = {
  hr: number;
  raJ2000: number;
  decJ2000: number;
  vMag: number;
  bvIndex: number;
};

const parseFloatField = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const parseIntField = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
};

// BSC5 ReadMe column ranges are 1-based inclusive; slice() uses 0-based half-open.
//   bytes 76-90  → J2000 RA hms (76-77 h, 78-79 m, 80-83 s.s) and Dec dms
//                  (84 sign, 85-86 d, 87-88 m, 89-90 s)
//   bytes 103-107 → V mag (F5.2)
//   bytes 110-114 → B−V (F5.2)
export const parseBsc5Line = (line: string): Bsc5Record | null => {
  if (line.length < 114) return null;

  const hr = parseIntField(line.slice(0, 4));
  if (hr === null) return null;

  const raH = parseIntField(line.slice(75, 77));
  const raM = parseIntField(line.slice(77, 79));
  const raS = parseFloatField(line.slice(79, 83));
  if (raH === null || raM === null || raS === null) return null;

  const decSign = line.slice(83, 84);
  if (decSign !== '+' && decSign !== '-') return null;
  const decD = parseIntField(line.slice(84, 86));
  const decM = parseIntField(line.slice(86, 88));
  const decS = parseIntField(line.slice(88, 90));
  if (decD === null || decM === null || decS === null) return null;

  const vMag = parseFloatField(line.slice(102, 107));
  if (vMag === null) return null;

  const bv = parseFloatField(line.slice(109, 114));

  const raJ2000 = (raH + raM / 60 + raS / 3600) * HOURS_TO_RAD;
  const decMag = (decD + decM / 60 + decS / 3600) * DEG_TO_RAD;
  const decJ2000 = decSign === '-' ? -decMag : decMag;

  return { hr, raJ2000, decJ2000, vMag, bvIndex: bv ?? 0 };
};

export const encodeCatalogue = (records: readonly Bsc5Record[]): Uint8Array => {
  const buffer = new ArrayBuffer(HEADER_SIZE + records.length * RECORD_STRIDE);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  bytes[0] = MAGIC.charCodeAt(0);
  bytes[1] = MAGIC.charCodeAt(1);
  bytes[2] = MAGIC.charCodeAt(2);
  bytes[3] = MAGIC.charCodeAt(3);
  view.setUint16(4, FORMAT_VERSION, true);
  view.setUint16(6, RECORD_STRIDE, true);
  view.setUint32(8, records.length, true);

  for (const [i, r] of records.entries()) {
    const off = HEADER_SIZE + i * RECORD_STRIDE;
    view.setUint32(off + 0, r.hr, true);
    view.setFloat32(off + 4, r.raJ2000, true);
    view.setFloat32(off + 8, r.decJ2000, true);
    view.setFloat32(off + 12, r.vMag, true);
    view.setFloat32(off + 16, r.bvIndex, true);
  }

  return bytes;
};

export const buildCatalogueFromText = (
  text: string,
): { records: Bsc5Record[]; skipped: number } => {
  const records: Bsc5Record[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line === '') continue;
    const rec = parseBsc5Line(line);
    if (rec === null) skipped++;
    else records.push(rec);
  }
  return { records, skipped };
};

if (import.meta.main) {
  const inputPath = 'data/source/bsc5.dat';
  const outputPath = 'public/bsc5.bin';
  const text = await Deno.readTextFile(inputPath);
  const { records, skipped } = buildCatalogueFromText(text);
  const bytes = encodeCatalogue(records);
  await Deno.writeFile(outputPath, bytes);
  console.log(
    `Wrote ${outputPath}: ${records.length} stars (${skipped} skipped), ${bytes.length} bytes`,
  );
}
