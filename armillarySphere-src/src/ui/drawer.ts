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
    <label class="slider" id="shell-label" title="Celestial-sphere shell opacity (higher = Earth hidden behind the shell)">
      <span class="slider-caption">shell <output id="shell-out">0.15</output></span>
      <input type="range" id="shell" min="0" max="1" step="0.01" />
    </label>
    <label class="toggle" title="Celestial equator with hourly tick marks"><input type="checkbox" id="t-cel-eq" /> cel.eq</label>
    <label class="toggle" title="Celestial graticule (parallels + meridians) at the chosen grain"><input type="checkbox" id="t-cel-grid" /> cel.grid</label>
    <label class="toggle" title="Ecliptic (Sun's annual path)"><input type="checkbox" id="t-ecl" /> ecliptic</label>
    <label class="toggle" title="N / S markers at the celestial poles"><input type="checkbox" id="t-poles" /> poles</label>
    <label class="toggle" title="Terrestrial (Earth) equator with tick marks"><input type="checkbox" id="t-terr-eq" /> terr.eq</label>
    <label class="toggle" title="Earth lat / lon graticule at the chosen grain"><input type="checkbox" id="t-terr-grid" /> terr.grid</label>
    <label class="toggle" title="Earth's 0° meridian (Greenwich), highlighted"><input type="checkbox" id="t-prime" /> prime</label>
    <label class="toggle" title="Constellation stick figures (modern Western)"><input type="checkbox" id="t-con-lines" /> con.lines</label>
    <label class="toggle" title="IAU 1930 constellation boundaries"><input type="checkbox" id="t-con-bounds" /> con.bounds</label>
    <label class="toggle" title="Latin name labels at constellation centroids"><input type="checkbox" id="t-con-labels" /> con.labels</label>
    <label class="toggle" title="IAU named-star labels"><input type="checkbox" id="t-star-labels" /> stars</label>
    <label class="toggle" title="Day / night terminator on Earth"><input type="checkbox" id="t-term" /> terminator</label>
    <label class="toggle" title="Sun, Moon, and the five classical planets"><input type="checkbox" id="t-planets" /> planets</label>
    <label class="picker" title="Graticule spacing in degrees">
      <span>grain</span>
      <select id="grn">
        <option value="15">15°</option>
        <option value="30">30°</option>
        <option value="45">45°</option>
        <option value="90">90°</option>
      </select>
    </label>
    <label class="picker" title="Right-ascension display unit">
      <span>RA</span>
      <select id="ra-units">
        <option value="hours">h</option>
        <option value="degrees">°</option>
      </select>
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
  const shellInput = root.querySelector<HTMLInputElement>('#shell')!;
  const shellOut = root.querySelector<HTMLOutputElement>('#shell-out')!;

  const layerToggles: ReadonlyArray<{ id: string; key: keyof AppState['layers'] }> = [
    { id: 't-cel-eq',      key: 'celestialEquator' },
    { id: 't-cel-grid',    key: 'celestialGrid' },
    { id: 't-ecl',         key: 'ecliptic' },
    { id: 't-poles',       key: 'poles' },
    { id: 't-terr-eq',     key: 'terrestrialEquator' },
    { id: 't-terr-grid',   key: 'terrestrialGrid' },
    { id: 't-prime',       key: 'primeMeridian' },
    { id: 't-con-lines',   key: 'constellationLines' },
    { id: 't-con-bounds',  key: 'constellationBoundaries' },
    { id: 't-con-labels',  key: 'constellationLabels' },
    { id: 't-star-labels', key: 'starLabels' },
    { id: 't-term',        key: 'terminator' },
    { id: 't-planets',     key: 'planets' },
  ];
  const toggleInputs = layerToggles.map(({ id, key }) => ({
    key,
    el: root.querySelector<HTMLInputElement>(`#${id}`)!,
  }));
  const grnSel = root.querySelector<HTMLSelectElement>('#grn')!;
  const raSel = root.querySelector<HTMLSelectElement>('#ra-units')!;

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
  unsubs.push(store.subscribe('celestialOpacity', (o) => {
    shellInput.value = String(o);
    shellOut.value = o.toFixed(2);
  }));
  unsubs.push(store.subscribe('layers', (layers) => {
    for (const { key, el } of toggleInputs) el.checked = layers[key];
  }));
  unsubs.push(store.subscribe('gridGrain', (g) => { grnSel.value = String(g); }));
  unsubs.push(store.subscribe('raUnits', (u) => { raSel.value = u; }));

  // Apply initial state to the controls.
  const s0 = store.get();
  dt.value = toLocalDatetimeInputValue(s0.instant);
  rateSel.value = String(s0.rate);
  playBtn.textContent = s0.playing ? '⏸' : '▶';
  rotationBtn.classList.toggle('fixed', s0.rotationMode === 'fixed-earth');
  magInput.value = String(s0.magnitudeLimit);
  magOut.value = s0.magnitudeLimit.toFixed(1);
  shellInput.value = String(s0.celestialOpacity);
  shellOut.value = s0.celestialOpacity.toFixed(2);
  for (const { key, el } of toggleInputs) el.checked = s0.layers[key];
  grnSel.value = String(s0.gridGrain);
  raSel.value = s0.raUnits;

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
  const onShell = () => {
    const v = Number(shellInput.value);
    if (Number.isFinite(v)) store.set({ celestialOpacity: v });
  };
  const onToggle = (key: keyof AppState['layers'], el: HTMLInputElement) => () => {
    store.set({ layers: { ...store.get().layers, [key]: el.checked } });
  };
  const onGrain = () => {
    const g = Number(grnSel.value);
    if (Number.isFinite(g) && g > 0) store.set({ gridGrain: g });
  };
  const onRaUnits = () => {
    const v = raSel.value;
    if (v === 'hours' || v === 'degrees') store.set({ raUnits: v });
  };

  dt.addEventListener('change', onDt);
  nowBtn.addEventListener('click', onNow);
  playBtn.addEventListener('click', onPlay);
  rateSel.addEventListener('change', onRate);
  rotationBtn.addEventListener('click', onRotation);
  resetBtn.addEventListener('click', onReset);
  magInput.addEventListener('input', onMag);
  shellInput.addEventListener('input', onShell);
  for (const { key, el } of toggleInputs) el.addEventListener('change', onToggle(key, el));
  grnSel.addEventListener('change', onGrain);
  raSel.addEventListener('change', onRaUnits);

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
