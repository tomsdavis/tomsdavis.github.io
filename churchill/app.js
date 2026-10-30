// Churchill Solitaire: UI, persistence and the solver worker.

import { loadCore, landing, suit, isRed, rankText, cardName, decodeMove, GLYPH, SUITS, validSeed } from './core.js';
import {
  targetsFor, canPick, slotFor, chooseLayout, pileOffsets, tableauNeed,
  VARIANT_NAME, VARIANT_SHORT, newRecord, withMove, withUndo, withSwitch, withEnd, replay,
  withHint, withCheck, withAssist, winResult, withPlaybackBack,
  posKey, liveAfterMove, liveMerge, liveNextJob, withLiveAnswer, withLiveBack, lastLiveAnswer,
} from './play.js';

// ============= Storage =============

const KEYS = { current: 'churchill.current', records: 'churchill.records', settings: 'churchill.settings' };
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
};
// Finished games, newest last (version 1 stores them; showing them comes later).
const archive = (rec) => save(KEYS.records, [...load(KEYS.records, []), rec]);

// ============= State =============

let core;
let rec; // the game record (see play.js)
let pos, lay, legal; // core position, deal and legal moves
let sel = null;
let settings = { layout: 'auto', solv: 'known', winnableOnly: false, speed: '2', ...load(KEYS.settings, {}) };
let solv = { state: 'busy', key: null }; // solvability of the current deal and rules
let collapsed = false;
let prevLanding = new Map();
let newVariant = 'closed';
let busy = null; // 'hint' | 'check' | 'solve' while the solver works on a line
let hintCode = null; // the move a hint points at, until the next move
let auto = null; // solver playback: { line, i, paused, timer }

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const isOpen = () => rec.variant !== 'closed';
const usesNatural = () => rec.variant === 'natural';

const refresh = () => {
  pos = core.position();
  legal = core.legalMoves();
};

let toastTimer;
const toast = (msg) => {
  document.querySelector('.toast')?.remove();
  const t = el('div', 'toast', msg);
  $('frame').append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
};

// ============= Solver worker =============

// One worker per kind of job ('deal': can this deal be won; 'line': a
// winning line from the current position). A new job of the same kind
// cancels the one running.
const workers = {}, pending = {};
let jobId = 0;
const SOLVE_LIMIT = 1_000_000, SOLVE_TRIES = 5000, SOLVE_MS = 30_000;
const SIMPLIFY_DEPTH = 2, SIMPLIFY_BUDGET = 2_000_000;

// Stop a worker; its pending job (if any) ends as 'cancelled'.
const stopWorker = (kind) => {
  const p = pending[kind];
  workers[kind]?.terminate();
  delete workers[kind];
  delete pending[kind];
  if (p) {
    clearTimeout(p.timer);
    p.resolve({ id: p.id, result: 'cancelled', line: [] });
  }
};

const askSolver = (kind, msg, ms) => new Promise((resolve) => {
  if (pending[kind]) stopWorker(kind);
  if (!workers[kind]) {
    const w = new Worker('solver-worker.js', { type: 'module' });
    w.onmessage = ({ data }) => {
      const p = pending[kind];
      if (!p || p.id !== data.id) return;
      clearTimeout(p.timer);
      delete pending[kind];
      p.resolve(data);
    };
    workers[kind] = w;
  }
  const id = ++jobId;
  // Out of time: stop the worker; a fresh one starts with the next job.
  const timer = setTimeout(() => {
    delete pending[kind];
    stopWorker(kind);
    resolve({ id, result: 'unknown', line: [] });
  }, ms);
  pending[kind] = { id, resolve, timer };
  workers[kind].postMessage({ id, kind, ...msg });
});

const checkSolvable = async () => {
  const key = `${rec.seed}/${usesNatural() ? 'n' : 'c'}`;
  if (solv.key === key) return;
  solv = { state: 'busy', key };
  render();
  const { result } = await askSolver('deal', { seed: rec.seed, natural: usesNatural(), limit: SOLVE_LIMIT, tries: SOLVE_TRIES }, SOLVE_MS);
  if (solv.key !== key || result === 'cancelled') return;
  solv = { state: result, key };
  rec = { ...rec, solv: { result, shownAtMove: rec.solv?.shownAtMove ?? (settings.solv === 'known' ? rec.moves : null) } };
  persist();
  render();
};

// ============= Live indicator =============

// With the indicator set to Live, the top bar answers for the position on
// the board: answers are cached by position, moves that settle the answer
// without a search do so (play.js, liveAfterMove), and while the player
// thinks the worker checks the positions after the other moves.
const LIVE_LIMIT = 300_000, LIVE_TRIES = 1500, LIVE_MS = 3000;
// Positions for the full endgame search (stock gone; proves losses): up to
// about 9 s on a desktop, so within the full budget on most phones.
const LIVE_ENDGAME = 1_000_000;
const live = { cache: new Map(), here: null, probes: null, job: null };
const isLive = () => settings.solv === 'live';

// The legal moves from here as { code, cost, key }: play each, note it, take it back.
const probeMoves = () => legal.map((code) => {
  const cost = core.play(code);
  const key = posKey(core.position());
  core.undo();
  return { code, cost, key };
});

const liveStop = () => {
  live.job = null;
  stopWorker('check');
};

const liveSchedule = async () => {
  if (!isLive() || rec.result || auto || document.hidden || live.job) return;
  if (live.probes?.here !== live.here) live.probes = { here: live.here, list: probeMoves() };
  const job = liveNextJob(live.cache, live.here, live.probes.list);
  if (!job) return;
  live.job = job;
  const game = job.code === null ? rec : withMove(rec, job.code);
  const r = await askSolver('check', {
    game, limit: job.full ? SOLVE_LIMIT : LIVE_LIMIT, tries: job.full ? SOLVE_TRIES : LIVE_TRIES, full: job.full ? LIVE_ENDGAME : 0,
  }, job.full ? SOLVE_MS : LIVE_MS);
  if (live.job !== job) return; // stopped or superseded
  live.job = null;
  // The full search can leave the worker holding tens of MB (WebAssembly
  // never gives memory back): close it, and the next job starts a fresh one.
  if (job.full) stopWorker('check');
  if (r.result !== 'cancelled') {
    live.cache.set(job.key, liveMerge(live.cache.get(job.key), { state: r.result, line: r.result === 'winnable' ? r.line : null, full: job.full }));
    if (job.key === live.here) {
      liveNote();
      render();
    }
  }
  liveSchedule();
};

// The board changed (a move with take-back cost `cost`, or with code null a
// take-back or a new game). Settle what can be settled without a search;
// keep a running search only if it is for the new position.
const liveMoved = (code = null, cost = null) => {
  const prev = live.cache.get(live.here);
  live.here = posKey(pos);
  const known = code === null ? null : liveAfterMove(prev, code, cost);
  if (known) live.cache.set(live.here, liveMerge(live.cache.get(live.here), known));
  liveNote();
  if (live.job && live.job.key !== live.here) liveStop();
  liveSchedule();
};

// Record a change in the answer shown for the position on the board.
const liveNote = () => {
  if (!isLive() || rec.result) return;
  const { state } = liveAnswer();
  if (!['winnable', 'unknown', 'lost'].includes(state) || state === lastLiveAnswer(rec)) return;
  rec = withLiveAnswer(rec, state);
  persist();
};

const liveReset = () => {
  liveStop();
  live.cache.clear();
  live.here = null;
  live.probes = null;
  liveMoved();
};

// A quick search that found no win is often just too short: show Checking
// until the full budget has been tried too.
const liveAnswer = () => {
  if (pos.won) return { state: 'won' };
  const a = live.cache.get(live.here);
  return !a || (a.state === 'unknown' && !a.full) ? { state: 'busy' } : a;
};

// ============= Game flow =============

const persist = () => save(KEYS.current, rec);

const startGame = (seed, variant, extra = {}) => {
  stopAuto();
  stopWorker('line');
  busy = null;
  if (rec && !rec.result && rec.moves > 0) archive(withEnd(rec, 'abandoned'));
  rec = newRecord({ seed, variant, ...extra });
  core.newGame(seed, variant === 'natural');
  lay = core.layout();
  sel = null;
  prevLanding = new Map();
  refresh();
  liveReset();
  persist();
  render();
  checkSolvable();
};

const finish = (result) => {
  liveStop();
  rec = withEnd(rec, result);
  archive(rec);
  persist();
  showEnd(result);
};

const playCode = (code) => {
  const cost = core.play(code);
  if (cost < 0) return;
  // A line being worked out for the old position is no use now.
  if (busy) stopWorker('line');
  rec = withMove(rec, code);
  sel = null;
  hintCode = null;
  refresh();
  liveMoved(code, cost);
  persist();
  render();
  if (pos.won) finish(winResult(rec));
  else if (legal.length === 0) finish('stuck');
};

const takeBack = () => {
  if (rec.result || auto) return;
  const noWin = isLive() && ['unknown', 'lost'].includes(liveAnswer().state);
  const cost = core.undo();
  if (cost < 0) return;
  if (busy) stopWorker('line');
  rec = withUndo(rec, cost);
  if (noWin) rec = withLiveBack(rec);
  sel = null;
  hintCode = null;
  refresh();
  liveMoved();
  persist();
  render();
};

const switchTo = (variant) => {
  if (rec.variant !== 'closed' || rec.result) return;
  rec = withSwitch(rec, variant);
  if (variant === 'natural') core.switchNatural();
  sel = null;
  refresh();
  liveReset();
  persist();
  render();
  toast(`Switched to ${VARIANT_NAME[variant]} (recorded)`);
  checkSolvable();
};

const randomSeed = () => 1 + Math.floor(Math.random() * 1_000_000_000);

const findWinnable = async (variant) => {
  toast('Looking for a winnable deal');
  for (let i = 0; i < 25; i++) {
    const seed = randomSeed();
    const { result } = await askSolver('deal', { seed, natural: variant === 'natural', limit: 200_000, tries: 1000 }, 8000);
    if (result === 'winnable') return seed;
  }
  toast('No winnable deal found quickly; dealing a random one');
  return randomSeed();
};

// ============= Help from the solver =============

const NO_LINE = {
  lost: "This deal can't be won: the Devil's Six can't all go up in order.",
  unknown: 'No winning line found from here within 30 s (it may still be winnable).',
};

// Ask the solver for a winning line from here; null if cancelled.
const findLine = async (what) => {
  if (busy || auto || rec.result) return null;
  busy = what;
  render();
  const r = await askSolver('line', { game: rec, limit: SOLVE_LIMIT, tries: SOLVE_TRIES, depth: SIMPLIFY_DEPTH, budget: SIMPLIFY_BUDGET }, SOLVE_MS);
  busy = null;
  // The line is in the player's moves, so the live indicator can use it.
  if (r.result === 'winnable' || r.result === 'lost') {
    live.cache.set(live.here, liveMerge(live.cache.get(live.here), { state: r.result, line: r.result === 'winnable' ? r.line : null, full: true }));
    liveNote();
  }
  render();
  return r.result === 'cancelled' ? null : r;
};

const describeMove = (code) => {
  const m = decodeMove(code);
  if (m.kind === 'deal') return 'deal';
  if (m.kind === 'devil') return `play the Devil's Six ${cardName(lay.devil[pos.devilNext])} up`;
  const p = pos.piles[m.from];
  if (m.kind === 'found') return `play ${cardName(p.cards[p.cards.length - 1])} up`;
  const head = p.cards[p.cards.length - m.count];
  const onto = pos.piles[m.to].cards;
  return `${cardName(head)}${m.count > 1 ? ` (and ${m.count - 1} more)` : ''} ${onto.length ? `onto ${cardName(onto[onto.length - 1])}` : 'to the empty pile'}`;
};

const hint = async () => {
  const r = await findLine('hint');
  if (!r) return;
  if (r.result !== 'winnable') { toast(NO_LINE[r.result]); return; }
  const code = r.line[0];
  rec = withHint(rec, code);
  persist();
  const m = decodeMove(code);
  const p = pos.piles[m.from];
  sel = m.kind === 'run' ? { pile: m.from, index: p.cards.length - m.count }
    : m.kind === 'found' ? { pile: m.from, index: p.cards.length - 1 }
    : m.kind === 'devil' ? { devil: true } : null;
  hintCode = code;
  render();
  toast(`Hint: ${describeMove(code)}`);
};

const checkWinnable = async () => {
  const r = await findLine('check');
  if (!r) return;
  rec = withCheck(rec, r.result);
  persist();
  toast(r.result === 'winnable' ? 'Still winnable from here' : NO_LINE[r.result]);
};

const SPEED_MS = { 4: 250, 2: 500, 1: 1000, 0.5: 2000 };

const solveFromHere = async () => {
  const r = await findLine('solve');
  if (!r) return;
  if (r.result !== 'winnable') { toast(NO_LINE[r.result]); return; }
  rec = withAssist(rec);
  persist();
  sel = null;
  hintCode = null;
  liveStop();
  auto = { line: r.line, i: 0, paused: false, timer: null };
  scheduleAuto();
  render();
};

const scheduleAuto = () => {
  clearTimeout(auto.timer);
  if (!auto.paused) auto.timer = setTimeout(stepAuto, SPEED_MS[settings.speed] ?? 500);
};

const stepAuto = () => {
  if (!auto) return;
  const code = auto.line[auto.i];
  const cost = code === undefined ? -1 : core.play(code);
  if (cost < 0) {
    stopAuto();
    toast('Playback stopped: the line no longer fits this position');
    return;
  }
  rec = withMove(rec, code);
  auto.i++;
  refresh();
  liveMoved(code, cost);
  persist();
  if (pos.won) {
    stopAuto();
    finish(winResult(rec));
    return;
  }
  scheduleAuto();
  render();
};

// Take the solver's last move back (playback paused); not a take-back.
const stepBackAuto = () => {
  if (core.undo() < 0) return;
  rec = withPlaybackBack(rec);
  auto.i--;
  refresh();
  liveMoved();
  persist();
  render();
};

const stopAuto = () => {
  if (!auto) return;
  clearTimeout(auto.timer);
  auto = null;
  if (rec) {
    render();
    liveSchedule();
  }
};

// ============= History =============

const exportHistory = async () => {
  const name = `churchill-history-${new Date().toISOString().slice(0, 10)}.json`;
  const data = JSON.stringify({
    app: 'churchill', exported: new Date().toISOString(), core: $('coreVersion').textContent,
    current: rec, records: load(KEYS.records, []),
  });
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

const clearHistory = () => {
  save(KEYS.records, []);
  toast('History cleared');
};

// ============= Rendering =============

const cardEl = (c, extra = '') =>
  el('div', `card ${isRed(c) ? 'red' : ''} ${extra}`,
    `<span class="idx">${rankText(c)}${GLYPH[suit(c)]}</span><span class="pip">${GLYPH[suit(c)]}</span>`);
// Rank above suit, for cards that overlap sideways (the Devil's Six).
const stackedCardEl = (c, extra = '') =>
  el('div', `card stack ${isRed(c) ? 'red' : ''} ${extra}`,
    `<span class="idx">${rankText(c)}<br>${GLYPH[suit(c)]}</span><span class="pip">${GLYPH[suit(c)]}</span>`);

// Foundation slots shown in this suit order, alternating colours.
const SLOT_ORDER = ['s', 's', 'h', 'h', 'c', 'c', 'd', 'd'];
const slotHeight = (i) => {
  const s = SUITS.indexOf(SLOT_ORDER[i]);
  return pos.found[s][i % 2];
};

let cw = 36;
const applyLayout = () => {
  const f = $('frame');
  // The space inside the body's safe-area padding, not the frame (whose
  // size depends on the layout chosen).
  const cs = getComputedStyle(document.body);
  const W = document.body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const H = document.body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const { landscape, cw: w } = chooseLayout(Math.min(W, 1500), Math.min(H, 1000), settings.layout);
  f.classList.toggle('landscape', landscape);
  f.classList.toggle('portrait', !landscape);
  cw = w;
  f.style.setProperty('--cw', `${cw}px`);
  return landscape;
};

const SOLV_TEXT = { busy: 'Checking', winnable: 'Winnable', lost: 'Lost', unknown: 'Unknown' };
const LIVE_TEXT = { busy: 'Checking', winnable: 'Winnable', lost: 'Lost', unknown: 'Win not yet found', won: 'Won' };

function render() {
  const land = applyLayout();
  const open = isOpen();
  const tg = targetsFor(sel, legal, pos);

  // top bar
  $('seedLbl').textContent = `#${rec.seed}`;
  $('seedLbl').title = `Seed ${rec.seed}`;
  $('varLbl').textContent = VARIANT_SHORT[rec.variant];
  $('varLbl').title = VARIANT_NAME[rec.variant];
  $('varLbl').classList.toggle('sw', !!rec.switched);
  const sv = $('solv');
  if (isLive()) {
    const { state } = liveAnswer();
    sv.hidden = false;
    sv.className = `solv live ${state}`;
    sv.textContent = LIVE_TEXT[state];
    sv.title = 'Whether the game can still be won from here, with every card known';
  } else {
    const shown = settings.solv === 'known' || settings.solv === 'live' || (settings.solv === 'request' && rec.solv?.shownAtMove != null) || rec.result;
    sv.hidden = settings.solv === 'never' && !rec.result;
    sv.className = `solv ${solv.state}`;
    sv.textContent = shown ? SOLV_TEXT[solv.state] : 'Winnable?';
    sv.title = 'Whether the deal can be won with every card known';
  }
  const nextCost = core.undoCost();
  $('undo').disabled = nextCost < 0 || !!rec.result || !!auto;
  $('undo').classList.toggle('costly', nextCost > 0);
  $('undo').setAttribute('aria-label', `Take back (${nextCost < 0 ? 'nothing to take back' : nextCost ? `counts ${nextCost}` : 'free'}), ${rec.used} used`);
  $('undoCount').textContent = rec.used;

  // foundations and stock
  const top = $('top');
  top.replaceChildren();
  const foundSlot = tg.found === null ? -1 : sel.devil ? slotFor(pos, lay.devil[pos.devilNext]) : slotFor(pos, pos.piles[sel.pile].cards[sel.index]);
  // slotFor numbers slots in SUITS order; map to display order
  const hitSlot = foundSlot < 0 ? -1 : SLOT_ORDER.findIndex((s, i) => s === SUITS[foundSlot >> 1] && i % 2 === foundSlot % 2);
  SLOT_ORDER.forEach((s, i) => {
    const cell = el('div', 'cell');
    const h = slotHeight(i), hit = i === hitSlot;
    const isHint = hit && hintCode !== null && hintCode === tg.found;
    const cls = `${hit ? 'target' : ''} ${isHint ? 'hint' : ''}`;
    const e = h ? cardEl(h | (SUITS.indexOf(s) << 4), cls) : el('div', `slot ${cls}`, GLYPH[s]);
    e.onclick = () => { if (hit) playCode(tg.found); };
    cell.append(e);
    top.append(cell);
  });
  const left = lay.stock.length - pos.stockNext;
  const sb = el('button', 'stockbtn', left ? `<b>${left}</b><span>Deal</span>` : '<span>Empty</span>');
  sb.disabled = !left || !!rec.result || !!auto;
  sb.classList.toggle('hint', hintCode === 2);
  sb.setAttribute('aria-label', `Deal, ${left} cards left`);
  sb.onclick = () => { sel = null; playCode(2); };
  if (land) $('stockslot').replaceChildren(sb);
  else { $('stockslot').replaceChildren(); top.append(sb); }

  // Devil's Six, next card at the right-hand end
  const dv = $('devil');
  dv.replaceChildren();
  const devilLeft = lay.devil.slice(pos.devilNext);
  // Spread the Devil's Six over four card widths (a full row in landscape).
  const step = cw * 0.6;
  dv.style.width = devilLeft.length ? `${cw + step * (devilLeft.length - 1)}px` : '0';
  devilLeft.slice().reverse().forEach((c, k) => {
    const isNext = k === devilLeft.length - 1;
    const e = stackedCardEl(c, isNext && sel?.devil ? 'sel' : '');
    e.style.left = `${k * step}px`;
    if (isNext) e.onclick = () => {
      if (auto || rec.result) return;
      if (sel?.devil) { sel = null; render(); return; }
      if (!legal.includes(3)) { toast("No foundation takes the next Devil's Six card yet"); return; }
      sel = { devil: true };
      render();
    };
    dv.append(e);
  });
  const up = pos.found.flat().reduce((a, b) => a + b, 0);
  $('status').innerHTML = `Moves <b>${rec.moves}</b><br>Up <b>${up}</b> / 104<br>Devil's Six left <b>${devilLeft.length}</b>`;

  // solver playback bar (before sizing the stock panel, which makes room for it)
  $('autobar').hidden = !auto && !busy;
  $('autoCtl').hidden = !auto;
  $('autoInfo').textContent = auto ? `Solver: move ${auto.i} of ${auto.line.length}` : busy ? 'Solver thinking' : '';
  if (auto) {
    $('autoPause').textContent = auto.paused ? 'Play' : 'Pause';
    $('autoStep').disabled = !auto.paused;
    $('autoBack').disabled = !auto.paused || auto.i === 0;
    press('speedSeg', 'sp', settings.speed);
  }

  // the stock panel gets whatever height the tableau does not need
  $('panel').hidden = !open;
  if (open) {
    const barH = $('autobar').offsetHeight;
    const fixed = barH + (land ? 6 : [...document.querySelectorAll('.bar, .top, .devilrow')].reduce((a, e) => a + e.offsetHeight, 0));
    const avail = $('frame').clientHeight - fixed;
    $('panel').style.maxHeight = `${Math.max(cw * 3.2, avail - tableauNeed(pos, cw))}px`;
  }

  // tableau
  const tab = $('tableau');
  tab.replaceChildren();
  const H = tab.clientHeight;
  pos.piles.forEach((pile, p) => {
    const col = el('div', 'col');
    const hitPile = tg.piles.has(p);
    const hintPile = hitPile && hintCode !== null && tg.piles.get(p) === hintCode;
    const moveHere = () => playCode(tg.piles.get(p));
    if (!pile.cards.length) {
      const s = el('div', `slot ${hitPile ? 'target' : ''} ${hintPile ? 'hint' : ''}`, '');
      s.onclick = (ev) => { ev.stopPropagation(); if (hitPile) moveHere(); else if (sel) { sel = null; render(); } };
      col.append(s);
    }
    const offs = pileOffsets(pile, open, cw, H);
    pile.cards.forEach((c, i) => {
      const down = i < pile.down;
      const isSel = sel && !sel.devil && sel.pile === p && i >= sel.index;
      const cls = down ? (open ? 'off' : 'down') : '';
      const last = i === pile.cards.length - 1;
      const e = cardEl(c, `${cls} ${isSel ? 'sel' : ''} ${hitPile && last ? 'target' : ''} ${hintPile && last ? 'hint' : ''}`);
      e.style.top = `${offs[i]}px`;
      e.onclick = (ev) => {
        ev.stopPropagation();
        if (rec.result || auto) return;
        hintCode = null;
        if (hitPile) { moveHere(); return; }
        if (sel && !sel.devil && sel.pile === p && sel.index === i) { sel = null; render(); return; }
        if (canPick(pos, p, i)) { sel = { pile: p, index: i }; render(); }
        else if (sel) { sel = null; render(); }
      };
      col.append(e);
    });
    col.onclick = () => { if (sel) { sel = null; render(); } };
    tab.append(col);
  });

  // stock panel (open games)
  $('panel').classList.toggle('collapsed', collapsed);
  $('ptog').textContent = collapsed ? 'Show' : 'Hide';
  if (open) {
    const land2 = landing(pos, lay);
    const deals = land2.length ? land2[land2.length - 1].row + 1 : 0;
    const skips = pos.piles.map((p) => p.kingHeaded);
    const ns = skips.filter(Boolean).length;
    $('pinfo').innerHTML = left
      ? `${left} cards &middot; ${deals} deal${deals === 1 ? '' : 's'}${ns ? ` &middot; ${ns} pile${ns > 1 ? 's' : ''} skipped` : ''}`
      : 'empty';
    const rows = $('rows');
    const scroll = rows.scrollTop;
    rows.replaceChildren();
    for (let r = 0; r < deals; r++) {
      if (r === 1) rows.append(el('div', 'rowtag', 'Later deals'));
      const row = el('div', `cols prow ${r === 0 ? 'next' : ''}`);
      for (let p = 0; p < 10; p++) {
        const hit = land2.find((x) => x.row === r && x.col === p);
        if (!hit) { row.append(el('div', `c ${skips[p] ? 'skip' : 'none'}`)); continue; }
        const moved = prevLanding.has(hit.index) && prevLanding.get(hit.index) !== p;
        const t = `${rankText(hit.card)}${r === 0 ? '<br>' : ''}${GLYPH[suit(hit.card)]}`;
        row.append(el('div', `c ${isRed(hit.card) ? 'red' : ''} ${moved ? 'flash' : ''}`, t));
      }
      rows.append(row);
    }
    rows.scrollTop = scroll;
    prevLanding = new Map(land2.map((x) => [x.index, x.col]));
  }
}

// ============= Sheets =============

const showEnd = (result) => {
  const msg = {
    won: 'Won!',
    solved: 'Solved by the solver (not counted as a win).',
    stuck: 'No moves left.',
    resigned: 'Resigned.',
  }[result];
  $('endTitle').textContent = msg;
  const helped = [
    rec.hints && `${rec.hints} hint${rec.hints === 1 ? '' : 's'}`,
    rec.assisted && `solver from move ${rec.assisted.atMove}`,
    // In the closed game the live indicator shows what the hidden cards allow.
    rec.variant === 'closed' && rec.live && 'live indicator',
  ].filter(Boolean).join(', ');
  const lost = rec.live?.lostAt != null
    ? ` ${rec.live.lostAs === 'lost' ? 'Win lost' : 'No win found'} after move ${rec.live.lostAt}${rec.live.backs ? `; ${rec.live.backs} take-back${rec.live.backs === 1 ? '' : 's'} while it showed` : ''}.`
    : '';
  $('endStats').textContent = `Seed ${rec.seed}, ${VARIANT_NAME[rec.variant]}${rec.switched ? ' (switched)' : ''}: ${rec.moves} moves, ${rec.used} take-back${rec.used === 1 ? '' : 's'}${helped ? `, ${helped}` : ''}. Solver: ${SOLV_TEXT[solv.state].toLowerCase()}.${lost}`;
  $('endSheet').hidden = false;
  render();
};

const openMenu = () => {
  $('seedIn').value = rec.seed;
  $('switchRow').hidden = rec.variant !== 'closed' || !!rec.result;
  $('resign').disabled = !!rec.result;
  ['hintBtn', 'checkBtn', 'solveBtn'].forEach((id) => { $(id).disabled = !!rec.result || !!busy || !!auto; });
  press('speedSeg2', 'sp', settings.speed);
  $('clearConfirm').hidden = true;
  newVariant = rec.variant;
  press('newVar', 'v', newVariant);
  press('layoutSeg', 'l', settings.layout);
  press('solvSeg', 's', settings.solv);
  $('winOnly').checked = settings.winnableOnly;
  $('sheet').hidden = false;
};
const closeMenu = () => { $('sheet').hidden = true; };
const press = (id, attr, v) => [...$(id).children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === v)));
const setSetting = (k, v) => { settings = { ...settings, [k]: v }; save(KEYS.settings, settings); };

const wire = () => {
  $('undo').onclick = takeBack;
  $('menuBtn').onclick = openMenu;
  $('closeSheet').onclick = closeMenu;
  $('sheet').onclick = (e) => { if (e.target === $('sheet')) closeMenu(); };
  $('solv').onclick = () => {
    if (settings.solv !== 'request' || rec.solv?.shownAtMove != null) return;
    rec = { ...rec, solv: { result: rec.solv?.result ?? null, shownAtMove: rec.moves } };
    persist();
    render();
  };
  $('newVar').onclick = (e) => { const v = e.target.dataset.v; if (v) { newVariant = v; press('newVar', 'v', v); } };
  $('layoutSeg').onclick = (e) => { const v = e.target.dataset.l; if (v) { setSetting('layout', v); press('layoutSeg', 'l', v); render(); } };
  $('solvSeg').onclick = (e) => {
    const v = e.target.dataset.s;
    if (!v) return;
    setSetting('solv', v);
    press('solvSeg', 's', v);
    if (isLive()) liveSchedule(); else liveStop();
    render();
  };
  $('winOnly').onchange = (e) => setSetting('winnableOnly', e.target.checked);
  $('newGame').onclick = () => {
    const seed = Number($('seedIn').value);
    if (!validSeed(seed)) { toast('Enter a whole number from 1 upwards'); return; }
    closeMenu();
    startGame(seed, newVariant);
  };
  $('randomGame').onclick = async () => {
    closeMenu();
    const seed = settings.winnableOnly ? await findWinnable(newVariant) : randomSeed();
    startGame(seed, newVariant);
  };
  $('restart').onclick = () => {
    closeMenu();
    const prev = rec;
    if (!prev.result) archive(withEnd(prev, 'restarted'));
    rec = null;
    startGame(prev.seed, prev.switched ? 'closed' : prev.variant, { attempt: prev.attempt + 1, restartOf: prev.id });
    toast('Restarted (recorded)');
  };
  $('resign').onclick = () => { closeMenu(); if (!rec.result) finish('resigned'); };
  $('switchRow').onclick = (e) => { const v = e.target.dataset.sw; if (v) { closeMenu(); switchTo(v); } };
  $('phead').onclick = () => { collapsed = !collapsed; render(); };
  $('hintBtn').onclick = () => { closeMenu(); hint(); };
  $('checkBtn').onclick = () => { closeMenu(); checkWinnable(); };
  $('solveBtn').onclick = () => { closeMenu(); solveFromHere(); };
  const setSpeed = (e) => {
    const v = e.target.dataset.sp;
    if (!v) return;
    setSetting('speed', v);
    press('speedSeg', 'sp', v);
    press('speedSeg2', 'sp', v);
    if (auto) scheduleAuto();
  };
  $('speedSeg').onclick = setSpeed;
  $('speedSeg2').onclick = setSpeed;
  $('autoPause').onclick = () => { if (!auto) return; auto.paused = !auto.paused; scheduleAuto(); render(); };
  $('autoStep').onclick = () => { if (auto?.paused) stepAuto(); };
  $('autoBack').onclick = () => { if (auto?.paused && auto.i > 0) stepBackAuto(); };
  $('autoStop').onclick = () => { stopAuto(); toast('Solver stopped. Carry on by hand; a win now counts as solved.'); };
  $('exportBtn').onclick = exportHistory;
  $('clearBtn').onclick = () => {
    const n = load(KEYS.records, []).length;
    $('clearMsg').textContent = n ? `Delete ${n} finished game${n === 1 ? '' : 's'}? The game in progress and settings stay. This can't be undone.` : 'No finished games stored.';
    $('clearYes').hidden = !n;
    $('clearConfirm').hidden = false;
  };
  $('clearYes').onclick = () => { clearHistory(); $('clearConfirm').hidden = true; };
  $('clearNo').onclick = () => { $('clearConfirm').hidden = true; };
  $('endNew').onclick = () => { $('endSheet').hidden = true; openMenu(); };
  $('endClose').onclick = () => { $('endSheet').hidden = true; };
  addEventListener('resize', () => render());
  // No background searching while the app is out of sight.
  document.addEventListener('visibilitychange', () => { if (document.hidden) liveStop(); else liveSchedule(); });
};

// ============= Start =============

const boot = async () => {
  core = await loadCore(fetch('core.wasm'));
  fetch('core-version.txt').then((r) => r.text()).then((v) => { $('coreVersion').textContent = v.trim(); }).catch(() => {});
  wire();
  const saved = load(KEYS.current, null);
  if (saved && validSeed(saved.seed)) {
    rec = saved;
    replay(core, rec);
    lay = core.layout();
    refresh();
    liveReset();
    render();
    if (rec.result) showEnd(rec.result);
    checkSolvable();
  } else {
    startGame(1, 'closed');
  }
  window.churchillBooted = true;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
};

boot();
