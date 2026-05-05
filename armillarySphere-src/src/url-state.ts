// Spec §5.4: encode/decode session state ↔ URL fragment.
// Format: t=<ms>&cam=<az>,<el>,<dist>&mag=<float>&rot=<re|fe>&grn=<deg>&ru=<h|d>
// Layer toggles are NOT persisted (per agreed simplification).

import type { RotationMode, RaUnits } from './state';

export interface PersistedState {
  instant: Date;
  camera: { azimuth: number; elevation: number; distance: number };
  magnitudeLimit: number;
  rotationMode: RotationMode;
  gridGrain: number;
  raUnits: RaUnits;
}

const ROT_TO_CODE: Record<RotationMode, string> = {
  'rotating-earth': 're',
  'fixed-earth': 'fe',
};
const CODE_TO_ROT: Record<string, RotationMode> = {
  re: 'rotating-earth',
  fe: 'fixed-earth',
};

const RA_TO_CODE: Record<RaUnits, string> = { hours: 'h', degrees: 'd' };
const CODE_TO_RA: Record<string, RaUnits> = { h: 'hours', d: 'degrees' };

export function encodeFragment(state: PersistedState): string {
  const { instant, camera, magnitudeLimit, rotationMode, gridGrain, raUnits } = state;
  const t = `t=${instant.getTime()}`;
  const cam = `cam=${camera.azimuth},${camera.elevation},${camera.distance}`;
  const mag = `mag=${magnitudeLimit}`;
  const rot = `rot=${ROT_TO_CODE[rotationMode]}`;
  const grn = `grn=${gridGrain}`;
  const ru = `ru=${RA_TO_CODE[raUnits]}`;
  return `${t}&${cam}&${mag}&${rot}&${grn}&${ru}`;
}

export function decodeFragment(fragment: string): Partial<PersistedState> {
  const trimmed = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (trimmed === '') return {};

  const params = new Map<string, string>();
  for (const pair of trimmed.split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    params.set(pair.slice(0, eq), pair.slice(eq + 1));
  }

  const out: Partial<PersistedState> = {};

  const tRaw = params.get('t');
  if (tRaw !== undefined) {
    const ms = Number(tRaw);
    if (Number.isFinite(ms)) out.instant = new Date(ms);
  }

  const camRaw = params.get('cam');
  if (camRaw !== undefined) {
    const parts = camRaw.split(',').map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      out.camera = { azimuth: parts[0]!, elevation: parts[1]!, distance: parts[2]! };
    }
  }

  const magRaw = params.get('mag');
  if (magRaw !== undefined) {
    const m = Number(magRaw);
    if (Number.isFinite(m)) out.magnitudeLimit = m;
  }

  const rotRaw = params.get('rot');
  if (rotRaw !== undefined && rotRaw in CODE_TO_ROT) {
    out.rotationMode = CODE_TO_ROT[rotRaw];
  }

  const grnRaw = params.get('grn');
  if (grnRaw !== undefined) {
    const g = Number(grnRaw);
    if (Number.isFinite(g) && g > 0) out.gridGrain = g;
  }

  const ruRaw = params.get('ru');
  if (ruRaw !== undefined && ruRaw in CODE_TO_RA) {
    out.raUnits = CODE_TO_RA[ruRaw];
  }

  return out;
}
