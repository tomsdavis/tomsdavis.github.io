// Runs the perfect-information solver off the main thread. Messages in:
// { id, seed, natural, limit, tries }. Messages out: { id, result, ms }.
// The app terminates the worker when its time budget runs out.

import { loadCore } from './core.js';

const core = loadCore(fetch('core.wasm'));

self.onmessage = async ({ data: { id, seed, natural, limit, tries } }) => {
  const c = await core;
  const t = performance.now();
  const { result } = c.solve(seed, natural, limit, tries);
  self.postMessage({ id, seed, natural, result, ms: Math.round(performance.now() - t) });
};
