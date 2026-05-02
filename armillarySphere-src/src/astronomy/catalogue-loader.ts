// Spec §6.1: fetch and parse the BSC5 binary (16-byte header + 20-byte records,
// little-endian). Header magic = ASCII "BSC5", version 1, record stride 20.
// The parser also pre-computes unit-sphere positions (RA/Dec → x,y,z) so the
// scene can hand the buffer to a THREE.Points BufferAttribute unmodified.
//
// magToSize and bvToColor are pure helpers consumed by the star shader (§4.4):
//   - size: linear in magnitude (which is itself a log-flux scale), clamped so
//     bright stars don't bloat into discs and faint stars stay 1px.
//   - colour: piecewise-linear interpolation across a small B−V → RGB anchor
//     table approximating the blackbody curve. Good enough for visual cueing,
//     not for radiometry.

const HEADER_SIZE = 16;
const RECORD_STRIDE = 20;
const FORMAT_VERSION = 1;
const MAGIC = 'BSC5';

export type Catalogue = Readonly<{
  count: number;
  hr: Uint32Array;
  /** Length count × 3, in unit-sphere coordinates (J2000 equatorial). */
  positions: Float32Array;
  magnitudes: Float32Array;
  bv: Float32Array;
}>;

const toDataView = (input: ArrayBufferLike | ArrayBufferView): DataView => {
  if (ArrayBuffer.isView(input)) {
    return new DataView(input.buffer, input.byteOffset, input.byteLength);
  }
  return new DataView(input);
};

export const parseBsc5Binary = (input: ArrayBufferLike | ArrayBufferView): Catalogue => {
  const view = toDataView(input);

  if (view.byteLength < HEADER_SIZE) {
    throw new Error(`bsc5: buffer too short for header (${view.byteLength} bytes)`);
  }
  const magic = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3),
  );
  if (magic !== MAGIC) throw new Error(`bsc5: bad magic "${magic}", expected "BSC5"`);

  const version = view.getUint16(4, true);
  if (version !== FORMAT_VERSION) {
    throw new Error(`bsc5: unsupported version ${version}, expected ${FORMAT_VERSION}`);
  }
  const stride = view.getUint16(6, true);
  if (stride !== RECORD_STRIDE) {
    throw new Error(`bsc5: unsupported record stride ${stride}, expected ${RECORD_STRIDE}`);
  }
  const count = view.getUint32(8, true);

  const hr = new Uint32Array(count);
  const positions = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const bv = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const off = HEADER_SIZE + i * stride;
    hr[i] = view.getUint32(off + 0, true);
    const ra = view.getFloat32(off + 4, true);
    const dec = view.getFloat32(off + 8, true);
    magnitudes[i] = view.getFloat32(off + 12, true);
    bv[i] = view.getFloat32(off + 16, true);

    const cosDec = Math.cos(dec);
    positions[i * 3 + 0] = cosDec * Math.cos(ra);
    positions[i * 3 + 1] = Math.sin(dec);
    positions[i * 3 + 2] = cosDec * Math.sin(ra);
  }

  return { count, hr, positions, magnitudes, bv };
};

export const loadCatalogue = async (url: string): Promise<Catalogue> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`bsc5: fetch ${url} → ${response.status}`);
  return parseBsc5Binary(await response.arrayBuffer());
};

const SIZE_AT_MAG_ZERO_PX = 6;
const SIZE_SLOPE_PX_PER_MAG = 1;
const SIZE_MIN_PX = 1;
const SIZE_MAX_PX = 9;

export const magToSize = (mag: number): number => {
  const raw = SIZE_AT_MAG_ZERO_PX - SIZE_SLOPE_PX_PER_MAG * mag;
  return Math.min(SIZE_MAX_PX, Math.max(SIZE_MIN_PX, raw));
};

type Rgb = readonly [r: number, g: number, b: number];

// Anchors approximate the blackbody locus. Values picked by eye against a few
// reference renderings; not radiometric.
const BV_ANCHORS: ReadonlyArray<readonly [bv: number, rgb: Rgb]> = [
  [-0.40, [0.61, 0.69, 1.00]],
  [-0.20, [0.78, 0.82, 1.00]],
  [ 0.00, [0.96, 0.96, 1.00]],
  [ 0.30, [1.00, 0.98, 0.91]],
  [ 0.60, [1.00, 0.96, 0.85]],
  [ 0.90, [1.00, 0.86, 0.69]],
  [ 1.30, [1.00, 0.74, 0.52]],
  [ 2.00, [1.00, 0.62, 0.38]],
];

export type StarColor = { r: number; g: number; b: number };

export const bvToColor = (bv: number): StarColor => {
  const first = BV_ANCHORS[0]!;
  const last = BV_ANCHORS[BV_ANCHORS.length - 1]!;
  if (bv <= first[0]) return { r: first[1][0], g: first[1][1], b: first[1][2] };
  if (bv >= last[0]) return { r: last[1][0], g: last[1][1], b: last[1][2] };
  for (let i = 0; i < BV_ANCHORS.length - 1; i++) {
    const a = BV_ANCHORS[i]!;
    const b = BV_ANCHORS[i + 1]!;
    if (bv >= a[0] && bv <= b[0]) {
      const t = (bv - a[0]) / (b[0] - a[0]);
      return {
        r: a[1][0] + (b[1][0] - a[1][0]) * t,
        g: a[1][1] + (b[1][1] - a[1][1]) * t,
        b: a[1][2] + (b[1][2] - a[1][2]) * t,
      };
    }
  }
  // Unreachable given the bounds checks above.
  return { r: 1, g: 1, b: 1 };
};
