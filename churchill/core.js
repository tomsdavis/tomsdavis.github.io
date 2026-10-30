// Churchill Solitaire game core: a thin wrapper around core.wasm (built
// from the Rust engine in the churchill repo, see REQUIREMENTS.md) plus
// pure helpers for cards, moves and the stock projection.

// ============= Cards =============

// A card is a byte: rank 1-13 in the low 4 bits, suit 0-3 in bits 4-5.
export const SUITS = ['c', 'd', 'h', 's'];
export const GLYPH = { c: '♣', d: '♦', h: '♥', s: '♠' };
export const rank = (c) => c & 15;
export const suit = (c) => SUITS[c >> 4];
export const isRed = (c) => (c >> 4) === 1 || (c >> 4) === 2;
export const makeCard = (r, s) => r | (SUITS.indexOf(s) << 4);
export const rankText = (c) => ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rank(c)];
export const cardName = (c) => rankText(c) + GLYPH[suit(c)];

// ============= Moves =============

// Move codes: kind in bits 0-3, from pile 4-7, to pile 8-11, count 16-23.
export const KIND = { found: 0, run: 1, deal: 2, devil: 3 };
export const encodeMove = ({ kind, from = 0, to = 0, count = 0 }) =>
  (KIND[kind] | (from << 4) | (to << 8) | (count << 16)) >>> 0;
export const decodeMove = (code) => ({
  kind: Object.keys(KIND)[code & 15],
  from: (code >> 4) & 15,
  to: (code >> 8) & 15,
  count: (code >> 16) & 255,
});

// ============= Decoding the core's buffers =============

export const NPILES = 10;

// Position bytes: per pile len, down, kingHeaded, runStart, cards; then 8
// foundation heights (clubs first, larger first per suit); then Devil's Six
// played, stock dealt, won.
export const decodePosition = (bytes) => {
  let i = 0;
  const piles = Array.from({ length: NPILES }, () => {
    const [len, down, kingHeaded, runStart] = bytes.slice(i, i + 4);
    const cards = Array.from(bytes.slice(i + 4, i + 4 + len));
    i += 4 + len;
    return { cards, down, kingHeaded: kingHeaded === 1, runStart };
  });
  const found = SUITS.map((_, s) => [bytes[i + 2 * s], bytes[i + 2 * s + 1]]);
  i += 8;
  return { piles, found, devilNext: bytes[i], stockNext: bytes[i + 1], won: bytes[i + 2] === 1 };
};

// Layout bytes: 6 Devil's Six cards in play order, stock length, stock.
export const decodeLayout = (bytes) => ({
  devil: Array.from(bytes.slice(0, 6)),
  stock: Array.from(bytes.slice(7, 7 + bytes[6])),
});

// ============= Stock projection =============

// Where each undealt card lands if the King-headed piles stay as they are:
// [{ card, index (into the stock), row (deal), col (pile) }].
export const landing = (pos, layout) => {
  const elig = pos.piles.map((p, i) => i).filter((i) => !pos.piles[i].kingHeaded);
  return layout.stock.slice(pos.stockNext).map((card, k) => ({
    card, index: pos.stockNext + k, row: Math.floor(k / elig.length), col: elig[k % elig.length],
  }));
};

// ============= The core =============

const SEED_MAX = 2 ** 53 - 1;
const splitSeed = (seed) => [Math.floor(seed / 2 ** 32), seed % 2 ** 32];
export const validSeed = (seed) => Number.isInteger(seed) && seed >= 1 && seed <= SEED_MAX;

// Answers from solve(), solveCurrent() and checkCurrent(), by number (the
// core's `Answer` enum).
export const SOLVE = ['winnable', 'lost', 'unknown'];

// Instantiate core.wasm from its bytes or a fetch Response (or a promise of
// either) and return a
// small API over the one game it holds.
export const loadCore = async (from) => {
  const source = await from;
  const { instance } = typeof Response !== 'undefined' && source instanceof Response
    ? await WebAssembly.instantiateStreaming(source).catch(async () => WebAssembly.instantiate(await source.arrayBuffer()))
    : await WebAssembly.instantiate(source);
  const w = instance.exports;
  const bytes = (len) => new Uint8Array(w.memory.buffer, w.buf(), len).slice();
  const codes = (n) => {
    const b = bytes(4 * n);
    return Array.from({ length: n }, (_, i) => (b[4 * i] | (b[4 * i + 1] << 8) | (b[4 * i + 2] << 16) | (b[4 * i + 3] << 24)) >>> 0);
  };
  return {
    newGame: (seed, natural) => w.new_game(...splitSeed(seed), natural ? 1 : 0),
    switchNatural: () => w.switch_natural(),
    legalMoves: () => codes(w.legal_moves()),
    play: (code) => w.play(code),
    undo: () => w.undo(),
    undoCost: () => w.undo_cost(),
    position: () => decodePosition(bytes(w.position())),
    layout: () => decodeLayout(bytes(w.layout())),
    // { result: 'winnable' | 'lost' | 'unknown', line: [move codes] }
    solve: (seed, natural, limit, tries) => {
      const r = w.solve(...splitSeed(seed), natural ? 1 : 0, limit, tries);
      return { result: SOLVE[r], line: r === 0 ? codes(w.buf_len() / 4) : [] };
    },
    // A winning line from the current position, as moves the player can
    // make, simplified (shortcuts searched `depth` moves ahead, `budget`
    // moves of work). { result, line }.
    solveCurrent: (limit, tries, depth, budget) => {
      const r = w.solve_current(limit, tries, depth, budget);
      return { result: SOLVE[r], line: r === 0 ? codes(w.buf_len() / 4) : [] };
    },
    // Can the game in progress still be won? As solveCurrent but the line
    // is not simplified, so the answer comes sooner. { result, line }.
    checkCurrent: (limit, tries) => {
      const r = w.check_current(limit, tries);
      return { result: SOLVE[r], line: r === 0 ? codes(w.buf_len() / 4) : [] };
    },
  };
};
