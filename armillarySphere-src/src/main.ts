import { createScene } from './scene/scene';
import { createStore } from './state';
import { resolveInitialState } from './storage';

const canvas = document.getElementById('scene') as HTMLCanvasElement;

const store = createStore(
  resolveInitialState({
    urlFragment: globalThis.location?.hash ?? '',
    storage: globalThis.localStorage,
  }),
);

const scene = await createScene(canvas);

const resize = () => scene.resize(window.innerWidth, window.innerHeight);
resize();
window.addEventListener('resize', resize);

scene.renderer.setAnimationLoop(() => {
  scene.apply(store.get());
  scene.render();
});
