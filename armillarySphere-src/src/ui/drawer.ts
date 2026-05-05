// Spec §5.1: bottom drawer assembly. Primary row stays compact (datetime,
// play/pause, rate, rotation, reset, "Layers ▾", "Display ▾"). Layers and
// Display popovers carry the long tail of toggles, sliders, and pickers so
// the always-visible row keeps the globe unobstructed on phones.

import type { AppState, Store, Unsubscribe } from '../state';
import { RATES, formatRate } from '../controls/time-controller';
import type { CameraControls } from '../controls/camera-controls';
import { createSlider, type SliderHandle } from './sliders';
import { createToggle, type ToggleHandle } from './toggles';
import { createPopover, type PopoverHandle } from './popover';

export interface Drawer {
  detach(): void;
}

interface LayerSpec {
  key: keyof AppState['layers'];
  label: string;
  title: string;
}

interface LayerGroup {
  heading: string;
  items: ReadonlyArray<LayerSpec>;
}

const LAYER_GROUPS: ReadonlyArray<LayerGroup> = [
  {
    heading: 'Celestial frame',
    items: [
      { key: 'celestialEquator', label: 'Equator', title: 'Celestial equator with hourly tick marks' },
      { key: 'celestialGrid',    label: 'Graticule', title: 'Celestial graticule (parallels + meridians)' },
      { key: 'ecliptic',         label: 'Ecliptic', title: 'Ecliptic (Sun’s annual path)' },
      { key: 'poles',            label: 'Poles & equinoxes', title: 'N / S celestial poles and the ♈ / ♎ equinox markers' },
    ],
  },
  {
    heading: 'Earth',
    items: [
      { key: 'terrestrialEquator', label: 'Equator', title: 'Terrestrial (Earth) equator with tick marks' },
      { key: 'terrestrialGrid',    label: 'Graticule', title: 'Earth lat / lon graticule' },
      { key: 'primeMeridian',      label: 'Prime meridian', title: 'Earth’s 0° meridian (Greenwich), highlighted' },
      { key: 'terminator',         label: 'Terminator', title: 'Day / night terminator on Earth' },
    ],
  },
  {
    heading: 'Constellations',
    items: [
      { key: 'constellationLines',      label: 'Stick figures', title: 'Constellation stick figures (modern Western)' },
      { key: 'constellationBoundaries', label: 'Boundaries', title: 'IAU 1930 constellation boundaries' },
      { key: 'constellationLabels',     label: 'Labels', title: 'Latin name labels at constellation centroids' },
    ],
  },
  {
    heading: 'Bodies',
    items: [
      { key: 'planets',    label: 'Sun, Moon, planets', title: 'Sun, Moon, and the five classical planets' },
      { key: 'starLabels', label: 'Star names', title: 'IAU named-star labels' },
    ],
  },
];

export function attachDrawer(opts: {
  container: HTMLElement;
  store: Store<AppState>;
  cameraControls: CameraControls;
}): Drawer {
  const { container, store, cameraControls } = opts;

  const root = document.createElement('div');
  root.id = 'drawer';

  // ---- primary row -----------------------------------------------------
  const dt = document.createElement('input');
  dt.type = 'datetime-local';
  dt.id = 'dt';
  dt.step = '1';
  dt.setAttribute('aria-label', 'Date and time (UTC)');

  const nowBtn = button('now', 'Now', 'Snap to current time');
  const playBtn = button('playpause', '▶', 'Play or pause time');
  playBtn.setAttribute('aria-label', 'Play or pause time');

  const rateSel = document.createElement('select');
  rateSel.id = 'rate';
  rateSel.setAttribute('aria-label', 'Time rate');
  for (const r of RATES) {
    const opt = document.createElement('option');
    opt.value = String(r);
    opt.textContent = formatRate(r);
    rateSel.appendChild(opt);
  }

  const rotationBtn = button('rotation', '↻', 'Toggle rotation mode');
  rotationBtn.setAttribute('aria-label', 'Toggle rotation mode');
  const resetBtn = button('reset', '⟲', 'Reset view');

  // ---- Layers popover --------------------------------------------------
  const layersPopover = createPopover({ label: 'Layers', title: 'Visibility toggles' });
  layersPopover.panel.classList.add('layers-panel');

  const toggleHandles: Array<{ key: keyof AppState['layers']; handle: ToggleHandle }> = [];
  for (const group of LAYER_GROUPS) {
    const section = document.createElement('div');
    section.className = 'popover-group';

    const h = document.createElement('div');
    h.className = 'popover-heading';
    h.textContent = group.heading;
    section.appendChild(h);

    const items = document.createElement('div');
    items.className = 'popover-items';
    for (const spec of group.items) {
      const handle = createToggle({
        id: `t-${spec.key}`,
        label: spec.label,
        initial: store.get().layers[spec.key],
        title: spec.title,
        onChange: (checked) => {
          store.set({ layers: { ...store.get().layers, [spec.key]: checked } });
        },
      });
      toggleHandles.push({ key: spec.key, handle });
      items.appendChild(handle.el);
    }
    section.appendChild(items);
    layersPopover.panel.appendChild(section);
  }

  // ---- Display popover -------------------------------------------------
  const displayPopover = createPopover({ label: 'Display', title: 'Visual settings' });
  displayPopover.panel.classList.add('display-panel');

  const magSlider = createSlider({
    id: 'mag',
    caption: 'Magnitude limit',
    min: 0,
    max: 6.5,
    step: 0.1,
    initial: store.get().magnitudeLimit,
    format: (v) => v.toFixed(1),
    onInput: (v) => store.set({ magnitudeLimit: v }),
    title: 'Magnitude limit (lower = brighter cutoff)',
  });
  const shellSlider = createSlider({
    id: 'shell',
    caption: 'Shell opacity',
    min: 0,
    max: 1,
    step: 0.01,
    initial: store.get().celestialOpacity,
    format: (v) => v.toFixed(2),
    onInput: (v) => store.set({ celestialOpacity: v }),
    title: 'Celestial-sphere shell opacity (higher = Earth hidden behind the shell)',
  });

  const grainPicker = picker('grn', 'Graticule', [
    { value: '15', text: '15°' },
    { value: '30', text: '30°' },
    { value: '45', text: '45°' },
    { value: '90', text: '90°' },
  ], 'Graticule spacing in degrees');
  const raPicker = picker('ra-units', 'RA units', [
    { value: 'hours', text: 'hours' },
    { value: 'degrees', text: 'degrees' },
  ], 'Right-ascension display unit');

  displayPopover.panel.append(
    magSlider.el,
    shellSlider.el,
    grainPicker.label,
    raPicker.label,
  );

  // ---- assemble --------------------------------------------------------
  root.append(
    dt,
    nowBtn,
    playBtn,
    rateSel,
    rotationBtn,
    resetBtn,
    layersPopover.trigger,
    displayPopover.trigger,
    layersPopover.panel,
    displayPopover.panel,
  );
  container.appendChild(root);

  // ---- subscriptions ---------------------------------------------------
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
  unsubs.push(store.subscribe('magnitudeLimit', (m) => magSlider.set(m)));
  unsubs.push(store.subscribe('celestialOpacity', (o) => shellSlider.set(o)));
  unsubs.push(store.subscribe('layers', (layers) => {
    for (const { key, handle } of toggleHandles) handle.set(layers[key]);
  }));
  unsubs.push(store.subscribe('gridGrain', (g) => { grainPicker.select.value = String(g); }));
  unsubs.push(store.subscribe('raUnits', (u) => { raPicker.select.value = u; }));

  // initial sync
  const s0 = store.get();
  dt.value = toLocalDatetimeInputValue(s0.instant);
  rateSel.value = String(s0.rate);
  playBtn.textContent = s0.playing ? '⏸' : '▶';
  rotationBtn.classList.toggle('fixed', s0.rotationMode === 'fixed-earth');
  grainPicker.select.value = String(s0.gridGrain);
  raPicker.select.value = s0.raUnits;

  // ---- listeners -------------------------------------------------------
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
  const onGrain = () => {
    const g = Number(grainPicker.select.value);
    if (Number.isFinite(g) && g > 0) store.set({ gridGrain: g });
  };
  const onRaUnits = () => {
    const v = raPicker.select.value;
    if (v === 'hours' || v === 'degrees') store.set({ raUnits: v });
  };

  dt.addEventListener('change', onDt);
  nowBtn.addEventListener('click', onNow);
  playBtn.addEventListener('click', onPlay);
  rateSel.addEventListener('change', onRate);
  rotationBtn.addEventListener('click', onRotation);
  resetBtn.addEventListener('click', onReset);
  grainPicker.select.addEventListener('change', onGrain);
  raPicker.select.addEventListener('change', onRaUnits);

  return {
    detach() {
      for (const u of unsubs) u();
      for (const { handle } of toggleHandles) handle.destroy();
      magSlider.destroy();
      shellSlider.destroy();
      layersPopover.destroy();
      displayPopover.destroy();
      root.remove();
    },
  };
}

function button(id: string, text: string, title: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = id;
  b.textContent = text;
  b.title = title;
  return b;
}

interface PickerHandle {
  label: HTMLLabelElement;
  select: HTMLSelectElement;
}

function picker(
  id: string,
  caption: string,
  options: ReadonlyArray<{ value: string; text: string }>,
  title: string,
): PickerHandle {
  const label = document.createElement('label');
  label.className = 'picker';
  label.htmlFor = id;
  label.title = title;
  const span = document.createElement('span');
  span.textContent = caption;
  const select = document.createElement('select');
  select.id = id;
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.text;
    select.appendChild(opt);
  }
  label.append(span, select);
  return { label, select };
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
