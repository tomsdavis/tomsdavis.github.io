import { createScene } from './scene/scene';
import { createStore } from './state';
import { resolveInitialState } from './storage';
import { attachCameraControls } from './controls/camera-controls';
import { attachPersistence } from './persistence';
import { attachDrawer } from './ui/drawer';
import { attachLabels, attachBodyLabels, attachRaLabels, attachConstellationLabels } from './ui/labels';
import { advance } from './controls/time-controller';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const overlay = document.getElementById('ui-overlay') as HTMLDivElement;

const store = createStore(
  resolveInitialState({
    urlFragment: globalThis.location?.hash ?? '',
    storage: globalThis.localStorage,
  }),
);

// Run the scene boot and the names fetch in parallel — the names file is
// optional (a 404 just means no labels) so we tolerate failure quietly.
const [scene, names] = await Promise.all([
  createScene(canvas, { gridGrain: store.get().gridGrain }),
  fetch('bsc5-names.json')
    .then((r) => (r.ok ? r.json() as Promise<Record<string, string>> : {}))
    .catch(() => ({}) as Record<string, string>),
]);

const cameraControls = attachCameraControls({ element: canvas, store });
attachDrawer({ container: overlay, store, cameraControls });
attachPersistence(store, globalThis.localStorage);
const labels = attachLabels({ catalogue: scene.catalogue, names, container: overlay });
const bodyLabels = attachBodyLabels({ planets: scene.planets, container: overlay });
const raLabels = attachRaLabels({ container: overlay });
const constellationLabels = attachConstellationLabels({
  centroids: scene.constellations.centroids,
  container: overlay,
});

const resize = () => {
  scene.resize(window.innerWidth, window.innerHeight);
  labels.setSize(window.innerWidth, window.innerHeight);
  bodyLabels.setSize(window.innerWidth, window.innerHeight);
  raLabels.setSize(window.innerWidth, window.innerHeight);
  constellationLabels.setSize(window.innerWidth, window.innerHeight);
};
resize();
window.addEventListener('resize', resize);

let lastT = performance.now();
scene.renderer.setAnimationLoop((tNow) => {
  const dt = (tNow - lastT) / 1000;
  lastT = tNow;

  const s = store.get();
  if (s.playing && dt > 0) {
    store.set({ instant: advance(s.instant, s.rate, dt) });
  }

  const cur = store.get();
  scene.apply(cur);
  labels.setVisible(cur.layers.starLabels);
  labels.setMagnitudeLimit(cur.magnitudeLimit);
  // Star and constellation labels anchor on J2000 catalogue / centroid
  // positions, so they project through celestialJ2000Root (precession
  // matrix in their parent.matrixWorld). RA labels anchor on the of-date
  // equator (raDecToVec3 → scene = of-date), so they go through
  // celestialRoot only. Body labels read sprite world positions
  // directly, picking up whichever ancestor chain the planets group sits
  // under.
  labels.update(scene.camera, scene.celestialJ2000Root);
  bodyLabels.setVisible(cur.layers.planets);
  bodyLabels.update(scene.camera);
  raLabels.setVisible(cur.layers.celestialEquator);
  raLabels.setUnits(cur.raUnits);
  raLabels.update(scene.camera, scene.celestialRoot);
  constellationLabels.setVisible(cur.layers.constellationLabels);
  constellationLabels.update(scene.camera, scene.celestialJ2000Root);
  scene.render();
});
