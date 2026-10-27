// Runs the perfect-information solver off the main thread. Messages in:
// { id, kind: 'deal', seed, natural, limit, tries } (can the deal be won?)
// or { id, kind: 'line', game, limit, tries, depth, budget } (a winning line
// from the game's current position; game is the app's record).
// Messages out: { id, result, line, ms }. The app terminates the worker when
// its time budget runs out.

import { loadCore } from './core.js';
import { replay } from './play.js';

const core = loadCore(fetch('core.wasm'));

self.onmessage = async ({ data }) => {
  const c = await core;
  const t = performance.now();
  const { result, line } = data.kind === 'line'
    ? (replay(c, data.game), c.solveCurrent(data.limit, data.tries, data.depth, data.budget))
    : c.solve(data.seed, data.natural, data.limit, data.tries);
  self.postMessage({ id: data.id, result, line, ms: Math.round(performance.now() - t) });
};
