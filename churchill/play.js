// Pure game-flow helpers for the UI: legal targets for a selection, layout
// sizing, pile spacing and game records. No DOM, no storage.

import { decodeMove, rank, suit, SUITS, landing } from './core.js';

// ============= Selection and targets =============

// sel: { pile, index } (a card and everything above it) or { devil: true }.
// Returns the legal moves for it: { piles: Map(pile -> code), found: code|null }.
export const targetsFor = (sel, legal, pos) => {
  const out = { piles: new Map(), found: null };
  if (!sel) return out;
  legal.map((code) => [code, decodeMove(code)]).forEach(([code, m]) => {
    if (sel.devil) {
      if (m.kind === 'devil') out.found = code;
      return;
    }
    const pile = pos.piles[sel.pile];
    if (m.kind === 'run' && m.from === sel.pile && m.count === pile.cards.length - sel.index) out.piles.set(m.to, code);
    if (m.kind === 'found' && m.from === sel.pile && sel.index === pile.cards.length - 1) out.found = code;
  });
  return out;
};

// Can the card at `index` of `pile` be picked up (it heads the movable run)?
export const canPick = (pos, pile, index) => {
  const p = pos.piles[pile];
  return index >= p.runStart && index >= p.down && index < p.cards.length;
};

// Which foundation slot (0-7, two per suit in SUITS order) a card goes to:
// the first of its suit's two piles whose height is one below it.
export const slotFor = (pos, card) => {
  const s = SUITS.indexOf(suit(card));
  const [a, b] = pos.found[s];
  return a === rank(card) - 1 ? 2 * s : b === rank(card) - 1 ? 2 * s + 1 : -1;
};

// ============= Sliding moves =============

// Where the cards a move shifts go, for sliding them on screen. A place is
// { pile, index } | { slot } (foundation slot, slotFor numbering) |
// { devil } (index into the Devil's Six) | { stock: true }. Each card gets
// three places: before the move, after the move itself, and after the
// automatic plays (Aces) that follow it. Also returns the position between
// the two steps as { piles: [{ cards, down }] }.
export const slideTrail = (pos, lay, code) => {
  const m = decodeMove(code);
  const piles = pos.piles.map((p) => ({ cards: [...p.cards], down: p.down }));
  const found = pos.found.map((f) => [...f]);
  const up = (card) => {
    const slot = slotFor({ found }, card);
    found[slot >> 1][slot % 2]++;
    return { slot };
  };
  const trail = [];
  const go = (card, from, to) => trail.push({ card, at: [from, to, to] });
  if (m.kind === 'run') {
    const src = piles[m.from].cards, dst = piles[m.to].cards;
    const n = src.length - m.count, base = dst.length;
    src.splice(n).forEach((card, j) => {
      dst.push(card);
      go(card, { pile: m.from, index: n + j }, { pile: m.to, index: base + j });
    });
  } else if (m.kind === 'found') {
    const src = piles[m.from].cards;
    const card = src.pop();
    go(card, { pile: m.from, index: src.length }, up(card));
  } else if (m.kind === 'devil') {
    const card = lay.devil[pos.devilNext];
    go(card, { devil: pos.devilNext }, up(card));
  } else if (m.kind === 'deal') {
    landing(pos, lay).filter((x) => x.row === 0).forEach(({ card, col }) => {
      piles[col].cards.push(card);
      go(card, { stock: true }, { pile: col, index: piles[col].cards.length - 1 });
    });
  }
  const mid = { piles: piles.map((p) => ({ cards: [...p.cards], down: p.down })) };
  // Automatic plays, in the engine's order (game.rs, settle): each pile in
  // turn sends up the Aces on its top.
  piles.forEach((p, i) => {
    while (p.cards.length && rank(p.cards[p.cards.length - 1]) === 1) {
      const card = p.cards.pop();
      const index = p.cards.length;
      const to = up(card);
      const t = trail.find((x) => x.at[1].pile === i && x.at[1].index === index);
      if (t) t.at[2] = to;
      else trail.push({ card, at: [{ pile: i, index }, { pile: i, index }, to] });
    }
  });
  return { trail, mid, found };
};

// The same cards sliding back, for a take-back of the move.
export const reverseTrail = (trail) => trail.map(({ card, at }) => ({ card, at: [at[2], at[1], at[0]] }));

// ============= Layout =============

// Portrait or landscape, and the card width, for an area W x H (points).
// Landscape puts a 4-card-wide side column beside the 10 tableau columns.
export const chooseLayout = (W, H, pref) => {
  const landscape = pref === 'landscape' || (pref === 'auto' && W > H);
  const cw = landscape
    ? Math.floor(Math.min(96, (W - 60) / 14, (H - 130) / 5.6))
    : Math.floor(Math.min(64, (W - 24) / 10));
  return { landscape, cw: Math.max(20, cw) };
};

// Vertical offset of each card in a pile, squeezed to fit height H.
export const pileOffsets = (pile, open, cw, H) => {
  const up = Math.max(17, cw * 0.46), down = Math.max(6, cw * 0.16), ch = cw * 1.4;
  const steps = pile.cards.map((_, i) => (i < pile.down && !open ? down : up));
  const need = steps.slice(0, -1).reduce((a, b) => a + b, 0) + ch;
  const k = need > H - 4 && need > ch ? Math.max(0.15, (H - 4 - ch) / (need - ch)) : 1;
  return steps.reduce((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + steps[i - 1] * k], []);
};

// Height the tableau needs with nothing squeezed (open layout spacing).
export const tableauNeed = (pos, cw) =>
  Math.max(...pos.piles.map((p) => Math.max(0, p.cards.length - 1) * Math.max(17, cw * 0.46) + cw * 1.4)) + 10;

// ============= Game records =============

export const VARIANTS = ['closed', 'classic', 'natural'];
export const VARIANT_NAME = { closed: 'Closed', classic: 'Open classic', natural: 'Open natural' };
// Short names for the top bar, where space is tight on a phone.
export const VARIANT_SHORT = { closed: 'Closed', classic: 'Open', natural: 'Natural' };

// A record of one game: everything needed to replay it and to study it later.
export const newRecord = ({ seed, variant, attempt = 1, restartOf = null, now = Date.now() }) => ({
  id: `${seed}-${now}`,
  seed, variant, attempt, restartOf,
  start: now, end: null,
  result: null, // 'won' | 'stuck' | 'resigned' | 'abandoned' | 'restarted'
  switched: null, // { to, atMove }
  line: [], // moves currently on the board, as codes
  switchAt: null, // line length at which the core switched to natural rules
  events: [], // ['m', code] | ['u', cost] | ['s', variant]
  used: 0, // take-back count
  moves: 0, // moves played, including ones taken back
  solv: null, // { result, shownAtMove }
  hints: 0, // hints shown
  checks: 0, // "Still winnable?" asked
  assisted: null, // { atMove }: the solver played on from this move
  live: null, // with the indicator on Live: { won, lostAt, lostAs, backs } (see withLiveAnswer)
});

// Help from the solver, recorded: a hint ('h', the move), a check ('w',
// the answer), or the solver taking over ('a').
export const withHint = (rec, code) => ({ ...rec, hints: rec.hints + 1, events: [...rec.events, ['h', code]] });
export const withCheck = (rec, result) => ({ ...rec, checks: rec.checks + 1, events: [...rec.events, ['w', result]] });
export const withAssist = (rec) => ({
  ...rec, assisted: rec.assisted ?? { atMove: rec.moves }, events: [...rec.events, ['a', rec.moves]],
});

// The live indicator's answer for the position on the board changed to
// `state` ('winnable', 'unknown' or 'lost'; event 'l'). The record keeps
// whether a win was ever shown, the move after which the shown win was
// first lost (`lostAt`, a move count) and how it showed (`lostAs`), and
// take-backs made while it showed no win (`backs`).
const LIVE0 = { won: false, lostAt: null, lostAs: null, backs: 0 };
export const withLiveAnswer = (rec, state) => {
  const l = rec.live ?? LIVE0;
  const first = l.won && l.lostAt === null && state !== 'winnable';
  return {
    ...rec,
    live: { ...l, won: l.won || state === 'winnable', ...(first ? { lostAt: rec.moves, lostAs: state } : {}) },
    events: [...rec.events, ['l', state]],
  };
};
export const withLiveBack = (rec) => ({ ...rec, live: { ...(rec.live ?? LIVE0), backs: (rec.live?.backs ?? 0) + 1 } });
// The last answer the record noted, or null.
export const lastLiveAnswer = (rec) => rec.events.findLast((e) => e[0] === 'l')?.[1] ?? null;

// A win the solver finished is recorded as 'solved', not 'won'.
export const winResult = (rec) => (rec.assisted ? 'solved' : 'won');

export const withMove = (rec, code) => ({
  ...rec, line: [...rec.line, code], events: [...rec.events, ['m', code]], moves: rec.moves + 1,
});

export const withUndo = (rec, cost) => {
  const line = rec.line.slice(0, -1);
  return {
    ...rec, line, events: [...rec.events, ['u', cost]], used: rec.used + cost,
    switchAt: rec.switchAt === null ? null : Math.min(rec.switchAt, line.length),
  };
};

// Stepping back through the solver's playback: the move comes off the
// board but is not a take-back (no count), and the move count goes back
// with it, since the solver will play it again.
export const withPlaybackBack = (rec) => {
  const line = rec.line.slice(0, -1);
  return {
    ...rec, line, events: [...rec.events, ['b']], moves: rec.moves - 1,
    switchAt: rec.switchAt === null ? null : Math.min(rec.switchAt, line.length),
  };
};

export const withSwitch = (rec, to) => ({
  ...rec,
  variant: to,
  switched: { to, atMove: rec.moves },
  switchAt: to === 'natural' ? rec.line.length : rec.switchAt,
  events: [...rec.events, ['s', to]],
});

export const withEnd = (rec, result, now = Date.now()) => ({ ...rec, result, end: now });

// Rebuild the core's game from a record: replay its line, switching to
// natural rules where the record did.
export const replay = (core, rec) => {
  core.newGame(rec.seed, rec.variant === 'natural' && rec.switchAt === null);
  rec.line.forEach((code, i) => {
    if (rec.switchAt === i) core.switchNatural();
    core.play(code);
  });
  if (rec.switchAt !== null && rec.switchAt >= rec.line.length) core.switchNatural();
};

// ============= Live indicator =============

// A key naming a position, for caching answers (take-backs and moves that
// lead back return to a known answer).
export const posKey = (pos) => [
  pos.piles.map((p) => `${p.down}:${p.cards.join('.')}`).join('|'),
  pos.found.flat().join('.'), pos.devilNext, pos.stockNext,
].join('/');

// What a move from a position with answer `prev` ({ state, line }) shows
// about the new position without a search, or null if a search is needed.
// Following a known winning line keeps the win, with the rest of the line.
// A reversible move (take-back cost 0) can be moved back, so it keeps a
// win; the line is lost, as the solver's pruned search cannot always see
// that way back. A lost position stays lost.
export const liveAfterMove = (prev, code, cost) => {
  if (!prev) return null;
  if (prev.state === 'winnable' && prev.line?.[0] === code) return { state: 'winnable', line: prev.line.slice(1) };
  if (prev.state === 'lost') return { state: 'lost', line: null };
  if (prev.state === 'winnable' && cost === 0) return { state: 'winnable', line: null };
  return null;
};

// The answer to keep for a position, given the one cached (`had`) and a new
// one (`got`). A known win is never given up for a search that found none;
// a winning line replaces none.
export const liveMerge = (had, got) => {
  if (!had) return got;
  if (had.state === 'winnable' && got.state !== 'winnable') return { ...had, tried: true };
  if (had.state === 'winnable' && had.line && !got.line) return had;
  return got;
};

// The next search for the live indicator, or null. `here` is the current
// position's key, `probes` the legal moves from it as { code, cost, key }.
// First the position itself (once quickly, then once with the full budget
// if no win was found), then a line for a known win that has none, then
// the positions after each move whose answer is not known without a search.
export const liveNextJob = (cache, here, probes) => {
  const now = cache.get(here);
  if (!now) return { key: here, code: null, full: false };
  if (now.state === 'unknown' && !now.full) return { key: here, code: null, full: true };
  if (now.state === 'winnable' && !now.line && !now.tried) return { key: here, code: null, full: false };
  const next = probes.find(({ code, cost, key }) => liveAfterMove(now, code, cost) === null && !cache.has(key));
  return next ? { key: next.key, code: next.code, full: false } : null;
};
