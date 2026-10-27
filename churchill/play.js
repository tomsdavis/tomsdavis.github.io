// Pure game-flow helpers for the UI: legal targets for a selection, layout
// sizing, pile spacing and game records. No DOM, no storage.

import { decodeMove, rank, suit, SUITS } from './core.js';

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
});

// Help from the solver, recorded: a hint ('h', the move), a check ('w',
// the answer), or the solver taking over ('a').
export const withHint = (rec, code) => ({ ...rec, hints: rec.hints + 1, events: [...rec.events, ['h', code]] });
export const withCheck = (rec, result) => ({ ...rec, checks: rec.checks + 1, events: [...rec.events, ['w', result]] });
export const withAssist = (rec) => ({
  ...rec, assisted: rec.assisted ?? { atMove: rec.moves }, events: [...rec.events, ['a', rec.moves]],
});

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
