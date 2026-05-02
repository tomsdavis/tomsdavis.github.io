// Spec §5.1: minimal control surface for pass 2. Single row of essential
// controls — datetime, now, play/pause, rate, rotation toggle, reset view.
// The full collapsible bottom-sheet drawer pattern lands in a later pass.

import type { AppState, Store, Unsubscribe } from '../state';
import { RATES } from '../controls/time-controller';
import type { CameraControls } from '../controls/camera-controls';

export interface Drawer {
  detach(): void;
}

export function attachDrawer(opts: {
  container: HTMLElement;
  store: Store<AppState>;
  cameraControls: CameraControls;
}): Drawer {
  const { container, store, cameraControls } = opts;

  const root = document.createElement('div');
  root.id = 'drawer';
  root.innerHTML = `
    <input type="datetime-local" id="dt" step="1" aria-label="Date and time (UTC)" />
    <button type="button" id="now" title="Snap to current time">Now</button>
    <button type="button" id="playpause" aria-label="Play or pause time">▶</button>
    <select id="rate" aria-label="Time rate">
      ${RATES.map((r) => `<option value="${r}">${labelForRate(r)}</option>`).join('')}
    </select>
    <button type="button" id="rotation" aria-label="Toggle rotation mode" title="Toggle rotation mode">↻</button>
    <button type="button" id="reset" title="Reset view">⟲</button>
    <label class="slider" id="mag-label" title="Magnitude limit (lower = brighter cutoff)">
      <span class="slider-caption">mag <output id="mag-out">5.0</output></span>
      <input type="range" id="mag" min="0" max="6.5" step="0.1" />
    </label>
  `;
  container.appendChild(root);

  const dt = root.querySelector<HTMLInputElement>('#dt')!;
  const nowBtn = root.querySelector<HTMLButtonElement>('#now')!;
  const playBtn = root.querySelector<HTMLButtonElement>('#playpause')!;
  const rateSel = root.querySelector<HTMLSelectElement>('#rate')!;
  const rotationBtn = root.querySelector<HTMLButtonElement>('#rotation')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('#reset')!;
  const magInput = root.querySelector<HTMLInputElement>('#mag')!;
  const magOut = root.querySelector<HTMLOutputElement>('#mag-out')!;

  // --- subscriptions ----------------------------------------------------
  const unsubs: Unsubscribe[] = [];

  unsubs.push(store.subscribe('instant', (d) => { dt.value = toLocalDatetimeInputValue(d); }));
  unsubs.push(store.subscribe('rate', (r) => { rateSel.value = String(r); }));
  unsubs.push(store.subscribe('playing', (on) => { playBtn.textContent = on ? '⏸' : '▶'; }));
  unsubs.push(store.subscribe('rotationMode', (m) => {
    rotationBtn.classList.toggle('fixed', m === 'fixed-earth');
    rotationBtn.title = m === 'rotating-earth'
      ? 'Rotation mode: rotating Earth (click for fixed Earth)'
      : 'Rotation mode: fixed Earth (click for rotating Earth)';
  }));
  unsubs.push(store.subscribe('magnitudeLimit', (m) => {
    magInput.value = String(m);
    magOut.value = m.toFixed(1);
  }));

  // Apply initial state to the controls.
  const s0 = store.get();
  dt.value = toLocalDatetimeInputValue(s0.instant);
  rateSel.value = String(s0.rate);
  playBtn.textContent = s0.playing ? '⏸' : '▶';
  rotationBtn.classList.toggle('fixed', s0.rotationMode === 'fixed-earth');
  magInput.value = String(s0.magnitudeLimit);
  magOut.value = s0.magnitudeLimit.toFixed(1);

  // --- listeners --------------------------------------------------------
  const onDt = () => {
    const ms = Date.parse(dt.value + 'Z');
    if (Number.isFinite(ms)) store.set({ instant: new Date(ms), playing: false });
  };
  const onNow = () => store.set({ instant: new Date() });
  const onPlay = () => store.set({ playing: !store.get().playing });
  const onRate = () => {
    const r = Number(rateSel.value);
    if (Number.isFinite(r)) store.set({ rate: r });
  };
  const onRotation = () => {
    const m = store.get().rotationMode;
    store.set({ rotationMode: m === 'rotating-earth' ? 'fixed-earth' : 'rotating-earth' });
  };
  const onReset = () => cameraControls.resetView();
  const onMag = () => {
    const v = Number(magInput.value);
    if (Number.isFinite(v)) store.set({ magnitudeLimit: v });
  };

  dt.addEventListener('change', onDt);
  nowBtn.addEventListener('click', onNow);
  playBtn.addEventListener('click', onPlay);
  rateSel.addEventListener('change', onRate);
  rotationBtn.addEventListener('click', onRotation);
  resetBtn.addEventListener('click', onReset);
  magInput.addEventListener('input', onMag);

  return {
    detach() {
      for (const u of unsubs) u();
      root.remove();
    },
  };
}

function labelForRate(rate: number): string {
  switch (rate) {
    case 1: return '×1 (real time)';
    case 60: return '×60 (1 min/s)';
    case 3600: return '×3600 (1 hr/s)';
    case 86400: return '×86400 (1 day/s)';
    case 31_557_600: return '×31.5M (1 yr/s)';
    default: return `×${rate}`;
  }
}

/** Format a Date as a UTC datetime-local string (no timezone), seconds-precise. */
function toLocalDatetimeInputValue(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return [
    d.getUTCFullYear(),
    '-', pad(d.getUTCMonth() + 1),
    '-', pad(d.getUTCDate()),
    'T', pad(d.getUTCHours()),
    ':', pad(d.getUTCMinutes()),
    ':', pad(d.getUTCSeconds()),
  ].join('');
}
